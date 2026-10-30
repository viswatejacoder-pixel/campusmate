// Mounted at /api/tasks (app.js). Every route requires a logged-in session. Express 5 forwards errors from async handlers to errorHandler.
// /summary must be registered before /:id, otherwise "summary" would be read as a task id.
import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { list, summary, getOne, create, update, complete, remove } from '../controllers/taskController.js';

const router = Router();

router.use(requireAuth);
router.get('/', list);
router.get('/summary', summary);
router.post('/', create);
router.get('/:id', getOne);
router.put('/:id', update);
router.patch('/:id/complete', complete);
router.delete('/:id', remove);

export default router;
