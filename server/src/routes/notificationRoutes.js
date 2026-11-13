import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { clear, count, getPrefs, list, pushKey, putPrefs, read, remove, subscribe, unsubscribe } from '../controllers/notificationController.js';

const router = Router();
router.use(requireAuth);
router.get('/', list);
router.get('/unread-count', count);
router.get('/preferences', getPrefs);
router.put('/preferences', putPrefs);
router.get('/push-key', pushKey);
router.post('/push-subscription', subscribe);
router.delete('/push-subscription', unsubscribe);
router.delete('/', clear);
router.patch('/:id/read', read);
router.delete('/:id', remove);

export default router;
