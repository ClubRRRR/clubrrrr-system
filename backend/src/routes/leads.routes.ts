import { Router } from 'express';
import { leadsController } from '../controllers/leads.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// CRUD operations
router.get('/', leadsController.getAll);
router.get('/:id', leadsController.getById);
router.post('/', authorize('admin', 'manager'), leadsController.create);
router.put('/:id', authorize('admin', 'manager'), leadsController.update);
router.delete('/:id', authorize('admin'), leadsController.delete);

// Additional operations
router.post('/:id/activity', leadsController.addActivity);
router.get('/:id/activities', leadsController.getActivities);
router.put('/:id/convert', authorize('admin', 'manager'), leadsController.convertToDeal);
router.get('/stats/overview', leadsController.getStats);

export default router;
