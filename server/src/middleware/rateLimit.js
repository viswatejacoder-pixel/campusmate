// Small in-memory fixed-window rate limiter (T-075; no dependency). Counters live in this process only and reset on restart.
import AppError from '../utils/AppError.js';

export function createRateLimiter({ windowMs, max, key = (req) => req.ip, maxKeys = 20000, now = Date.now }) {
  const hits = new Map(); // key -> { count, resetAt }
  return function rateLimit(req, res, next) {
    const k = key(req);
    if (k === null || k === undefined) return next(); // nothing to key on (e.g. no email in the body)
    const t = now();
    if (hits.size >= maxKeys) for (const [kk, v] of hits) if (v.resetAt <= t) hits.delete(kk);
    let entry = hits.get(k);
    if (!entry && hits.size >= maxKeys) entry = { count: max + 1, resetAt: t + windowMs }; // memory cap reached: fail closed, do not store
    else if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(k, entry);
    }
    if (hits.has(k)) entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - t) / 1000))));
      return next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.'));
    }
    return next();
  };
}

// Per-email key for the resend limiter; null (no limit) when the body has no usable email.
export const emailKey = (req) => {
  const e = req.body && req.body.email;
  return typeof e === 'string' && e.trim() ? `email:${e.trim().toLowerCase()}` : null;
};
