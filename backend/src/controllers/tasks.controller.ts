import { Request, Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/error.middleware';

export const tasksController = {
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const { status, assigned_to, priority } = req.query;
    
    let queryText = `SELECT t.*, u.first_name, u.last_name FROM tasks t
                     LEFT JOIN users u ON t.assigned_to = u.id WHERE 1=1`;
    const params: any[] = [];
    let count = 0;
    
    if (status) { count++; queryText += ` AND t.status = $${count}`; params.push(status); }
    if (assigned_to) { count++; queryText += ` AND t.assigned_to = $${count}`; params.push(assigned_to); }
    if (priority) { count++; queryText += ` AND t.priority = $${count}`; params.push(priority); }
    
    queryText += ` ORDER BY t.due_date ASC`;
    const result = await query(queryText, params);
    
    res.json({ success: true, data: result.rows });
  }),
  
  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = await query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) throw new AppError('Task not found', 404);
    res.json({ success: true, data: result.rows[0] });
  }),
  
  create: asyncHandler(async (req: Request, res: Response) => {
    const { title, description, status, priority, assigned_to, due_date, parent_task_id } = req.body;
    const result = await query(
      `INSERT INTO tasks (title, description, status, priority, assigned_to, created_by, due_date, parent_task_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, status || 'todo', priority || 'medium', assigned_to, req.user?.userId, due_date, parent_task_id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  }),
  
  update: asyncHandler(async (req: Request, res: Response) => {
    const { title, description, status, priority, assigned_to, due_date } = req.body;
    const result = await query(
      `UPDATE tasks SET title = COALESCE($1, title), description = COALESCE($2, description),
       status = COALESCE($3, status), priority = COALESCE($4, priority), assigned_to = COALESCE($5, assigned_to),
       due_date = COALESCE($6, due_date) WHERE id = $7 RETURNING *`,
      [title, description, status, priority, assigned_to, due_date, req.params.id]
    );
    if (result.rows.length === 0) throw new AppError('Task not found', 404);
    res.json({ success: true, data: result.rows[0] });
  }),
  
  delete: asyncHandler(async (req: Request, res: Response) => {
    await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Task deleted' });
  })
};

export default tasksController;
