import { Request, Response } from 'express';
import { query } from '../config/database';
import { AppError, asyncHandler } from '../middleware/error.middleware';

export const usersController = {
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const { role, status } = req.query;
    let queryText = 'SELECT id, email, first_name, last_name, phone, role, status, created_at FROM users WHERE 1=1';
    const params: any[] = [];
    let count = 0;
    
    if (role) { count++; queryText += ` AND role = $${count}`; params.push(role); }
    if (status) { count++; queryText += ` AND status = $${count}`; params.push(status); }
    
    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  }),
  
  getById: asyncHandler(async (req: Request, res: Response) => {
    const result = await query(
      'SELECT id, email, first_name, last_name, phone, role, status, avatar_url, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) throw new AppError('User not found', 404);
    res.json({ success: true, data: result.rows[0] });
  }),
  
  update: asyncHandler(async (req: Request, res: Response) => {
    const { first_name, last_name, phone, role, status, avatar_url } = req.body;
    const result = await query(
      `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
       phone = COALESCE($3, phone), role = COALESCE($4, role), status = COALESCE($5, status),
       avatar_url = COALESCE($6, avatar_url) WHERE id = $7 RETURNING id, email, first_name, last_name, role, status`,
      [first_name, last_name, phone, role, status, avatar_url, req.params.id]
    );
    if (result.rows.length === 0) throw new AppError('User not found', 404);
    res.json({ success: true, data: result.rows[0] });
  }),
  
  delete: asyncHandler(async (req: Request, res: Response) => {
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'User deleted' });
  })
};

export default usersController;
