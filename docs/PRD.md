# Product Requirements Document (PRD)

Last updated: 2026-10-25 | Status: Draft for faculty proposal (26 Oct 2026)

## 1. Overview
CampusMate is a responsive web application where a student keeps a personal list of academic tasks (assignments, lab records, exam prep) organized by subject, with deadlines and priorities. It is standalone: it does not connect to any university system.

## 2. Problem and users
Students track deadlines across many subjects in scattered notes and chats and miss or forget work. **Primary user:** a college student on a phone or laptop managing their own workload. Each account is fully private.

## 3. Goals and non-goals
**Goals:** a reliable MVP that a student can register for, log into, and use daily; data persists in MySQL; code and docs the author can fully explain in a viva.
**Non-goals (not approved, do not build):** attendance, institutional/LMS integration, collaboration or sharing, AI recommendations, email/push notifications, file attachments, recurring tasks, admin panel.

## 4. Definitions
- **Pending:** task not completed (overdue tasks are also pending).
- **Overdue:** not completed and `due_date` earlier than today.
- **Due soon:** not completed and due today or within the next 3 days (window is a proposed constant, OQ-6).
- **Today:** the server's current date (timezone assumption: OQ-10).

## 5. Functional requirements and acceptance criteria (MVP)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-1 | Registration | Name, email, password submitted. Valid input creates an account and the stored value is a bcrypt hash, never plaintext. Duplicate email is rejected with a clear message. Invalid fields show per-field errors. Password shorter than 8 characters is rejected. |
| FR-2 | Login | Correct credentials start a session and open the dashboard. Wrong email or password gives one generic error and no session. Session cookie is HttpOnly. Protected API calls without a session return 401. |
| FR-3 | Logout | Session is destroyed on the server. Afterwards `GET /api/auth/me` returns 401 and the dashboard redirects to login. |
| FR-4 | Dashboard | Logged-in student sees their name, summary counts, and only their own tasks. |
| FR-5 | Subjects | Student can create, rename, and delete their own subjects. Names are unique per student. Deleting a subject that still has tasks is refused with a clear message. |
| FR-6 | Create task | Title (required), subject (required), due date (required), priority (low/medium/high, default medium), description (optional). New task appears in the list without a full page reload. |
| FR-7 | View tasks | Task list shows title, subject, due date, priority, status. Opening a task shows its description. |
| FR-8 | Edit task | Any field can be changed and saved with the same validation as create. Editing a non-existent or another user's task fails (404). |
| FR-9 | Delete task | Requires a confirmation step. Task is permanently removed and the list/summary update. |
| FR-10 | Complete task | A task can be marked complete and un-completed. Summary counts update. |
| FR-11 | Search and filter | Filter by subject, priority, status (all/pending/completed/overdue) and due-date range; search title and description. Filters combine (AND). Sort by due date or priority. Empty results show a "no tasks found" message. |
| FR-12 | Deadline indicators | Overdue tasks are visibly marked; due-soon tasks are visibly marked; completed tasks are never marked overdue. Indicator is not colour-only (text/label too). |
| FR-13 | Summary | Dashboard shows counts of pending, completed, overdue (and due soon) that match the stored data. |
| FR-14 | Responsive UI | Usable at 360 px width and on desktop; no horizontal scrolling; buttons usable by touch. |
| FR-15 | Validation and errors | Server validates every input (type, length, enum, date format, IDs). Frontend shows readable messages. Invalid IDs, expired sessions, and DB failures return safe errors with no stack traces or SQL. |
| FR-16 | Persistence | Data is still present after restarting the server. |
| FR-17 | User isolation | A student can never read, edit, complete, or delete another student's tasks or subjects, verified with two test accounts. |

## 6. Non-functional requirements
- **Security:** see [security.md](security.md) (hashed passwords, server-side sessions, parameterized SQL, server-side authorization).
- **Simplicity:** minimal dependencies, readable code, no frontend framework.
- **Reliability:** common failure cases handled; app does not crash on bad input.
- **Browsers:** current Chrome and Edge (primary), Firefox, mobile Chrome.
- **Performance:** adequate for one student's data (hundreds of tasks); no pagination in MVP.

## 7. Assumptions
Runs locally (deployment not required unless confirmed, OQ-11). Single timezone. English UI. No password reset in MVP (documented limitation).

## 8. Optional future enhancements (NOT approved, only after MVP is done and approved by the author)
Pagination; CSV export; dark mode; password reset by email; account deletion; rate limiting on login.
