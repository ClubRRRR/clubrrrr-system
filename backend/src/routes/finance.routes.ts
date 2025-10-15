import { Router } from 'express';
import { financeController } from '../controllers/finance.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'manager')); // Only admin and managers can access finance

router.get('/income', financeController.getIncome);
router.post('/income', financeController.addIncome);
router.get('/expenses', financeController.getExpenses);
router.post('/expenses', financeController.addExpense);
router.get('/dashboard', financeController.getDashboard);

export default router;
