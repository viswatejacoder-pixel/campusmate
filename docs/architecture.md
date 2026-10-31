# Architecture

Last updated: 2026-10-30 | Status: Design; the server API (T-030 to T-050) and the client scaffold (T-060) are implemented, the UI pages are not. Revised for React + Vite (see DECISIONS D-014 to D-020).

## 1. Overview
One repository, two parts:
- `client/`: a React single-page app built with Vite. It renders the UI and talks to the API with `fetch`.
- `server/`: a Node.js/Express JSON API under `/api`, backed by MySQL 8.4 (D-021) holding users, subjects, tasks, and sessions.

In development the two run as separate processes. The Vite dev server (port 5173) serves the React app and **proxies `/api` to Express (port 3000)**, so the browser sees a single origin. That means no CORS setup is needed and the session cookie stays first-party.

```
Browser (React app)
   |  fetch('/api/...') JSON, session cookie
   v
Vite dev server :5173  --- proxy /api --->  Express :3000
                                              |- /api routes -> middleware -> controllers -> models -> mysql2 pool
                                              v
                                            MySQL (users, subjects, tasks, sessions)
```
For a production build, `vite build` produces `client/dist` and Express serves it on the same port (D-020), so one process serves both the app and the API. This is designed but not yet tested (T-110).

## 2. Proposed directory structure
```
campusmate/
  .gitignore  README.md
  docs/                        (documentation pack + docs/evidence/ for screenshots)
  client/
    package.json  vite.config.js  index.html
    src/
      main.jsx                 (mounts <App/>, wraps router + AuthProvider)
      App.jsx                  (route table)
      pages/
        LoginPage.jsx  RegisterPage.jsx  DashboardPage.jsx  NotFoundPage.jsx
      components/
        ProtectedRoute.jsx  SummaryCards.jsx  FilterBar.jsx
        TaskList.jsx  TaskItem.jsx  TaskForm.jsx
        SubjectManager.jsx  ConfirmDialog.jsx  FormError.jsx
      context/
        AuthContext.jsx        (current user + login/logout helpers)
      api/                     (plain JS, no React)
        client.js              (fetch wrapper: JSON, error mapping, 401 handling)
        auth.js  subjects.js  tasks.js
      utils/                   (plain JS, no React)
        dates.js               (formatting, overdue/due-soon display helpers)
        validation.js          (client-side checks, UX only)
      styles/
        global.css  (plus one CSS file per page/component as needed)
  server/
    package.json  .env.example
    sql/
      schema.sql               (tables; safe to re-run)
      seed.sql                 (optional demo data, fake users only)
    src/
      server.js                (loads env, starts listening)
      app.js                   (builds Express app; serves client/dist when present, D-020)
      config/
        env.js  db.js  session.js
      routes/
        auth.routes.js  subjects.routes.js  tasks.routes.js
      controllers/
        auth.controller.js  subjects.controller.js  tasks.controller.js
      models/                  (all SQL lives here, parameterized)
        user.model.js  subject.model.js  task.model.js
      middleware/
        requireAuth.js  errorHandler.js  notFound.js
      validators/              (pure functions: input -> errors or clean data)
        auth.validator.js  subject.validator.js  task.validator.js
      utils/
        httpError.js           (AppError class with status + code)
  tests/
    manual/                    (manual test sheets, see TESTING.md)
```
Note: `.env.example` now lives in `server/` and `client/dist/` is git-ignored (both done 2026-10-28, OQ-15).

## 3. Layer responsibilities
**Server**
| Layer | Does | Must not |
|---|---|---|
| Routes | Map URL + method to middleware and controller | Contain logic |
| Middleware | Auth check, error handling, 404 | Query the DB for business data |
| Validators | Check and clean input | Touch DB or `req`/`res` |
| Controllers | Read request, call validator and model, send response | Write SQL |
| Models | Parameterized SQL, always scoped by `user_id` | Know about HTTP |

**Client**
| Layer | Does | Must not |
|---|---|---|
| Pages | Compose components for one route, own the page's data loading | Call `fetch` directly |
| Components | Render UI, handle events, show errors | Contain API URLs or business rules |
| `context/AuthContext` | Hold the current user, expose login/logout | Be treated as a security boundary |
| `api/` | The only place that calls `fetch`; returns data or throws a readable error | Import React |
| `utils/` | Pure helpers (dates, validation) | Import React or call the API |

## 4. Request lifecycle (example: saving an edited task, `PUT /api/tasks/5`)
1. `TaskForm` runs client-side checks (UX only) and calls `updateTask(5, data)` from `api/tasks.js`.
2. `api/client.js` sends `PUT /api/tasks/5` with JSON. In dev the Vite proxy forwards it to Express.
3. Session middleware loads the session from the cookie; `requireAuth` returns 401 if no `userId` is in the session.
4. Controller runs the task validator; 400 with field errors if invalid.
5. Model runs `UPDATE ... WHERE id = ? AND user_id = ?`; zero rows affected means 404 (covers both missing and someone else's task).
6. Controller returns the updated task as JSON; any thrown `AppError` goes to `errorHandler`.
7. The page updates its state; React re-renders the list and summary. On a 401, the API client clears the auth state and the user is sent to `/login`.

## 5. Frontend conventions
- Function components and hooks only. State lives in `useState`/`useReducer` inside pages, plus one `AuthContext`. No Redux or other state library.
- Routes (`react-router-dom`): `/login`, `/register`, `/dashboard` (protected), `/` redirects to `/dashboard` or `/login`, anything else shows a not-found page.
- On app load the client calls `GET /api/auth/me` to learn whether a session exists. `ProtectedRoute` redirects to `/login` when it does not. **This is a convenience only**; the server enforces access on every API call.
- The task list filters are sent to the server as query parameters (see api-spec); the client does not filter the full list itself.
- Render user text as normal JSX text (React escapes it). `dangerouslySetInnerHTML` is not used anywhere.
- Plain JavaScript (`.js`/`.jsx`), not TypeScript. Plain CSS files, no CSS framework or UI component library, unless approved.
- No secrets in the client. Only variables prefixed `VITE_` are exposed to the browser bundle, and none are planned.
- Client code uses ES modules (required by Vite).

## 6. Server conventions
- Naming: files `kebab-or-dot.case.js`, functions `camelCase`, DB columns `snake_case`, JSON fields `camelCase` (models map between them). React component files use `PascalCase.jsx`.
- Errors: throw `AppError(status, code, message, fields?)`; one `errorHandler` formats `{ "error": {...} }`. Unknown errors become a generic 500; details go to the server log only.
- `mysql2` pool uses `dateStrings: true` so DATE columns come back as `"YYYY-MM-DD"` strings, avoiding timezone shifts.
- Server code uses ES modules (`import`/`export`, `"type": "module"`), like the client (D-023, proposed default).

## 7. Dependencies (approved 2026-10-28; see DECISIONS D-008, versions D-022)
- `server/` runtime: `express`, `mysql2`, `express-session`, `express-mysql-session`, `bcryptjs`, `dotenv`. Auto-restart in development uses Node's built-in `node --watch`; no extra package.
- `client/` runtime: `react`, `react-dom`, `react-router-dom`. Dev: `vite`, `@vitejs/plugin-react`.
- No ORM, no UI library, no testing library (D-018). Any other package needs a new approval.

## 8. Running locally (planned; will be verified in T-110)
Development: two terminals, `cd server && npm run dev` (port 3000) and `cd client && npm run dev` (port 5173). Open `http://localhost:5173`. A single root command that starts both would need an extra package, so it is not planned.
Production-style run: `cd client && npm run build`, then `cd server && npm start`; Express serves `client/dist` and the API together on port 3000 (D-020). For a local demo over plain HTTP keep `NODE_ENV=development` (see security.md section 2).

## 9. Deployment
Primary target is local run for demo. If hosting is required (OQ-11), production settings are listed in [security.md](security.md).
