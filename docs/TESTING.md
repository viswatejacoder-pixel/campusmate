# Testing

Last updated: 2026-10-29 | Status: **Environment cases (ENV) mostly Pass; authentication cases AUTH-01 to AUTH-08 and AUTH-10 Pass (automated), AUTH-09 Partial (DevTools check is manual); subject cases SUB-01 to SUB-05 Pass (automated, T-040, uncommitted); every other case is "Not run".**

Scripted auth checks: `server/tests/auth.api.test.js` (Node's built-in `node:test` and `fetch`, no new dependencies). Start the server, then from `server/` run `$env:BASE_URL='http://localhost:3000'; node --test tests/auth.api.test.js` (3000 is the default `PORT`; use the port your server listens on). It creates fake `t030-<timestamp>-<tag>@example.test` accounts in the local development database, logs out its own sessions, deletes nothing, and prints the exact accounts it created plus cleanup SQL at the end. T-030 test data (2026-10-29): run 1 created user ids 1, 5, 6 (7 session rows were left behind by a since-fixed bug); run 2 created ids 7, 11, 12 (no leftovers); run 4 (resume session, output seen) created ids 19, 23, 24 (no leftover session rows). A run 3 was reported but its output was not preserved: its accounts are probably ids 13, 17, 18 (inferred only from the gaps in the id sequence, **not verified**). To remove all of it, in Workbench: first preview what would go, and only continue if every row is a `t030-...@example.test` account:
```sql
SELECT id, email FROM users WHERE id IN (1, 5, 6, 7, 11, 12, 13, 17, 18, 19, 23, 24);
```
Then delete (first the sessions, then the users; the second statement only matches test emails):
```sql
DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') IN (1, 5, 6, 7, 11, 12, 13, 17, 18, 19, 23, 24);
DELETE FROM users WHERE id IN (1, 5, 6, 7, 11, 12, 13, 17, 18, 19, 23, 24) AND email LIKE 't030-%@example.test';
```

## Approach (D-018)
Manual testing with documented cases, no testing dependencies. Optional scripted API checks may use Node's built-in `node:test` and `fetch`. Use fake data only (e.g. `asha.test@example.com`, `ravi.test@example.com`), never real passwords or cookies.

## Evidence rules
- Record for each case: Result (Pass / Fail / Not run), date, and a short note. Fails get a bug note and a re-test date.
- Keep screenshots in `docs/evidence/` named by test ID (e.g. `AUTH-03.png`).
- Never mark a case Pass from memory or because code was written; run it.
- Tools: browser DevTools (Network and Application tabs), or any request tool (Postman, Thunder Client, `curl.exe`). None is a project dependency.
- Run cases against a fresh browser session. Use two accounts (A and B) for isolation cases.

## Test cases
Expected results follow [api-spec.md](api-spec.md) and [PRD.md](PRD.md). Result column starts as Not run.

### Setup and environment
| ID | Case | Expected | Result |
|---|---|---|---|
| ENV-01 | `GET /api/health` with DB up | 200 `{status: ok}` | Pass (2026-10-29): `GET http://localhost:3000/api/health` returned HTTP 200 `{"status":"ok"}` from the author's running server, with `campusmate_app` connected to database `campusmate` (checked by the assistant; `.env` not read) |
| ENV-02 | Remove a required env var, start server | Refuses to start with a clear message | Pass (2026-10-29): missing `DB_NAME` gives exit 1 and a message naming the variable (no values printed); the template placeholder `DB_PASSWORD` is also refused |
| ENV-03 | Stop the DB, call health | Safe error, no stack trace | Pass (2026-10-29): unreachable DB (`ECONNREFUSED`) and refused login (`ER_ACCESS_DENIED_ERROR`) both return 503 `DB_UNAVAILABLE` with no details or stack; only the error code is logged. Tested by pointing at a closed port, not by stopping the service |
| ENV-04 | `SHOW TABLES`; re-run `schema.sql` | Three tables; no error on re-run | Pass (2026-10-29): author applied `server/sql/schema.sql` in MySQL Workbench as `campusmate_app`; `SHOW TABLES` lists `users`, `subjects`, `tasks`; a second run completed without errors (author-reported; not re-run by the assistant, which has no DB credentials) |
| ENV-05 | `git ls-files` | No `.env`, `node_modules`, or `client/dist` | Pass (2026-10-29, after commit `5768206`): no `.env`, `node_modules`, or `client/dist` tracked (`git ls-files`); `server/.env` is ignored (`git check-ignore`); working tree clean |
| ENV-06 | `Get-Service MySQL84`; `SELECT VERSION();` as the app user | Service Running; version 8.4.x | Partial (2026-10-29): service Running and `mysqld --version` = 8.4.13 verified by the assistant; author reports 8.4.13 and that `campusmate_app@localhost` connects. The `SELECT VERSION(), CURRENT_USER();` result as the app user has not been recorded; run it in Workbench and note the output here |

### Authentication
| ID | Case | Expected | Result |
|---|---|---|---|
| AUTH-01 | Register a valid user | 201, no password hash in response | Pass (2026-10-29, automated, `server/tests/auth.api.test.js`): 201 `{user:{id,name,email}}`, no password or hash in the body, session cookie set (register logs in). A messy email (spaces, upper case) was stored trimmed and lower-cased |
| AUTH-02 | Check `users.password_hash` in the DB | Starts with `$2`, not the password | Pass (2026-10-29, automated, read through the app's DB pool; only the prefix was printed): `$2b$12$`, 60 characters, `bcrypt.compare` true, does not contain the password. Optional Workbench cross-check: `SELECT id, email, LEFT(password_hash, 7) AS prefix, CHAR_LENGTH(password_hash) AS len FROM users WHERE email LIKE 't030-%';` |
| AUTH-03 | Register the same email again (also with different letter case) | 409 | Pass (2026-10-29, automated): exact, upper-case-with-spaces, and mixed-case repeats all give 409 `EMAIL_TAKEN`, no cookie, and one row in the DB |
| AUTH-04 | Register with missing fields, bad email, 7-char password | 400 with per-field messages | Pass (2026-10-29, automated): empty object, no body, array body, bad email, `a@b`, SQL-looking email, 7 and 73 characters, 40 emoji (over 72 bytes), 101-character name, blank name, and non-string values all give 400 `VALIDATION_ERROR` with exactly the expected field keys, no cookie, and no account created |
| AUTH-05 | Login correct credentials | 200, session cookie set | Pass (2026-10-29, automated): 200 `{user}`, cookie set, a new session id after login (the old id then gives 401, so the session is regenerated), upper-case email also logs in. AUTH-05b: register regenerates the session the same way |
| AUTH-06 | Login wrong password; login unknown email | Same generic 401 message | Pass (2026-10-29, automated): wrong password and unknown email return identical 401 bodies ("Invalid email or password.") with no cookie; SQL-looking login gives 401; missing or non-text fields give 400; a 72-character password logs in, the same plus extra characters gives 401 (bcrypt truncation guard). Response timing was not measured |
| AUTH-07 | `GET /api/auth/me` logged in / logged out | 200 / 401 | Pass (2026-10-29, automated): 200 with `{id,name,email}` and no hash; no cookie, a garbage cookie, and an empty cookie all give 401 `UNAUTHENTICATED` |
| AUTH-08 | Logout, then reuse the old cookie | 401 | Pass (2026-10-29, automated): logout gives 204 with an empty body and clears the cookie; the `sessions` row is deleted (1 to 0); the old cookie gives 401; logout again, and logout with no cookie, both give 204 |
| AUTH-09 | Inspect the cookie in DevTools | HttpOnly and SameSite=Lax | Partial (2026-10-29): the `Set-Cookie` header was checked automatically: `HttpOnly; SameSite=Lax; Path=/`, no `Secure` in development, lifetime about 8.0 h; with `NODE_ENV=production` behind a simulated HTTPS proxy header `Secure` is added (throwaway script). The DevTools inspection itself is a **manual check** and is not done |
| AUTH-10 | Malformed JSON body; non-JSON content type | Safe 400 / 415, no stack trace | Pass (2026-10-29, automated, on the real auth endpoints): malformed JSON gives 400 `VALIDATION_ERROR` and the body (a fake password) is not echoed; `text/plain` and form bodies give 415; a body over 10 KB gives 413; no stack trace, SQL, or file paths in any response. A body-less POST (`Content-Length: 0`) is accepted: fixed in `requireJson` on 2026-10-29 after the first run returned 415 for it |

### Subjects
Scripted subjects checks: `server/tests/subjects.api.test.js` (`node:test` and `fetch` only). Start the server, then from `server/` run `$env:BASE_URL='http://localhost:3001'; node --test tests/subjects.api.test.js` (use the port your server listens on, and a server started after the last code change; check `$env:NODE_ENV` is not `production`). It creates fake `t040-<timestamp>-<tag>@example.test` accounts and their subjects in the local development database. The tasks API does not exist yet, so one test inserts a single task row directly to prove the 409 and deletes only that row (by id and `user_id`). Nothing else is deleted; at the end it prints the accounts it created and cleanup SQL. T-040 test data (2026-10-29): run 1 created user ids 37 to 49 (13 accounts, 22 subjects, 0 tasks, 0 session rows left). To remove them, in Workbench: preview first, and continue only if every row is a `t040-...@example.test` account:
```sql
SELECT id, email FROM users WHERE id IN (37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49);
```
Then delete in this order (deleting a user also deletes that user's subjects):
```sql
DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') IN (37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49);
DELETE FROM tasks WHERE user_id IN (37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49);
DELETE FROM users WHERE id IN (37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49) AND email LIKE 't040-%@example.test';
```

| ID | Case | Expected | Result |
|---|---|---|---|
| SUB-01 | Create, list, rename, delete a subject | Works; list reflects changes | Pass (2026-10-29, automated, `server/tests/subjects.api.test.js`): create gives 201 `{subject:{id,name}}` (name trimmed, row owned by the caller in the DB); list gives 200 `{subjects}` sorted by name (empty list for a new user); rename gives 200 and the list reflects it; delete gives 204 with an empty body; repeating delete or rename on the removed id gives 404. Also Pass: names of exactly 100 characters (including 100 emoji) are accepted and 101 are rejected; blank, missing, non-text, array-body, and malformed-JSON input gives 400 `VALIDATION_ERROR` (`text/plain` gives 415) and changes nothing; ids `abc`, `0`, `-1`, `1.5`, `1e2`, `01`, `0x1`, `4294967296` give 400 `BAD_ID` and a valid missing id gives 404; SQL-looking, `<script>`, and `100% _wild_ \ "quoted"` names are stored and returned as plain text and the table stays intact; a `userId` in the body is ignored; every subjects route returns 401 with no, garbage, empty, or logged-out cookies and changes nothing |
| SUB-02 | Duplicate subject name for the same user | 409 or 400 per api-spec | Pass (2026-10-29, automated): create with the same name, the name padded with spaces, and the same name in different letter case (`MATH` vs `Math`; the database collation is case-insensitive) all give 409 `SUBJECT_EXISTS` and leave one row; renaming to another of the user's names gives 409 and the subject is unchanged; renaming to its own name, changing only its case, and renaming to a padded new name give 200. Six simultaneous creates of one name gave one 201 and five 409 (one row); four simultaneous renames to one name gave one 200 and three 409 (one row) |
| SUB-03 | Same name used by user B | Allowed | Pass (2026-10-29, automated): user B creates "Shared Name" while user A already has it: 201 with a different id; each user's list shows only their own subjects |
| SUB-04 | Delete a subject that has tasks | 409 with a clear message | Pass (2026-10-29, automated; the task row was inserted directly because the tasks API does not exist yet): 409 `SUBJECT_IN_USE` ("This subject still has tasks. Remove or reassign its tasks first."), the subject and the task are untouched, renaming the in-use subject still works (200), another user deleting it gets 404 (not 409); after the test removed its task row, delete gives 204. Only the composite foreign key `ON DELETE RESTRICT` was exercised; delete-while-a-task-is-being-created concurrency was not tested |
| SUB-05 | User B reads/renames/deletes user A's subject | 404 | Pass (2026-10-29, automated): B's list never contains A's subjects; B renaming or deleting A's ids (including renaming to a name B already owns, and with a forged `userId` in the body) gives the same 404 body as a nonexistent id, so nothing reveals the id exists; A's subjects and names are unchanged afterwards. There is no `GET /api/subjects/:id` endpoint in the spec, so "reads" means the list only |

### Tasks (API)
| ID | Case | Expected | Result |
|---|---|---|---|
| TASK-01 | Create, read, edit, complete, un-complete, delete a task | Works; data persists after a server restart | Not run |
| TASK-02 | Empty title; 151-char title; bad date `2026-02-30`; bad priority | 400 with field errors | Not run |
| TASK-03 | Task with another user's `subjectId` | 400/404, nothing created | Not run |
| TASK-04 | Bad IDs (`abc`, `0`, `-1`); missing ID | 400; 404 | Not run |
| TASK-05 | User B gets/edits/completes/deletes user A's task | 404 each | Not run |
| TASK-06 | User B lists tasks | None of A's tasks appear | Not run |
| TASK-07 | Every private route without a session | 401 | Not run |
| TASK-08 | Summary counts vs data; completed task with a past date | Counts match; not overdue | Not run |
| TASK-09 | Due today / within 3 days / yesterday | Not overdue / due soon / overdue | Not run |

### Filtering and search
| ID | Case | Expected | Result |
|---|---|---|---|
| FIL-01 | Filter by subject, priority, status, each alone | Correct subsets | Not run |
| FIL-02 | Combine filters; date range | AND logic; correct results | Not run |
| FIL-03 | Text search `q` | Matches title/description | Not run |
| FIL-04 | Sort by due date, priority; invalid sort value `title; DROP TABLE tasks` | Valid sorts work; invalid rejected, table intact | Not run |
| FIL-05 | `q` = `' OR 1=1 --` | No extra data returned | Not run |

### Client (React UI)
| ID | Case | Expected | Result |
|---|---|---|---|
| UI-01 | `/api/health` via `http://localhost:5173` | 200 through the proxy; no CORS errors | Not run |
| UI-02 | Register, log in, refresh the page | Still logged in | Not run |
| UI-03 | Log out; open `/dashboard` | Redirected to `/login` | Not run |
| UI-04 | Wrong password / invalid fields | Generic message / per-field messages | Not run |
| UI-05 | Stop the server and use the app | Readable error, not a blank page | Not run |
| UI-06 | Create, edit, complete, delete tasks | List and summary update without a full reload | Not run |
| UI-07 | Delete confirmation, then cancel | Task remains | Not run |
| UI-08 | Past-due task shows an overdue label (text, not colour alone) | Label shown; gone after completing | Not run |
| UI-09 | Filters and the "no tasks found" message | Correct list; message on empty result | Not run |
| UI-10 | Task title `<script>alert(1)</script>` | Shown as plain text, nothing runs | Not run |
| UI-11 | Second user logs in | Sees none of the first user's data | Not run |

### Responsive
| ID | Case | Expected | Result |
|---|---|---|---|
| RES-01 | Login, register, dashboard at 360 px | No horizontal scroll; usable by touch | Not run |
| RES-02 | Same pages at desktop width | Layout correct | Not run |
| RES-03 | Filters reachable on mobile | Yes | Not run |

### Production-style run
| ID | Case | Expected | Result |
|---|---|---|---|
| PROD-01 | `npm run build` in `client/` | Succeeds | Not run |
| PROD-02 | Express serves `client/dist`; refresh on `/dashboard` | App loads; route works | Not run |
| PROD-03 | Unknown `/api/...` path | JSON 404, not `index.html` | Not run |

### Security and dependencies
| ID | Case | Expected | Result |
|---|---|---|---|
| SEC-01 | `npm audit` in `server/` and `client/` | Results recorded; remaining issues explained | Not run |
| SEC-02 | Search code for string-built SQL, password logging, `innerHTML`, `dangerouslySetInnerHTML`, `VITE_` secrets | No unintended hits | Partial (2026-10-29): server side only (no `client/` yet). Every SQL call in `server/src/models/userModel.js` and `subjectModel.js` is `pool.execute` with `?` placeholders (grep of `subjectModel.js` and `subjectController.js` for `execute(`, `query(`, and template placeholders, 2026-10-29); no string-built SQL. Every `console.*` call in `server/src` logs a fixed message or an error code only; none logs a password, hash, or request body. `innerHTML`, `dangerouslySetInnerHTML`, and `VITE_` checks wait for the client |
| SEC-03 | Review git history for committed secrets | None found | Not run |
| SEC-04 | Database port reachable from another machine? | No | Not run |

## Results log
| Date | Scope | Passed | Failed | Not run | Notes |
|---|---|---|---|---|---|
| 2026-10-29 | `auth.api.test.js` run 1 (regression + AUTH-01 to AUTH-10, 12 checks) | 10 | 2 | 0 | AUTH-04 and AUTH-08 failed: a body-less POST (`Content-Length: 0`) got 415 from `requireJson`. Real bug, would have broken logout from a browser; fixed the same day |
| 2026-10-29 | `auth.api.test.js` run 2 (same 12 checks, after the fix) | 12 | 0 | 0 | No leftover session rows. AUTH-09's DevTools inspection remains a manual check |
| 2026-10-29 | `auth.api.test.js` run 3 (previous session) | 12 (reported) | 0 | 0 | Reported as 12 of 12 with no code changes, but the output was not preserved, so it is not counted as evidence. Its test accounts were not recorded (see the cleanup note at the top) |
| 2026-10-29 | `auth.api.test.js` run 4 (resume session, `BASE_URL=http://localhost:3000`, server started after the last code change) | 12 | 0 | 0 | Output seen: regression, AUTH-01 to AUTH-08 (incl. 05b), AUTH-09 header check, AUTH-10. Hash prefix `$2b$12$`, length 60. Cookie: `HttpOnly; SameSite=Lax; Path=/`, no Secure, about 8.0 h. Created ids 19, 23, 24; 0 leftover session rows. AUTH-09 DevTools view still manual |
| 2026-10-29 | `subjects.api.test.js` run 1 (`BASE_URL=http://localhost:3001`, fresh server started after the last code change, `NODE_ENV=development`; 10 test groups covering SUB-01 to SUB-05 plus regression, unauthorized, validation, ids, injection, race) | 10 | 0 | 0 | Output seen. Created user ids 37 to 49 (22 subjects, 0 tasks, 0 session rows left). The auth suite was not re-run after the `app.js` change (only the subjects router was mounted); the subjects run re-checks health, the JSON 404, and `auth/me` |
