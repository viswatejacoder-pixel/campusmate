// Mounted at /api/subjects (app.js). Every route requires a logged-in session. Express 5 forwards errors from async handlers to errorHandler.
import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { list, create, rename, remove } from '../controllers/subjectController.js';

const router = Router();

router.use(requireAuth);
router.get('/', list);
router.post('/', create);
router.put('/:id', rename);
router.delete('/:id', remove);

export default router;
