# Security

Last updated: 2026-10-29 | Status: Planned controls only. **Nothing below has been implemented or verified yet.** Security is never "guaranteed"; this file lists controls, evidence needed, and known risks.

## 1. Controls
| ID | Risk | Planned control | Evidence required |
|---|---|---|---|
| S-1 | Password theft from DB | Hash with bcrypt (`bcryptjs`, cost 10-12); never store/log plaintext | Inspect `users.password_hash` starts with `$2`; grep code/logs for password logging |
| S-2 | SQL injection | Parameterized queries only (`?` placeholders); no string-built SQL; sort columns chosen from a whitelist | Code review checklist; test with input like `' OR 1=1 --` |
| S-3 | Broken access control | `requireAuth` on all private routes; every query filtered by session `user_id`; `user_id` never read from request body | Two-account isolation tests return 404 |
| S-4 | Session hijack/fixation | HttpOnly cookie, `sameSite: 'lax'`, `secure: true` when `NODE_ENV=production` (HTTPS hosting only), random `SESSION_SECRET`, `req.session.regenerate()` on login, session destroyed on logout, max age 8 h. The Vite proxy and the production build both make the app same-origin, so the cookie is first-party | Inspect cookie flags in DevTools; test old session id after logout |
| S-5 | XSS | The React client renders user text as normal JSX text (React escapes it); `dangerouslySetInnerHTML` and `innerHTML` are never used | Search the code for both terms (no hits); test task title `<script>alert(1)</script>` shows as text |
| S-6 | CSRF | `sameSite: 'lax'` cookie; API accepts only `application/json` for state-changing requests; no state change on GET | Document as partial mitigation; no CSRF token in MVP (D-011) |
| S-7 | Secret leakage | Secrets only in `server/.env`; `.env` git-ignored (`server/.env.example` has placeholders only); the client has no secrets, and nothing sensitive may go in a `VITE_` variable because those are bundled into the browser code; `client/dist/` is git-ignored | `git ls-files` shows no `.env`; search `client/` for `VITE_` and secrets; review first commit |
| S-8 | Information leakage | Generic login error; 404 for others' resources; generic 500 message; no stack traces to client; DB user limited to the app database | Trigger errors and inspect responses |
| S-9 | Bad input | Server-side validation of all fields, IDs, enums, lengths; JSON body size limit (e.g. 10kb) | Validation tests in TESTING.md |
| S-10 | Brute-force login | In-house in-memory rate limits on register, login, verify-email and resend (T-075, D-027); no per-account lockout | Listed as residual risk |
| S-V | Unowned mailbox registering, token theft or replay, enumeration, mail flooding (T-075) | 256-bit random single-use token, only the SHA-256 hash stored, 30-minute expiry, atomic conditional UPDATE, unverified accounts cannot log in (403 only after a correct password), generic 400/202 responses, 60 s resend cooldown, in-house per-IP and per-email rate limits, fixed `APP_BASE_URL` (never the Host header), mail failures logged as a short code only | `auth.verification.test.js`, `auth.ratelimit.test.js`, `rateLimit.test.js`, `mailer.test.js`; DB check that only hashes are stored |

## 2. Production-specific settings (only if hosted, OQ-11)
`NODE_ENV=production`; HTTPS required; `cookie.secure=true`; `app.set('trust proxy', 1)` when behind a proxy; strong unique `SESSION_SECRET`; database not exposed to the internet; consider `helmet` and login rate limiting.
Express serves the built client (`client/dist`) when that folder exists (D-020). The cookie `secure` flag follows `NODE_ENV` only, so a **local demo of the built app over plain HTTP must run with `NODE_ENV=development`**; `secure` cookies need HTTPS and would otherwise break login. Never run with `NODE_ENV=development` on a real host.

## 3. Known residual risks (to state honestly in the report)
- No password reset. Email verification and rate limiting were added in T-075 (2026-11-01, backend; client pending). Remaining limits: the rate-limit counters are in memory (reset on restart, per IP, no proxy support), the verified-email 409 on register still reveals that an address is registered, and the console mail transport (development only, refused in production) prints the link and token to the server console.
- Login is rate limited per IP (10 per 15 minutes, T-075) but there is no per-account lockout.
- CSRF protection relies on SameSite cookies, not tokens.
- Local development runs over HTTP, so cookies are not `secure` there.
- No automated dependency vulnerability scanning beyond running `npm audit` manually (in both `server/` and `client/`).
- `npm audit` (2026-10-29) reports 2 advisories in the `mysql2` (<=3.23.0) that `express-mysql-session@3.0.3` bundles as its own nested dependency: a credential downgrade to a cleartext auth plugin, and a denial of service in the compressed protocol. The app's own `mysql2` is 3.24.6 and not affected, and the session store is given the app's shared pool, so the nested copy is not used to connect (it only loads, see `server/src/config/session.js`). Accepted as a low risk for a local demo (local DB, no compression, no untrusted MySQL server). No `overrides` entry and no `npm audit fix --force` (it would downgrade the session store). Decision D-024 (author, 2026-10-29). Re-run `npm audit` in T-100 and record the result.
- The local database is MySQL 8.4 (D-021). The app never uses `root`; it uses the limited `campusmate_app` user. Keep port 3306 reachable only from your own machine (default MySQL installs listen on all interfaces unless `bind-address` is restricted; checked in SEC-04). Do not use `mysql_native_password` for the app user; MySQL 8.4 disables it by default and the default `caching_sha2_password` works with `mysql2`.

## 4. Pre-submission security checklist (all unchecked)
- [ ] No secrets in git history (`git log -p` review of first commits)
- [ ] `npm audit` run in `server/` and `client/`, results recorded in TESTING.md
- [ ] S-1 to S-9 evidence recorded
- [ ] Cookie flags checked in browser
- [ ] No `VITE_` secrets and no `dangerouslySetInnerHTML` / `innerHTML` in `client/`
- [ ] Database port not reachable from other machines (checked)
