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
| S-10 | Brute-force login | Not in MVP. Optional: rate limit (needs approval of dependency) | Listed as residual risk |

## 2. Production-specific settings (only if hosted, OQ-11)
`NODE_ENV=production`; HTTPS required; `cookie.secure=true`; `app.set('trust proxy', 1)` when behind a proxy; strong unique `SESSION_SECRET`; database not exposed to the internet; consider `helmet` and login rate limiting.
Express serves the built client (`client/dist`) when that folder exists (D-020). The cookie `secure` flag follows `NODE_ENV` only, so a **local demo of the built app over plain HTTP must run with `NODE_ENV=development`**; `secure` cookies need HTTPS and would otherwise break login. Never run with `NODE_ENV=development` on a real host.

## 3. Known residual risks (to state honestly in the report)
- No password reset and no email verification.
- No login rate limiting or account lockout in MVP.
- CSRF protection relies on SameSite cookies, not tokens.
- Local development runs over HTTP, so cookies are not `secure` there.
- No automated dependency vulnerability scanning beyond running `npm audit` manually (in both `server/` and `client/`).
- The local database is MySQL 8.4 (D-021). The app never uses `root`; it uses the limited `campusmate_app` user. Keep port 3306 reachable only from your own machine (default MySQL installs listen on all interfaces unless `bind-address` is restricted; checked in SEC-04). Do not use `mysql_native_password` for the app user; MySQL 8.4 disables it by default and the default `caching_sha2_password` works with `mysql2`.

## 4. Pre-submission security checklist (all unchecked)
- [ ] No secrets in git history (`git log -p` review of first commits)
- [ ] `npm audit` run in `server/` and `client/`, results recorded in TESTING.md
- [ ] S-1 to S-9 evidence recorded
- [ ] Cookie flags checked in browser
- [ ] No `VITE_` secrets and no `dangerouslySetInnerHTML` / `innerHTML` in `client/`
- [ ] Database port not reachable from other machines (checked)
