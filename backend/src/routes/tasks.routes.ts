import { Router } from 'express';
import { tasksController } from '../controllers/tasks.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', tasksController.getAll);
router.get('/:id', tasksController.getById);
router.post('/', tasksController.create);
router.put('/:id', tasksController.update);
router.delete('/:id', tasksController.delete);

export default router;
