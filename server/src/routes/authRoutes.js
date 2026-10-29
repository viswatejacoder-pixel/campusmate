// Mounted at /api/auth (app.js). Express 5 forwards errors from async handlers to errorHandler automatically.
import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { register, login, logout, me } from '../controllers/authController.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
