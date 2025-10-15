import { Request, Response } from 'express';
import { query, getClient } from '../config/database';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export const cyclesController = {
  // Get all cycles
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const { status, program_id, page = '1', limit = '20' } = req.query;

    let queryText = `
      SELECT 
        c.*,
        p.name as program_name,
        p.type as program_type,
        p.duration_weeks,
        p.price,
        (SELECT COUNT(*) FROM enrollments WHERE cycle_id = c.id) as enrolled_count
      FROM cycles c
      LEFT JOIN programs p ON c.program_id = p.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      queryText += ` AND c.status = $${paramCount}`;
      params.push(status);
    }

    if (program_id) {
      paramCount++;
      queryText += ` AND c.program_id = $${paramCount}`;
      params.push(program_id);
    }

    queryText += ` ORDER BY c.start_date DESC`;

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    paramCount++;
    queryText += ` LIMIT $${paramCount}`;
    params.push(limitNum);

    paramCount++;
    queryText += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await query(queryText, params);

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM cycles c WHERE 1=1 ${status ? 'AND c.status = $1' : ''}`,
      status ? [status] : []
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limitNum)
      }
    });
  }),

  // Get single cycle by ID
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        c.*,
        p.name as program_name,
        p.type as program_type,
        p.duration_weeks,
        p.price,
        p.description as program_description,
        (SELECT COUNT(*) FROM enrollments WHERE cycle_id = c.id) as enrolled_count,
        (SELECT COUNT(*) FROM events WHERE cycle_id = c.id) as events_count
      FROM cycles c
      LEFT JOIN programs p ON c.program_id = p.id
      WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Cycle not found', 404);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  }),

  // Create new cycle
  create: asyncHandler(async (req: Request, res: Response) => {
    const {
      program_id,
      name,
      start_date,
      end_date,
      max_students,
      notes
    } = req.body;

    if (!program_id || !name || !start_date || !end_date) {
      throw new AppError('Missing required fields', 400);
    }

    // Check if program exists
    const programExists = await query('SELECT id FROM programs WHERE id = $1', [program_id]);
    if (programExists.rows.length === 0) {
      throw new AppError('Program not found', 404);
    }

    const result = await query(
      `INSERT INTO cycles 
        (program_id, name, start_date, end_date, max_students, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'planned')
      RETURNING *`,
      [program_id, name, start_date, end_date, max_students, notes]
    );

    logger.info(`New cycle created: ${name}`, { 
      cycleId: result.rows[0].id,
      userId: req.user?.userId 
    });

    res.status(201).json({
      success: true,
      message: 'Cycle created successfully',
      data: result.rows[0]
    });
  }),

  // Update cycle
  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      name,
      start_date,
      end_date,
      status,
      max_students,
      notes
    } = req.body;

    const result = await query(
      `UPDATE cycles SET
        name = COALESCE($1, name),
        start_date = COALESCE($2, start_date),
        end_date = COALESCE($3, end_date),
        status = COALESCE($4, status),
        max_students = COALESCE($5, max_students),
        notes = COALESCE($6, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *`,
      [name, start_date, end_date, status, max_students, notes, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Cycle not found', 404);
    }

    logger.info(`Cycle updated: ${id}`, { userId: req.user?.userId });

    res.json({
      success: true,
      message: 'Cycle updated successfully',
      data: result.rows[0]
    });
  }),

  // Delete cycle
  delete: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Check if cycle has enrollments
    const enrollments = await query(
      'SELECT COUNT(*) FROM enrollments WHERE cycle_id = $1',
      [id]
    );

    if (parseInt(enrollments.rows[0].count) > 0) {
      throw new AppError('Cannot delete cycle with existing enrollments', 400);
    }

    const result = await query('DELETE FROM cycles WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      throw new AppError('Cycle not found', 404);
    }

    logger.info(`Cycle deleted: ${id}`, { userId: req.user?.userId });

    res.json({
      success: true,
      message: 'Cycle deleted successfully'
    });
  }),

  // Get students enrolled in a cycle
  getStudents: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        e.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.avatar_url
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE e.cycle_id = $1
      ORDER BY e.enrolled_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  }),

  // Enroll student in cycle
  enrollStudent: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { user_id, payment_status, total_paid, notes } = req.body;

    if (!user_id) {
      throw new AppError('User ID is required', 400);
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check if cycle exists and not full
      const cycleResult = await client.query(
        'SELECT * FROM cycles WHERE id = $1',
        [id]
      );

      if (cycleResult.rows.length === 0) {
        throw new AppError('Cycle not found', 404);
      }

      const cycle = cycleResult.rows[0];

      if (cycle.max_students && cycle.current_students >= cycle.max_students) {
        throw new AppError('Cycle is full', 400);
      }

      // Check if user already enrolled
      const existingEnrollment = await client.query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND cycle_id = $2',
        [user_id, id]
      );

      if (existingEnrollment.rows.length > 0) {
        throw new AppError('User already enrolled in this cycle', 400);
      }

      // Create enrollment
      const enrollmentResult = await client.query(
        `INSERT INTO enrollments 
          (user_id, cycle_id, payment_status, total_paid, notes, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING *`,
        [user_id, id, payment_status || 'pending', total_paid || 0, notes]
      );

      await client.query('COMMIT');

      logger.info(`Student enrolled in cycle: ${id}`, { 
        userId: user_id,
        enrollmentId: enrollmentResult.rows[0].id 
      });

      res.status(201).json({
        success: true,
        message: 'Student enrolled successfully',
        data: enrollmentResult.rows[0]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),

  // Remove student from cycle
  removeStudent: asyncHandler(async (req: Request, res: Response) => {
    const { id, enrollment_id } = req.params;

    const result = await query(
      'DELETE FROM enrollments WHERE id = $1 AND cycle_id = $2 RETURNING id',
      [enrollment_id, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Enrollment not found', 404);
    }

    logger.info(`Student removed from cycle: ${id}`, { 
      enrollmentId: enrollment_id,
      userId: req.user?.userId 
    });

    res.json({
      success: true,
      message: 'Student removed from cycle successfully'
    });
  }),

  // Update enrollment status
  updateEnrollment: asyncHandler(async (req: Request, res: Response) => {
    const { id, enrollment_id } = req.params;
    const { status, payment_status, total_paid, notes } = req.body;

    const result = await query(
      `UPDATE enrollments SET
        status = COALESCE($1, status),
        payment_status = COALESCE($2, payment_status),
        total_paid = COALESCE($3, total_paid),
        notes = COALESCE($4, notes)
      WHERE id = $5 AND cycle_id = $6
      RETURNING *`,
      [status, payment_status, total_paid, notes, enrollment_id, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Enrollment not found', 404);
    }

    res.json({
      success: true,
      message: 'Enrollment updated successfully',
      data: result.rows[0]
    });
  }),

  // Get upcoming cycles
  getUpcoming: asyncHandler(async (req: Request, res: Response) => {
    const result = await query(
      `SELECT 
        c.*,
        p.name as program_name,
        p.type as program_type,
        (SELECT COUNT(*) FROM enrollments WHERE cycle_id = c.id) as enrolled_count
      FROM cycles c
      LEFT JOIN programs p ON c.program_id = p.id
      WHERE c.start_date >= CURRENT_DATE
        AND c.status IN ('planned', 'active')
      ORDER BY c.start_date ASC
      LIMIT 10`
    );

    res.json({
      success: true,
      data: result.rows
    });
  }),

  // Get cycle statistics
  getStats: asyncHandler(async (req: Request, res: Response) => {
    const statsQuery = `
      SELECT
        COUNT(*) as total_cycles,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_cycles,
        COUNT(CASE WHEN status = 'planned' THEN 1 END) as planned_cycles,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_cycles,
        (SELECT COUNT(*) FROM enrollments WHERE status = 'active') as total_active_students,
        (SELECT AVG(current_students) FROM cycles WHERE status = 'active') as avg_students_per_cycle
      FROM cycles
    `;

    const programQuery = `
      SELECT 
        p.name,
        p.type,
        COUNT(c.id) as cycle_count,
        (SELECT COUNT(*) FROM enrollments e 
         JOIN cycles cy ON e.cycle_id = cy.id 
         WHERE cy.program_id = p.id) as total_students
      FROM programs p
      LEFT JOIN cycles c ON c.program_id = p.id
      GROUP BY p.id, p.name, p.type
    `;

    const [stats, programs] = await Promise.all([
      query(statsQuery),
      query(programQuery)
    ]);

    res.json({
      success: true,
      data: {
        overview: stats.rows[0],
        by_program: programs.rows
      }
    });
  })
};

export default cyclesController;
