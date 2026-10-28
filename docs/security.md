# Security

Last updated: 2026-10-25 | Status: Planned controls only. **Nothing below has been implemented or verified yet.** Security is never "guaranteed"; this file lists controls, evidence needed, and known risks.

## 1. Controls
| ID | Risk | Planned control | Evidence required |
|---|---|---|---|
| S-1 | Password theft from DB | Hash with bcrypt (`bcryptjs`, cost 10-12); never store/log plaintext | Inspect `users.password_hash` starts with `$2`; grep code/logs for password logging |
| S-2 | SQL injection | Parameterized queries only (`?` placeholders); no string-built SQL; sort columns chosen from a whitelist | Code review checklist; test with input like `' OR 1=1 --` |
| S-3 | Broken access control | `requireAuth` on all private routes; every query filtered by session `user_id`; `user_id` never read from request body | Two-account isolation tests return 404 |
| S-4 | Session hijack/fixation | HttpOnly cookie, `sameSite: 'lax'`, `secure: true` in production, random `SESSION_SECRET`, `req.session.regenerate()` on login, session destroyed on logout, max age 8 h | Inspect cookie flags in DevTools; test old session id after logout |
| S-5 | XSS | Render user text with `textContent`; never `innerHTML` with user data | Test task title `<script>alert(1)</script>` shows as text |
| S-6 | CSRF | `sameSite: 'lax'` cookie; API accepts only `application/json` for state-changing requests; no state change on GET | Document as partial mitigation; no CSRF token in MVP (D-011) |
| S-7 | Secret leakage | Secrets only in `.env`; `.env` git-ignored; `.env.example` has placeholders only | `git ls-files` shows no `.env`; review first commit |
| S-8 | Information leakage | Generic login error; 404 for others' resources; generic 500 message; no stack traces to client; DB user limited to the app database | Trigger errors and inspect responses |
| S-9 | Bad input | Server-side validation of all fields, IDs, enums, lengths; JSON body size limit (e.g. 10kb) | Validation tests in TESTING.md |
| S-10 | Brute-force login | Not in MVP. Optional: rate limit (needs approval of dependency) | Listed as residual risk |

## 2. Production-specific settings (only if hosted, OQ-11)
`NODE_ENV=production`; HTTPS required; `cookie.secure=true`; `app.set('trust proxy', 1)` when behind a proxy; strong unique `SESSION_SECRET`; MySQL not exposed to the internet; consider `helmet` and login rate limiting.

## 3. Known residual risks (to state honestly in the report)
- No password reset and no email verification.
- No login rate limiting or account lockout in MVP.
- CSRF protection relies on SameSite cookies, not tokens.
- Local development runs over HTTP, so cookies are not `secure` there.
- No automated dependency vulnerability scanning beyond running `npm audit` manually.

## 4. Pre-submission security checklist (all unchecked)
- [ ] No secrets in git history (`git log -p` review of first commits)
- [ ] `npm audit` run and results recorded in TESTING.md
- [ ] S-1 to S-9 evidence recorded
- [ ] Cookie flags checked in browser
