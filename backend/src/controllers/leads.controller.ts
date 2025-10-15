import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { query, getClient } from '../config/database';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export const leadsController = {
  // Get all leads with filtering, sorting, and pagination
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const { 
      status, 
      source, 
      assigned_to, 
      search,
      page = '1', 
      limit = '20',
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    let queryText = `
      SELECT 
        l.*,
        u.first_name as assigned_first_name,
        u.last_name as assigned_last_name,
        (SELECT COUNT(*) FROM lead_activities WHERE lead_id = l.id) as activity_count
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 0;

    // Filters
    if (status) {
      paramCount++;
      queryText += ` AND l.status = $${paramCount}`;
      params.push(status);
    }

    if (source) {
      paramCount++;
      queryText += ` AND l.source = $${paramCount}`;
      params.push(source);
    }

    if (assigned_to) {
      paramCount++;
      queryText += ` AND l.assigned_to = $${paramCount}`;
      params.push(assigned_to);
    }

    if (search) {
      paramCount++;
      queryText += ` AND (
        l.first_name ILIKE $${paramCount} OR 
        l.last_name ILIKE $${paramCount} OR 
        l.email ILIKE $${paramCount} OR 
        l.phone ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Get total count
    const countResult = await query(`SELECT COUNT(*) FROM (${queryText}) as filtered`, params);
    const total = parseInt(countResult.rows[0].count);

    // Sorting
    const validSortColumns = ['created_at', 'first_name', 'last_name', 'status'];
    const sortColumn = validSortColumns.includes(sort_by as string) ? sort_by : 'created_at';
    const sortDir = sort_order === 'ASC' ? 'ASC' : 'DESC';
    queryText += ` ORDER BY l.${sortColumn} ${sortDir}`;

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

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  }),

  // Get single lead by ID
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        l.*,
        u.first_name as assigned_first_name,
        u.last_name as assigned_last_name,
        u.email as assigned_email
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Lead not found', 404);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  }),

  // Create new lead
  create: asyncHandler(async (req: Request, res: Response) => {
    const {
      first_name,
      last_name,
      email,
      phone,
      source,
      interested_program,
      notes,
      assigned_to
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !phone || !source) {
      throw new AppError('Missing required fields', 400);
    }

    // Check if phone already exists
    const existing = await query('SELECT id FROM leads WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      throw new AppError('Lead with this phone number already exists', 400);
    }

    const result = await query(
      `INSERT INTO leads 
        (first_name, last_name, email, phone, source, interested_program, notes, assigned_to, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new')
      RETURNING *`,
      [first_name, last_name, email, phone, source, interested_program, notes, assigned_to]
    );

    // Log activity
    await query(
      `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
      VALUES ($1, $2, 'note', 'Lead created')`,
      [result.rows[0].id, req.user?.userId]
    );

    logger.info(`New lead created: ${first_name} ${last_name}`, { 
      leadId: result.rows[0].id,
      userId: req.user?.userId 
    });

    res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: result.rows[0]
    });
  }),

  // Update lead
  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone,
      source,
      status,
      interested_program,
      notes,
      assigned_to,
      next_follow_up
    } = req.body;

    // Check if lead exists
    const existing = await query('SELECT * FROM leads WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new AppError('Lead not found', 404);
    }

    const result = await query(
      `UPDATE leads SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        source = COALESCE($5, source),
        status = COALESCE($6, status),
        interested_program = COALESCE($7, interested_program),
        notes = COALESCE($8, notes),
        assigned_to = COALESCE($9, assigned_to),
        next_follow_up = COALESCE($10, next_follow_up),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *`,
      [first_name, last_name, email, phone, source, status, interested_program, 
       notes, assigned_to, next_follow_up, id]
    );

    // Log activity
    await query(
      `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
      VALUES ($1, $2, 'note', 'Lead updated')`,
      [id, req.user?.userId]
    );

    logger.info(`Lead updated: ${id}`, { userId: req.user?.userId });

    res.json({
      success: true,
      message: 'Lead updated successfully',
      data: result.rows[0]
    });
  }),

  // Delete lead
  delete: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await query('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      throw new AppError('Lead not found', 404);
    }

    logger.info(`Lead deleted: ${id}`, { userId: req.user?.userId });

    res.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  }),

  // Add activity to lead
  addActivity: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { activity_type, description } = req.body;

    if (!activity_type || !description) {
      throw new AppError('Activity type and description are required', 400);
    }

    // Check if lead exists
    const leadExists = await query('SELECT id FROM leads WHERE id = $1', [id]);
    if (leadExists.rows.length === 0) {
      throw new AppError('Lead not found', 404);
    }

    const result = await query(
      `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [id, req.user?.userId, activity_type, description]
    );

    res.status(201).json({
      success: true,
      message: 'Activity added successfully',
      data: result.rows[0]
    });
  }),

  // Get all activities for a lead
  getActivities: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        la.*,
        u.first_name,
        u.last_name,
        u.email
      FROM lead_activities la
      LEFT JOIN users u ON la.user_id = u.id
      WHERE la.lead_id = $1
      ORDER BY la.created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  }),

  // Convert lead to deal
  convertToDeal: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { program_name, amount, stage, expected_close_date, notes } = req.body;

    if (!program_name || !amount) {
      throw new AppError('Program name and amount are required', 400);
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check if lead exists
      const leadResult = await client.query('SELECT * FROM leads WHERE id = $1', [id]);
      if (leadResult.rows.length === 0) {
        throw new AppError('Lead not found', 404);
      }

      // Create deal
      const dealResult = await client.query(
        `INSERT INTO deals 
          (lead_id, program_name, amount, stage, assigned_to, expected_close_date, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [id, program_name, amount, stage || 'proposal', 
         leadResult.rows[0].assigned_to, expected_close_date, notes]
      );

      // Update lead status
      await client.query(
        `UPDATE leads SET status = 'closed_won' WHERE id = $1`,
        [id]
      );

      // Log activity
      await client.query(
        `INSERT INTO lead_activities (lead_id, user_id, activity_type, description)
        VALUES ($1, $2, 'note', 'Lead converted to deal')`,
        [id, req.user?.userId]
      );

      await client.query('COMMIT');

      logger.info(`Lead converted to deal: ${id}`, { 
        dealId: dealResult.rows[0].id,
        userId: req.user?.userId 
      });

      res.json({
        success: true,
        message: 'Lead converted to deal successfully',
        data: {
          lead_id: id,
          deal: dealResult.rows[0]
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),

  // Get lead statistics
  getStats: asyncHandler(async (req: Request, res: Response) => {
    const statsQuery = `
      SELECT
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_leads,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_leads,
        COUNT(CASE WHEN status = 'interested' THEN 1 END) as interested_leads,
        COUNT(CASE WHEN status = 'negotiating' THEN 1 END) as negotiating_leads,
        COUNT(CASE WHEN status = 'closed_won' THEN 1 END) as closed_won,
        COUNT(CASE WHEN status = 'closed_lost' THEN 1 END) as closed_lost,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as leads_this_week,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as leads_this_month
      FROM leads
    `;

    const sourceQuery = `
      SELECT source, COUNT(*) as count
      FROM leads
      GROUP BY source
      ORDER BY count DESC
    `;

    const assignedQuery = `
      SELECT 
        u.first_name,
        u.last_name,
        COUNT(l.id) as lead_count
      FROM users u
      LEFT JOIN leads l ON l.assigned_to = u.id
      WHERE u.role IN ('admin', 'manager')
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY lead_count DESC
    `;

    const [stats, sources, assigned] = await Promise.all([
      query(statsQuery),
      query(sourceQuery),
      query(assignedQuery)
    ]);

    res.json({
      success: true,
      data: {
        overview: stats.rows[0],
        by_source: sources.rows,
        by_assigned: assigned.rows
      }
    });
  })
};

export default leadsController;
