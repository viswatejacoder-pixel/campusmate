// Mounted at /api/auth (app.js). Express 5 forwards errors from async handlers to errorHandler automatically.
import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { register, login, logout, me, verifyEmail, resendVerification } from '../controllers/authController.js';
import { env } from '../config/env.js';
import { createRateLimiter, emailKey } from '../middleware/rateLimit.js';

const router = Router();

// In-house rate limits per IP (T-075); counters are in memory. RATE_LIMIT_DISABLED (non-production only) switches them off for test servers.
const MIN = 60 * 1000;
const limit = (opts) => (env.rateLimitDisabled ? (req, res, next) => next() : createRateLimiter(opts));

router.post('/register', limit({ windowMs: 60 * MIN, max: 10 }), register);
router.post('/login', limit({ windowMs: 15 * MIN, max: 10 }), login);
router.post('/verify-email', limit({ windowMs: 15 * MIN, max: 10 }), verifyEmail);
router.post(
  '/resend-verification',
  limit({ windowMs: 15 * MIN, max: 5 }), // per IP
  limit({ windowMs: 15 * MIN, max: 3, key: emailKey }), // per email
  resendVerification,
);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
