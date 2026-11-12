// T-100 F-3: security headers, no extra dependency.
// CSP (T-100 pass 3): the built client has no inline scripts and loads nothing from other hosts, so scripts are
// 'self' only. 'unsafe-inline' is kept for styles only, because React renders style attributes. It applies only
// when Express serves the built client (the Vite dev server on 5173 is not affected).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export default function securityHeaders(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  // The verification and reset links carry a token in the query string; never leak it via Referer.
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Frame-Options', 'DENY');
  res.set('Content-Security-Policy', CSP);
  // HSTS only when this request really arrived over HTTPS. `trust proxy` is deliberately not set (F-5), so behind a
  // TLS-terminating proxy req.secure is false and the proxy itself must send HSTS. Never sent on plain-HTTP localhost.
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=15552000');
  // API responses (sessions, user data, auth results) must not be cached by browsers or proxies.
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
  next();
}
