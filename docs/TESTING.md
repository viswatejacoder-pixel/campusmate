# Testing

Last updated: 2026-10-29 | Status: **Test plan only. No functional test has been run; every case is "Not run" except the partial ENV-06.**

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
| ENV-01 | `GET /api/health` with DB up | 200 `{status: ok}` | Not run |
| ENV-02 | Remove a required env var, start server | Refuses to start with a clear message | Not run |
| ENV-03 | Stop the DB, call health | Safe error, no stack trace | Not run |
| ENV-04 | `SHOW TABLES`; re-run `schema.sql` | Three tables; no error on re-run | Not run |
| ENV-05 | `git ls-files` | No `.env`, `node_modules`, or `client/dist` | Not run |
| ENV-06 | `Get-Service MySQL84`; `SELECT VERSION();` as the app user | Service Running; version 8.4.x | Partial (2026-10-29): service Running and `mysqld --version` = 8.4.13 verified; `SELECT VERSION()` not run |

### Authentication
| ID | Case | Expected | Result |
|---|---|---|---|
| AUTH-01 | Register a valid user | 201, no password hash in response | Not run |
| AUTH-02 | Check `users.password_hash` in the DB | Starts with `$2`, not the password | Not run |
| AUTH-03 | Register the same email again (also with different letter case) | 409 | Not run |
| AUTH-04 | Register with missing fields, bad email, 7-char password | 400 with per-field messages | Not run |
| AUTH-05 | Login correct credentials | 200, session cookie set | Not run |
| AUTH-06 | Login wrong password; login unknown email | Same generic 401 message | Not run |
| AUTH-07 | `GET /api/auth/me` logged in / logged out | 200 / 401 | Not run |
| AUTH-08 | Logout, then reuse the old cookie | 401 | Not run |
| AUTH-09 | Inspect the cookie in DevTools | HttpOnly and SameSite=Lax | Not run |
| AUTH-10 | Malformed JSON body; non-JSON content type | Safe 400 / 415, no stack trace | Not run |

### Subjects
| ID | Case | Expected | Result |
|---|---|---|---|
| SUB-01 | Create, list, rename, delete a subject | Works; list reflects changes | Not run |
| SUB-02 | Duplicate subject name for the same user | 409 or 400 per api-spec | Not run |
| SUB-03 | Same name used by user B | Allowed | Not run |
| SUB-04 | Delete a subject that has tasks | 409 with a clear message | Not run |
| SUB-05 | User B reads/renames/deletes user A's subject | 404 | Not run |

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
| SEC-02 | Search code for string-built SQL, password logging, `innerHTML`, `dangerouslySetInnerHTML`, `VITE_` secrets | No unintended hits | Not run |
| SEC-03 | Review git history for committed secrets | None found | Not run |
| SEC-04 | Database port reachable from another machine? | No | Not run |

## Results log
No test runs yet.

| Date | Scope | Passed | Failed | Not run | Notes |
|---|---|---|---|---|---|
| | | | | | |
