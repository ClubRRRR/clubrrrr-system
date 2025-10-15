import { Request, Response } from 'express';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/error.middleware';

export const financeController = {
  getIncome: asyncHandler(async (req: Request, res: Response) => {
    const result = await query('SELECT * FROM income ORDER BY income_date DESC LIMIT 100');
    res.json({ success: true, data: result.rows });
  }),
  
  addIncome: asyncHandler(async (req: Request, res: Response) => {
    const { source, description, amount, income_date, payment_method, notes } = req.body;
    const result = await query(
      `INSERT INTO income (source, description, amount, income_date, payment_method, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [source, description, amount, income_date, payment_method, notes, req.user?.userId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  }),
  
  getExpenses: asyncHandler(async (req: Request, res: Response) => {
    const result = await query('SELECT * FROM expenses ORDER BY expense_date DESC LIMIT 100');
    res.json({ success: true, data: result.rows });
  }),
  
  addExpense: asyncHandler(async (req: Request, res: Response) => {
    const { category, description, amount, expense_date, payment_method, is_recurring, notes } = req.body;
    const result = await query(
      `INSERT INTO expenses (category, description, amount, expense_date, payment_method, is_recurring, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [category, description, amount, expense_date, payment_method, is_recurring || false, notes, req.user?.userId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  }),
  
  getDashboard: asyncHandler(async (req: Request, res: Response) => {
    const [income, expenses] = await Promise.all([
      query('SELECT SUM(amount) as total FROM income WHERE income_date >= date_trunc(\'month\', CURRENT_DATE)'),
      query('SELECT SUM(amount) as total FROM expenses WHERE expense_date >= date_trunc(\'month\', CURRENT_DATE)')
    ]);
    
    res.json({
      success: true,
      data: {
        monthly_income: income.rows[0].total || 0,
        monthly_expenses: expenses.rows[0].total || 0,
        net: (income.rows[0].total || 0) - (expenses.rows[0].total || 0)
      }
    });
  })
};

export default financeController;
