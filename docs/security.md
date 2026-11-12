# Security

## 5.14 Final QA and release-readiness pass (2026-11-12)

T-100 remains **INCOMPLETE** and the project is **not release-ready for hosting**. The second-device LAN check is now recorded as PASS for LAN scope only: host `10.251.164.193`, second device `10.251.164.51`, and ports 3306/33060 both returned `TcpTestSucceeded: False`. Public-internet exposure remains NOT TESTED.

The local representative reverse-proxy check is PASS with limits: production-mode `TRUST_PROXY=1` correctly handled forwarded HTTPS for HSTS/security headers and forwarded client IPs for per-IP limiting (10 invalid login responses 400, then 429 with `Retry-After`, and a second IP independent). A successful authenticated login through that proxy was not run, so the proxy Secure-cookie path remains unverified; authenticated dashboard-page headers, physical-device responsive behavior, hover/focus/reduced-motion rendering outside the measured dashboard states, and production-host deployment remain unverified. `.qa-tmp/` remains preserved and untracked and is now excluded by `.gitignore`; no contents were deleted or changed. D-024 remains accepted: client audit is clean, while the server has the existing 1 high and 1 moderate nested `mysql2` advisories under `express-mysql-session`; no forced or breaking upgrade was attempted.

Final validation evidence: client tests 218/218 and build pass; focused server security tests 23/23 pass; server source syntax and `git diff --check` pass; production-mode startup, `/api/health`, static assets, and `/dashboard` SPA fallback returned 200. Docker was unavailable (`docker` was not found), so no container-based test was claimed. Existing header evidence remains limited to the recorded headless-browser/API and protected-route scope and does not establish authenticated dashboard-page or production-host coverage.

For hosting, use a managed HTTPS reverse proxy in front of the Node/Express service, a persistent private MySQL 8.4-compatible database, host-managed secrets, Brevo outbound HTTPS, and persistent MySQL-backed sessions. Before release, stage the deployment and verify the host's exact proxy hop count, forwarded HTTPS/IP behavior, Secure cookie, HSTS, rate limiting, email delivery, database connectivity, migrations, quotas, and sleep/restart behavior.

Backup/recovery is also a release blocker: the non-destructive runbook is documented in `docs/database.md`, but no restore drill was run because it would require a disposable database and destructive operations were not authorized. The RPO/RTO values remain planning targets, not verified guarantees.

The dependency advisory review found `express-mysql-session@3.0.3 -> mysql2@3.10.2` while the application directly uses `mysql2@3.24.6`. The published session-store package still pins 3.10.2; the audit-suggested fix downgrades the session store to 2.1.8 and is breaking. No unverified override was added. D-024 is therefore a justified temporary acceptance, not a claim that the advisories are fixed.

Last updated: 2026-11-12 (final QA reconciliation) | Status: controls are implemented in code and mostly covered by automated tests (evidence in TESTING.md), but **the T-100 security audit is INCOMPLETE: LAN SEC-04 verification passed but public-internet exposure is untested, two server dependency advisories (1 HIGH, 1 MODERATE) remain accepted under D-024, and authenticated proxy-cookie, full accessibility, physical-device, and restore checks remain outstanding.** Security is never "guaranteed"; this file lists controls, evidence needed, and known risks.

## 1. Controls
| ID | Risk | Planned control | Evidence required |
|---|---|---|---|
| S-1 | Password theft from DB | Hash with bcrypt (`bcryptjs`, cost 10-12); never store/log plaintext | Inspect `users.password_hash` starts with `$2`; grep code/logs for password logging |
| S-2 | SQL injection | Parameterized queries only (`?` placeholders); no string-built SQL; sort columns chosen from a whitelist | Code review checklist; test with input like `' OR 1=1 --` |
| S-3 | Broken access control | `requireAuth` on all private routes; every query filtered by session `user_id`; `user_id` never read from request body | Two-account isolation tests return 404 |
| S-4 | Session hijack/fixation | HttpOnly cookie, `sameSite: 'lax'`, `secure: true` when `NODE_ENV=production` (HTTPS hosting only), random `SESSION_SECRET`, `req.session.regenerate()` on login, session destroyed on logout, max age 8 h. The Vite proxy and the production build both make the app same-origin, so the cookie is first-party | Inspect cookie flags in DevTools; test old session id after logout. Direct-HTTPS `Secure` verified 2026-11-12 (section 5.10); production reverse proxy NOT TESTED |
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
- **Server dependency advisories (T-100 audit; supersedes the 2026-10-29 wording, which gave no severity):** `npm audit` in `server/` reports 2 advisories, **1 HIGH and 1 MODERATE** (the audit evidence used here does not say which of the two below is which), in the nested `mysql2` 3.10.2 (affected range <=3.23.0 per the 2026-10-29 audit) that `express-mysql-session@3.0.3` bundles as its own nested dependency: a credential downgrade to a cleartext auth plugin, and a denial of service in the compressed protocol. The app's own `mysql2` is 3.24.6 and not affected, and the session store is given the app's shared pool, so the nested copy is not used to connect (it only loads, see `server/src/config/session.js`). The earlier 'low risk' wording is outdated now that one advisory is HIGH. They are **not fixed**; they stay accepted for a local demo only under D-024 (local DB, no compression, no untrusted MySQL server). No `overrides` entry and no `npm audit fix --force` (it would downgrade the session store). Decision D-024 (author, 2026-10-29). No dependency was changed in T-100. Possible future investigation only, **untested**: an npm `overrides` entry for the nested `mysql2` (it could break the session store). Never run `npm audit fix --force`.
- The local database is MySQL 8.4 (D-021). The app never uses `root`; it uses the limited `campusmate_app` user. Keep port 3306 reachable only from your own machine (default MySQL installs listen on all interfaces unless `bind-address` is restricted; checked in SEC-04). **T-100 finding SEC-04: remediated and verified locally 2026-11-08 (loopback-only bind, inbound Allow rules disabled); separate-device/external-network verification outstanding, see sections 5.1 and 5.4.** Do not use `mysql_native_password` for the app user; MySQL 8.4 disables it by default and the default `caching_sha2_password` works with `mysql2`.

## 4. Pre-submission security checklist (T-100 final audit 2026-11-08: 4 of 6 ticked; the rest need evidence still outstanding)
- [x] No secrets in git history (`git log -p` review of first commits) (ticked 2026-11-08: pattern-based scan of all 20 commits, branches and tags found no secret; `.env` never tracked; not a dedicated scanner run. Evidence: TESTING.md SEC-03)
- [x] `npm audit` run in `server/` and `client/`, results recorded in TESTING.md (ticked 2026-11-08: recorded, not resolved: 2 server advisories accepted under D-024. Evidence: TESTING.md SEC-01)
- [ ] S-1 to S-9 evidence recorded (NOT ticked: S-1 to S-9 were not individually re-verified in the 2026-11-08 final audit)
- [x] Cookie flags checked in browser (ticked 2026-11-11: real browser, `connect.sid` HttpOnly true, SameSite Lax, Secure false on development HTTP; the production Secure flag over HTTPS is not browser-verified. Evidence: TESTING.md AUTH-09)
- [x] No `VITE_` secrets and no `dangerouslySetInnerHTML` / `innerHTML` in `client/` (ticked 2026-11-08: `git grep` over `client/src` and `server/src` found 0 hits for each; the client `.env` does not exist as a tracked file)
- [ ] Database port not reachable from other machines (checked) (NOT ticked: verified locally on 2026-11-08, but the separate-device/external-network check has not been done)

## 5. T-100 security audit record (documentation pass, 2026-11-08)
Status: **T-100 INCOMPLETE.** Source: the original T-100 audit report; its run date is not in the evidence used here. Nothing else was re-tested while writing this, and this documentation pass made no source, dependency or environment change (the SEC-04 MySQL and firewall changes are recorded in F-1 and section 5.4). **No Tier 1 failure was found**, but the open findings and outstanding checks below keep the section 4 checklist unticked. Security is not guaranteed.

### 5.1 Open findings
| ID | Severity | Status | Finding |
|---|---|---|---|
| F-1 | HIGH (original finding) | **Remediated and verified locally (2026-11-08); external-device verification OUTSTANDING** | Original finding: MySQL listened on `::3306` and inbound firewall rules existed for ports 3306 and 33060; a connection from this machine using its own LAN IP succeeded; external reachability was not confirmed. Remediation: `bind-address` and `mysqlx-bind-address` set to `127.0.0.1,::1`, `MySQL84` restarted, both inbound Allow rules disabled. Local verification passed (section 5.4). A check from a separate device or external network has **NOT** been performed, so this is not recorded as fully closed |
| F-2 | 1 HIGH, 1 MODERATE | Accepted under D-024, **not fixed** | Two `npm audit` advisories in `server/`: nested `mysql2` 3.10.2 pulled in by `express-mysql-session` 3.0.3 (details in section 3). `npm audit fix --force` must not be run; an `overrides` entry is an untested future option only |

### 5.2 Verified (evidence in TESTING.md)
- Automated results from the original T-100 audit: server auth 12/12, email verification 10/10, subjects 10/10, tasks 12/12, mailer and rate-limit unit 8/8, rate-limit suite 5/5; client 154/154. Covered as recorded in TESTING.md: hashed passwords, generic login errors, per-user data isolation (404 for other users' data), server-side validation, injection-style input, token hashing and rate limits.
- `git diff --check` passed; PROD-02/03 API checks passed (API level only).
- Limits: local development server and database, API level, no HTTPS (the production `Secure` cookie flag was only checked through a simulated proxy header), console mail transport, no real-browser security checks.

### 5.3 Not verified
- AUTH-09 browser DevTools cookie check: NOT RUN.
- AUTH-16 expired link and resend with a real email: PASS (2026-11-12, real Brevo flow, limited evidence classification; supersedes the earlier NOT RUN (Partial) and the console-mail PASS (limited) in 5.7, which stay as history). Browser steps user-reported; backend and DB evidence independently verified; see 5.11.
- UI-12 browser-level rate-limit check: NOT RUN (Partial).
- ENV-06 `SELECT VERSION()` as the application DB user: NOT RUN.
- Separate-device/external-network MySQL reachability (SEC-04): NOT RUN (local remediation verified, section 5.4).
- Git-history secret scan (SEC-03): no T-100 result recorded.
- Client `npm audit` as part of T-100: result not recorded here.

### 5.4 SEC-04 local remediation record (verified 2026-11-08)
- MySQL 8.4 `my.ini`, `[mysqld]`: `bind-address=127.0.0.1,::1` and `mysqlx-bind-address=127.0.0.1,::1`. `MySQL84` restarted successfully.
- Listener inspection: only `127.0.0.1` and `::1` on ports 3306 and 33060. Loopback TCP tests to both ports succeeded.
- Both inbound firewall Allow rules (ports 3306 and 33060) were disabled. Tests from this machine to its LAN IP `172.16.32.131` on both ports returned `TcpTestSucceeded: False`.
- The CampusMate backend was restarted and connected successfully without errors.
- Backups preserved: `C:\ProgramData\MySQL\MySQL Server 8.4\my.ini.bak-sec04` and `C:\Users\viswa\sec04-fw-original.xml`.
- No SQL was executed; no database records, tables, schemas, accounts or privileges were modified.
- **Separate-device LAN verification: PASS (2026-11-12), see section 5.13. Public-internet exposure NOT tested.** SEC-04 stays open only for external-network testing; T-100 stays INCOMPLETE.

### 5.5 T-100 final audit record (2026-11-08)
Status: **T-100 INCOMPLETE.** Re-run of safe checks on 2026-11-08; details and counts are in TESTING.md ("T-100 final audit"). No source, dependency, database or system configuration was changed by the audit. This section updates 5.3: ENV-06, SEC-01, SEC-03 and RES-01 to RES-03 now have recorded results (see TESTING.md); AUTH-09 (browser), AUTH-16 (expired link and resend), UI-12 (browser level) and SEC-04 (separate device) are still NOT satisfied.

| ID | Severity | Status | Finding and smallest safe correction |
|---|---|---|---|
| F-3 | Low to medium | Implemented 2026-11-12; PASS (limited scope): unit tests plus headless Edge verification (see 5.9). Text below is the original finding | No security response headers (`X-Content-Type-Options`, CSP, `X-Frame-Options`, HSTS) on the API or the served SPA; `X-Powered-By` is disabled. No helmet, CORS or CSRF middleware exists in `server/src`. Fix: set a few headers in `app.js` or add `helmet` (a dependency change, needs approval) |
| F-4 | Medium (accessibility) | Fixed and re-measured 2026-11-12: PASS for the tested dashboard scope only (112 rendered-pixel measurements, 0 failures; see 5.8). Other pages, hover and focus states not measured. Text below is the original finding | Estimated by sampling screenshot pixels (approximate): on the dashboard at 360 px the secondary task buttons ("Mark complete", "Edit", "Delete") measured about 2.3, 2.3 and 2.8 to 1 in light and 1.6, 1.6 and 2.6 to 1 in dark; the Overdue badge 3.1 (light) and 3.4 (dark); the struck-through completed task title 4.4 (light) and 1.2 (dark). WCAG AA needs 4.5 to 1 for text and 3 to 1 for controls. The dimming may be intentional (a 0.55 alpha was measured). Fix: raise text colour or opacity on those controls and on the dark-theme completed title |
| F-5 | Low (deployment only) | Implemented 2026-11-12 as opt-in `TRUST_PROXY` (default off); tests TP-01 to TP-03 pass; real proxy NOT TESTED (see 5.12). Text below is the original finding | `trust proxy` is not set, so behind a reverse proxy the in-memory rate limiter would key every user to the proxy IP. Matters only if hosted behind a proxy (OQ-11) |
| F-6 | Low | Open | `.qa-tmp/` (133 files: screenshots, backups, scripts) is untracked and not in `.gitignore`; a careless `git add .` would commit it. Add it to `.gitignore` or keep it unstaged |

Verified in this audit (evidence in TESTING.md): unauthenticated access returns 401; malformed, oversized and non-JSON bodies return 400, 413 and 415; unknown API paths return JSON 404; no CORS headers are sent for a foreign origin; rate limits return 429 with `Retry-After` (API level); session cookie options in source are HttpOnly, SameSite=Lax and Secure in production. Residual risks in section 3 are unchanged.

Dependency options for F-2 (nothing applied): keep the accepted risk (D-024); or, with approval, test an npm `overrides` entry that moves the nested `mysql2` to the same version as the top-level `mysql2` 3.24.6 on a copy of the project and run the server suites; do not run `npm audit fix --force`.

### 5.12 F-5 opt-in `TRUST_PROXY` (2026-11-12), implemented; real proxy NOT TESTED

Status: **T-100 INCOMPLETE; not release-ready.** `server/src/config/env.js` accepts `TRUST_PROXY` only as a whole number of hops (1 to 99) or unset; anything else (`true`, `0`, negative, decimal, a name such as `loopback`, 100) stops startup. `server/src/app.js` calls `app.set('trust proxy', hops)` only when set; unset keeps it off (the default, so spoofed `X-Forwarded-*` is never believed locally). `server/.env.example` documents it (blank). Tests `server/tests/trustProxy.test.js` TP-01 to TP-03 pass 3/3 (real app loaded in child processes with a process-level value; no request, no database write, `.env` not read). Not tested: a real TLS-terminating proxy, the production `Secure` cookie behind it, per-user rate limiting behind it. Hosting requirement: set `TRUST_PROXY` to the exact hop count of the chosen host, make the proxy send `X-Forwarded-Proto` and HSTS, then verify login over HTTPS on that host. `server/.env` was not modified; set the value on the host only.

### 5.11 AUTH-16 real-email verification (2026-11-12), PASS (limited evidence classification)

Status: **T-100 INCOMPLETE; not release-ready.** Full assertion table is in TESTING.md ("T-100 AUTH-16 real-email verification"). Security-relevant results: before verification, login returned 403 `EMAIL_NOT_VERIFIED`. User-reported in the browser: the original link was rejected after about 3 hours, the resent link differed, the new link verified the email, the original link stayed rejected after the resend, and reuse of the new link was rejected. Independently verified (read-only): the account row shows `email_verified_at` set with the verification token hash and expiry cleared and the reset token hash NULL; verified login returned 200 with one HttpOnly session cookie and no password, hash or token in the body; `/api/auth/me` returned 200; logout returned 204 and the old cookie then returned 401; `sessions` row count went 5 to 6 to 5 (counts only).

Limits: single account, HTTP on localhost (no HTTPS or proxy); email delivery and all browser outcomes are user-reported; the invalid-link message does not distinguish expired from used links; no token, link or password was accessed or recorded; no `.env` access. This does not complete the remaining security checks (for example SEC-04 from a separate device). The QA account (ID 815) stays in the database; no cleanup SQL was run.

### 5.10 HTTPS session-cookie verification (2026-11-12), PASS (isolated verification)
Status: **PASS for the isolated check; T-100 INCOMPLETE; not release-ready.** Evidence and method are in TESTING.md ("T-100 HTTPS session-cookie verification"). The real app was tested with no code or configuration change: over HTTP the session cookie had no `Secure`; over direct HTTPS (temporary wrapper, self-signed certificate, `NODE_ENV=production`) it had `Secure`. On both: `HttpOnly`, `SameSite=Lax`, `Path=/`, 8.00 h expiry (`Expires` minus response `Date`); `/api/auth/me` returned 200 and logout returned 204 with the cookie cleared. `trust proxy` remains unset.
- **NOT TESTED:** browser `document.cookie` over HTTPS (HttpOnly confirmed from headers only; the earlier HTTP browser check is in TESTING.md AUTH-09), and a real TLS-terminating reverse proxy.
- **Deployment requirement (F-5, unchanged):** `secure` follows `NODE_ENV=production`, not the connection. Behind a TLS-terminating proxy, a `Secure` cookie with `trust proxy` unset is expected not to be sent, so a proxy deployment must set `trust proxy` to the actual hop and forward `X-Forwarded-Proto: https`. Too broad a setting would let clients spoof the protocol and IP. Not configured or tested here.
- **Side effects:** one test account remains in the database; three session rows were created and destroyed through logout.

### 5.9 F-3 security headers: browser verification (2026-11-12), PASS (limited scope)
**Result: PASS (limited scope).** Middleware `server/src/middleware/securityHeaders.js` (unchanged), mounted in `app.js` before the routes and the static client. Evidence: headless Edge over CDP against the live backend on port 3000 (started 17:15, after the middleware's last change, so it ran the latest code; no restart needed), serving the built `client/dist`. No login and no database writes.
- **Headers present (documents `/login` and `/dashboard`; JS, CSS, fonts, favicon; API 200, 401, 404):** `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
- **`Cache-Control`:** `no-store` on every `/api` response (`/api/health` 200, `/api/auth/me` and `/api/tasks` 401, `/api/does-not-exist` 404); documents and static assets `public, max-age=0` (Express default).
- **HSTS:** absent on all HTTP responses, including a curl request with `X-Forwarded-Proto: https` (proxy headers are not trusted; `trust proxy` unset). Present as `Strict-Transport-Security: max-age=15552000` on all 11 responses when the unchanged `app.js` was served over HTTPS (throwaway self-signed certificate, port 3443, stopped afterwards; certificate errors ignored in the test browser only).
- **Browser behaviour:** CSP violations 0; JavaScript exceptions 0; the login page rendered (h1 "Log in", 2 inputs, 3 buttons) over HTTP and HTTPS; `/dashboard` redirected to `/login` when logged out. Console output was only the expected 401 and 404 resource errors. Cross-origin framing of `/login` (embedder: the Vite dev server origin) was blocked: "violates ... `frame-ancestors 'none'`" (`ERR_BLOCKED_BY_RESPONSE`). A first framing attempt from `about:blank` was blocked by the browser's local-network check instead and is not counted.

**Limitations:**
- The logged-in dashboard and the registration flow were not exercised (they write to the database), so a CSP break there is not ruled out; only the login page was loaded.
- HTTPS was tested on a throwaway self-signed server running the real app, not on a production reverse proxy. Behind a TLS-terminating proxy `req.secure` stays false (`trust proxy` is unset on purpose, F-5), so that proxy must send HSTS itself. No trust-proxy or other security setting was changed.
- Headless Edge only; no other browsers or real devices.
- `style-src 'unsafe-inline'` is intentional (React renders style attributes); scripts are `'self'` only. Static assets have no long-term caching.
- Scratch scripts `.qa-tmp/f3-browser.mjs` and `.qa-tmp/f3-https.mjs` were kept; the throwaway key and certificate are in the system temp folder.
T-100 stays INCOMPLETE.

### 5.8 F-4 contrast: fixed and re-measured (2026-11-12), PASS for the tested dashboard scope
**Result: PASS for the tested scope.** 112 rendered-pixel measurements, 0 failures. Scope: the dashboard, Minimal and Vibrant designs, light and dark themes, 360 px and 1280 px. Thresholds: 4.5:1 normal text, 3:1 large text. Method: the real dashboard with a mocked API (fake data, no database); each text element captured normally and with all text transparent, and the rendered text pixel compared with the real background pixel (script `.qa-tmp/t100-contrast.mjs`, scratch). Client tests 218/218 (216 plus 2 guard tests), production build and `git diff --check` pass.

| Finding | Before | After (lowest of the measured cases) | Status |
|---|---|---|---|
| Dimmed task action buttons | about 1.9 to 2.5 | 5.09 (Minimal light, danger) up to 9.72 | PASS |
| Overdue badge (dark) | about 1.1 | 4.96 (Vibrant light) up to 7.95 | PASS |
| Completed task titles | about 1.3 (Vibrant dark), 3.9 (Vibrant light); Minimal light 3.58 measured before the fix | 4.74 (Vibrant dark, 360 px) up to 5.40 | PASS |
| Summary labels | about 2.7 to 2.9 | 4.89 (Vibrant dark) up to 9.55 | PASS |
| Summary counts (large text, 3:1) | about 2.95 | 3.36 (Vibrant dark); other cases 15 to 17 | PASS |
| Dark `dt` and `dd` metadata | about 1.8 to 2.9 | 6.57 (Vibrant dark, 360 px) up to 10.58 | PASS |
| Light-mode eyebrow (earlier fix) | 4.43 and 4.48 | 5.29 and 5.35 rendered (Vibrant light); 7.0 Minimal | PASS |

**CSS changed for F-4 (three files):**
- `client/src/styles/design.css`: the `@media (hover: hover) { .task-actions { opacity: 0.55; } ... }` rule removed (buttons are no longer dimmed at rest).
- `client/src/styles/liquid.css`: `--lg-soft-ink` `#a4a8bd` to `#dcdff0` (dark); `.summary-label` light `var(--lg-faint)` to `var(--lg-text-2)`, dark `rgba(255,255,255,0.55)` to `0.95`; dark `.summary-caption` opacity 0.8 to 1; dark `.task-flag--overdue` solid `#ffd1d5` on `#781428`; dark tasks-panel gradient shortened so the light purple band no longer sits under the metadata text; `--lg-task-title` light `#565b7c` to `#454a6e`, dark `#6c7088` to `#dadeee`; light `.eyebrow` `#4a5078`.
- `client/src/styles/dashboardMinimal.css`: `--lg-task-title` light `#8a8780` to `#6c6a65` (Minimal dark `#8b8984` already measured 4.81 and was unchanged).
In Vibrant dark the completed title is now close to the normal title colour; the line-through is what marks a task as completed.

**Limitations (do not read this as all-app WCAG compliance):**
- Dashboard only, using mocked API data; other pages (login, register, check-email, verify-email, 404, subjects and tasks views if separate) were not measured.
- Completed styling was forced onto the first two task rows (class added in the page) to measure the worst-case gradient position; a genuine completed task from the API was not used.
- Hover and focus states were not measured (the dimming rule only applied on hover-capable devices; hover and focus colours were not checked).
- The guard test `client/tests/f4Contrast.test.js` is a static regression check (no dimming at rest; completed-title colour values). It supplements, and does not replace, the rendered-pixel measurement.
- Measurement was in headless Edge only; the dashboard was not tested with real data or on real devices.

### 5.7 T-100 third pass (2026-11-12), updates to 5.6
Status: **T-100 INCOMPLETE; not release-ready.** F-3: `server/src/middleware/securityHeaders.js` sets nosniff, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, a self-only CSP (styles also allow inline for React style attributes) and `no-store` on `/api`; HSTS only when `req.secure` is true, never on plain HTTP; unit tests H-01 to H-04 pass (browser verification was done later the same day: see 5.9, PASS limited scope). F-4: the light-mode `.eyebrow` colour was changed to `#4a5078` (was 4.43 and 4.48 to 1); about 5.3 to 1 by calculation from the measured background, not re-measured (PASS limited). The other F-4 items in 5.6 (dimmed task buttons, overdue badge, completed titles, summary labels and counts, dark `dt` and `dd`) were OPEN at this point and were fixed and re-measured later the same day: see section 5.8 (PASS for the tested dashboard scope). `trust proxy` was not changed (F-5 unchanged). SEC-04: **INCONCLUSIVE**, no second device available; MySQL binding and firewall were not changed. AUTH-16 (user-reported, earlier 2026-11-12 session, console mail, 31-minute wait): **PASS (limited)**. The original link returned HTTP 400 after 31 minutes, resend 202, new link verified 200, old and reused links 400, login 200. The response body was not captured, so the expiry-specific error was not proven. The real-email variant was not run.

### 5.6 T-100 second pass (2026-11-11)
Status: **T-100 INCOMPLETE.** Results are in TESTING.md ("T-100 final audit, second pass"): the four database-writing server suites passed 44/44 on an authorized rerun with the isolation inspected first; AUTH-09, UI-12 and PROD-02 passed in a real browser. Still not satisfied: AUTH-16 (genuine expired link and resend, needs the user), SEC-04 (separate device, needs the user), the production `Secure` cookie flag over HTTPS, and real-device responsive testing. No application code, configuration or `.env` was changed.

**F-4 confirmed (independent measurement, 360 px, headless Edge).** For each text element the page was captured twice (normal, and with all text made transparent) and the rendered text pixel was compared with the real background pixels. Ratios below are rendered contrast against WCAG AA 4.5 to 1 for normal text. Data came from the mock API fixture, so the exact tasks differ from real data, but the CSS selectors and colours are the real ones. The 1280 px capture was unreliable (the two captures did not line up) and is not used.
- `design.css:151`: `@media (hover: hover) { .task-actions { opacity: 0.55; } }` dims "Mark complete", "Mark incomplete", "Edit" and "Delete" at rest on devices with a mouse (back to 1 on `.task-item:hover` and `:focus-within`). Rendered: about 2.4 to 1 (`.button-danger`, light), 2.5 to 1 (`.task-toggle`, light), 1.9 to 1 (`.task-toggle`, dark). A phone (`hover: none`) is not affected, so the earlier 360 px emulation exaggerated this on touch devices. Without the opacity the light-theme colours are about 5 to 1 or better.
- `.task-flag--overdue` (dark theme, colour `rgb(239, 85, 96)`): about 1.1 to 1 against the purple panel. This is the most serious one.
- Completed `.task-title` (dark, `rgb(108, 112, 136)`): about 1.3 to 1; light theme about 3.9 to 1.
- `.summary-card .summary-label`: about 2.9 to 1 (light, `rgb(122, 127, 160)`) and 2.7 to 1 (dark, `rgba(255, 255, 255, 0.55)` on the warm card); `.summary-count` large text about 2.95 to 1 on the dark warm card (needs 3 to 1).
- Dark theme `dt` and `dd` meta text (`rgb(212, 216, 234)`): about 1.8 to 2.9 to 1 where the panel gradient is light purple.
- `.eyebrow` (`rgb(86, 92, 128)`): about 4.2 to 1 in both themes (marginal).
Smallest safe correction: remove or soften the 0.55 dimming (or keep full opacity at rest), darken or lighten the listed colours until each reaches 4.5 to 1, and give the dark-theme overdue badge a solid readable background. Not applied.

**F-3 (security headers), what to add before any deployment.** `X-Content-Type-Options: nosniff` (always); `Referrer-Policy: no-referrer` or `same-origin` (the verification link carries its token in the query string, so a Referer header could leak it); `Content-Security-Policy` such as `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'` (test against the built client first; the Vite dev server needs different rules); `X-Frame-Options: DENY` (or the `frame-ancestors` above); `Cache-Control: no-store` on `/api/auth/*` responses; `Strict-Transport-Security` only when actually served over HTTPS (never on plain HTTP localhost). For the local demo (OQ-11) these are low priority; the first three are cheap and worth having. Implementation (a few `res.set` lines or `helmet`) needs your approval.

**F-5 (`trust proxy`).** Not needed for the planned local demo, where Express is reached directly (OQ-11, D-020); setting it there would let a client spoof `X-Forwarded-For` and dodge the IP rate limits. It becomes necessary only if the app is hosted behind a proxy or platform that terminates TLS (then `app.set('trust proxy', 1)` for a single proxy hop, so `req.ip` is the real client, rate limiting works per user and the production `Secure` cookie is set correctly). Decide together with the hosting choice.

**F-6 (`.qa-tmp/`).** Do not delete it. Safest handling: add `.qa-tmp/` to `.git/info/exclude` (local to this clone, does not change any tracked file) or, with your approval, to `.gitignore`; stage files by explicit path, never `git add .` or `git add -A`; if the evidence must be shared or submitted, copy selected files out of the repo after reviewing them for private data (names only were inspected, not contents).
