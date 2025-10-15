import { Request, Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export const eventsController = {
  // Get all events
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const { type, cycle_id, start_date, end_date } = req.query;

    let queryText = `
      SELECT 
        e.*,
        c.name as cycle_name,
        p.name as program_name,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name,
        (SELECT COUNT(*) FROM event_attendees WHERE event_id = e.id) as attendee_count
      FROM events e
      LEFT JOIN cycles c ON e.cycle_id = c.id
      LEFT JOIN programs p ON c.program_id = p.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (type) {
      paramCount++;
      queryText += ` AND e.type = $${paramCount}`;
      params.push(type);
    }

    if (cycle_id) {
      paramCount++;
      queryText += ` AND e.cycle_id = $${paramCount}`;
      params.push(cycle_id);
    }

    if (start_date) {
      paramCount++;
      queryText += ` AND e.start_time >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      queryText += ` AND e.start_time <= $${paramCount}`;
      params.push(end_date);
    }

    queryText += ` ORDER BY e.start_time ASC`;

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows
    });
  }),

  // Get single event
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        e.*,
        c.name as cycle_name,
        p.name as program_name,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM events e
      LEFT JOIN cycles c ON e.cycle_id = c.id
      LEFT JOIN programs p ON c.program_id = p.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Event not found', 404);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  }),

  // Create event
  create: asyncHandler(async (req: Request, res: Response) => {
    const {
      title,
      description,
      type,
      cycle_id,
      start_time,
      end_time,
      location,
      meeting_link
    } = req.body;

    if (!title || !type || !start_time || !end_time) {
      throw new AppError('Missing required fields', 400);
    }

    const result = await query(
      `INSERT INTO events 
        (title, description, type, cycle_id, start_time, end_time, location, meeting_link, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [title, description, type, cycle_id, start_time, end_time, location, meeting_link, req.user?.userId]
    );

    logger.info(`Event created: ${title}`, { eventId: result.rows[0].id });

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: result.rows[0]
    });
  }),

  // Update event
  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      title,
      description,
      type,
      cycle_id,
      start_time,
      end_time,
      location,
      meeting_link
    } = req.body;

    const result = await query(
      `UPDATE events SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        type = COALESCE($3, type),
        cycle_id = COALESCE($4, cycle_id),
        start_time = COALESCE($5, start_time),
        end_time = COALESCE($6, end_time),
        location = COALESCE($7, location),
        meeting_link = COALESCE($8, meeting_link),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *`,
      [title, description, type, cycle_id, start_time, end_time, location, meeting_link, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Event not found', 404);
    }

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: result.rows[0]
    });
  }),

  // Delete event
  delete: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      throw new AppError('Event not found', 404);
    }

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  }),

  // Get calendar view
  getCalendar: asyncHandler(async (req: Request, res: Response) => {
    const { month, year } = req.query;

    if (!month || !year) {
      throw new AppError('Month and year are required', 400);
    }

    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${parseInt(month as string) + 1}-01`;

    const result = await query(
      `SELECT 
        e.*,
        c.name as cycle_name
      FROM events e
      LEFT JOIN cycles c ON e.cycle_id = c.id
      WHERE e.start_time >= $1 AND e.start_time < $2
      ORDER BY e.start_time`,
      [startDate, endDate]
    );

    res.json({
      success: true,
      data: result.rows
    });
  }),

  // Add attendee
  addAttendee: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { user_id, status } = req.body;

    if (!user_id) {
      throw new AppError('User ID is required', 400);
    }

    const result = await query(
      `INSERT INTO event_attendees (event_id, user_id, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id, user_id) DO UPDATE SET status = $3
      RETURNING *`,
      [id, user_id, status || 'invited']
    );

    res.status(201).json({
      success: true,
      message: 'Attendee added successfully',
      data: result.rows[0]
    });
  }),

  // Get attendees
  getAttendees: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        ea.*,
        u.first_name,
        u.last_name,
        u.email
      FROM event_attendees ea
      JOIN users u ON ea.user_id = u.id
      WHERE ea.event_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  })
};

export default eventsController;
