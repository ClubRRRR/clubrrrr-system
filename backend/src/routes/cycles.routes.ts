import { Router } from 'express';
import { cyclesController } from '../controllers/cycles.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', cyclesController.getAll);
router.get('/upcoming', cyclesController.getUpcoming);
router.get('/stats', cyclesController.getStats);
router.get('/:id', cyclesController.getById);
router.post('/', authorize('admin', 'manager'), cyclesController.create);
router.put('/:id', authorize('admin', 'manager'), cyclesController.update);
router.delete('/:id', authorize('admin'), cyclesController.delete);

// Students management
router.get('/:id/students', cyclesController.getStudents);
router.post('/:id/enroll', authorize('admin', 'manager'), cyclesController.enrollStudent);
router.delete('/:id/students/:enrollment_id', authorize('admin', 'manager'), cyclesController.removeStudent);
router.put('/:id/enrollments/:enrollment_id', authorize('admin', 'manager'), cyclesController.updateEnrollment);

export default router;
