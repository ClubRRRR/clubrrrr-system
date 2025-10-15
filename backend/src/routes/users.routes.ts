import { Router } from 'express';
import { usersController } from '../controllers/users.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', authorize('admin', 'manager'), usersController.getAll);
router.get('/:id', usersController.getById);
router.put('/:id', authorize('admin', 'manager'), usersController.update);
router.delete('/:id', authorize('admin'), usersController.delete);

export default router;
