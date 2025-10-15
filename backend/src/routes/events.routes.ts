import { Router } from 'express';
import { eventsController } from '../controllers/events.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', eventsController.getAll);
router.get('/calendar', eventsController.getCalendar);
router.get('/:id', eventsController.getById);
router.post('/', authorize('admin', 'manager'), eventsController.create);
router.put('/:id', authorize('admin', 'manager'), eventsController.update);
router.delete('/:id', authorize('admin', 'manager'), eventsController.delete);

// Attendees
router.post('/:id/attendees', authorize('admin', 'manager'), eventsController.addAttendee);
router.get('/:id/attendees', eventsController.getAttendees);

export default router;
