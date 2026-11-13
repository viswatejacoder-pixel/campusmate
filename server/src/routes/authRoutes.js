// Mounted at /api/auth (app.js). Express 5 forwards errors from async handlers to errorHandler automatically.
import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { register, login, logout, me, verifyEmail, resendVerification, forgotPassword, resetPassword } from '../controllers/authController.js';
import { appleBody, callback as oauthCallback, start as oauthStart } from '../controllers/oauthController.js';
import { env } from '../config/env.js';
import { createRateLimiter, emailKey } from '../middleware/rateLimit.js';

const router = Router();

// In-house rate limits per IP (T-075); counters are in memory. RATE_LIMIT_DISABLED (non-production only) switches them off for test servers.
const MIN = 60 * 1000;
const limit = (opts) => (env.rateLimitDisabled ? (req, res, next) => next() : createRateLimiter(opts));

router.post('/register', limit({ windowMs: 60 * MIN, max: 10 }), register);
router.post('/login', limit({ windowMs: 15 * MIN, max: 10 }), login);
router.get('/google/start', oauthStart('google'));
router.get('/google/callback', oauthCallback('google'));
router.get('/apple/start', oauthStart('apple'));
router.post('/apple/callback', appleBody, oauthCallback('apple'));
router.post('/verify-email', limit({ windowMs: 15 * MIN, max: 10 }), verifyEmail);
router.post(
  '/resend-verification',
  limit({ windowMs: 15 * MIN, max: 5 }), // per IP
  limit({ windowMs: 15 * MIN, max: 3, key: emailKey }), // per email
  resendVerification,
);
router.post('/logout', logout);
// Password reset: request (per IP and per email) and token submission (per IP; the 256-bit token cannot be guessed, the limit stops floods).
router.post(
  '/forgot-password',
  limit({ windowMs: 15 * MIN, max: 5 }), // per IP
  limit({ windowMs: 15 * MIN, max: 3, key: emailKey }), // per email
  forgotPassword,
);
router.post('/reset-password', limit({ windowMs: 15 * MIN, max: 10 }), resetPassword);
router.get('/me', requireAuth, me);

export default router;
