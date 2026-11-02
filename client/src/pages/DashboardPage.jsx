import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { ApiError } from '../api/client.js';
import { createSubject, deleteSubject, listSubjects, renameSubject } from '../api/subjects.js';
import { createTask, deleteTask, getTaskSummary, listTasks, setTaskCompleted, updateTask } from '../api/tasks.js';
import { createLatestRequestGuard } from '../utils/latestRequest.js';
import { runMutation } from '../utils/runMutation.js';
import { actionErrorMessage } from '../utils/taskForm.js';
import { EMPTY_FILTERS, createFilterScheduler, hasActiveFilters, totalTaskCount } from '../utils/taskFilters.js';
import SummaryCards from '../components/SummaryCards.jsx';
import FilterBar from '../components/FilterBar.jsx';
import TaskList from '../components/TaskList.jsx';
import SubjectManager from '../components/SubjectManager.jsx';
import TaskForm from '../components/TaskForm.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import '../styles/dashboard.css';

const LOADING = { status: 'loading', subjects: [], tasks: [], summary: null, error: null };

// Show the API's own message for expected failures (network down, server error); never an unexpected error's internals.
const errorText = (error) => (error instanceof ApiError ? error.message : 'Something went wrong while loading your dashboard.');

// What the page shows for one state. Tasks can be created, edited, deleted and completed (M3); subjects can be managed (M4).
// Every M3 prop is optional, so the M2 read-only states still render without them. Exported so states can be checked without a browser.
// `form` is null (closed), { task: null } (new task) or { task } (editing). `busy` means a change request is running.
// Filters (M5): `filters` is the filter bar's draft (null = no bar); `listLoading` / `listError` describe the filtered-list request.
export function DashboardContent({
  status, error, subjects, tasks, summary, onRetry,
  refreshError = null, onRefresh, actionError = '', busy = false, pendingTaskId = null,
  form = null, onNewTask, onEditTask, onToggleTask, onDeleteTask, onSaveTask, onCancelForm,
  deleteTarget = null, deleteError = '', onConfirmDelete, onCancelDelete,
  onCreateSubject, onRenameSubject, onDeleteSubject,
  filters = null, onFilterChange, onResetFilters, listLoading = false, listError = null, onRetryList,
}) {
  if (status === 'loading') return <p role="status">Loading your dashboard...</p>;

  if (status === 'error') {
    return (
      <div className="form-error" role="alert">
        <p>{errorText(error)}</p>
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  const noSubjects = subjects.length === 0;
  const locked = busy || form !== null; // one change at a time: no other task action while a request runs or the form is open
  // The summary counts every task whatever the filters, so it tells "no tasks yet" apart from "tasks exist, none match".
  const noMatch = tasks.length === 0 && totalTaskCount(summary) > 0;
  const showFilters = filters && onFilterChange && onResetFilters && (totalTaskCount(summary) > 0 || hasActiveFilters(filters));
  return (
    <>
      {refreshError && (
        <div className="form-error" role="alert">
          <p>{`The lists could not be refreshed and may be out of date. ${actionErrorMessage(refreshError, '')}`.trim()}</p>
          {onRefresh && (
            <button type="button" onClick={onRefresh} disabled={busy}>
              Refresh
            </button>
          )}
        </div>
      )}

      <SummaryCards summary={summary} />

      <section aria-labelledby="subjects-heading">
        <h2 id="subjects-heading" tabIndex={-1}>Subjects</h2>
        {onCreateSubject && onRenameSubject && onDeleteSubject ? (
          <SubjectManager subjects={subjects} locked={locked || deleteTarget !== null} onCreate={onCreateSubject} onRename={onRenameSubject} onDelete={onDeleteSubject} />
        ) : noSubjects ? (
          <p className="empty-state">You have no subjects yet. Create a subject first (for example, Data Structures), then you can add tasks to it.</p>
        ) : (
          <ul className="subject-list">
            {subjects.map((subject) => (
              <li key={subject.id} className="break-anywhere">
                {subject.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(!noSubjects || tasks.length > 0) && (
        <section aria-labelledby="tasks-heading">
          <div className="section-header">
            <h2 id="tasks-heading" tabIndex={-1}>Tasks</h2>
            {onNewTask && !noSubjects && (
              <button type="button" onClick={onNewTask} disabled={locked}>
                Add task
              </button>
            )}
          </div>
          {actionError && (
            <p role="alert" className="form-error">
              {actionError}
            </p>
          )}
          {form && onSaveTask && (
            <TaskForm key={form.task ? form.task.id : 'new'} task={form.task} subjects={subjects} onSubmit={onSaveTask} onCancel={onCancelForm} />
          )}
          {showFilters && <FilterBar filters={filters} subjects={subjects} onChange={onFilterChange} onReset={onResetFilters} />}
          {listError && (
            <div className="form-error" role="alert">
              <p>{`The task list could not be updated and may not match your filters. ${actionErrorMessage(listError, '')}`.trim()}</p>
              {onRetryList && (
                <button type="button" onClick={onRetryList}>
                  Try again
                </button>
              )}
            </div>
          )}
          {listLoading && (
            <p role="status" className="muted">
              Updating tasks...
            </p>
          )}
          <TaskList
            tasks={tasks}
            noMatch={noMatch}
            locked={locked}
            pendingTaskId={pendingTaskId}
            onToggle={onToggleTask}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
          />
        </section>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this task?"
          message={`"${deleteTarget.title}" will be deleted permanently. This cannot be undone.`}
          confirmLabel="Delete task"
          busyLabel="Deleting..."
          busy={busy}
          error={deleteError}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      )}
    </>
  );
}

// Loads subjects, tasks and the summary together. After logout the auth state becomes anonymous and ProtectedRoute redirects to /login.
export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [data, setData] = useState(LOADING);
  const [guard] = useState(createLatestRequestGuard);
  const [listGuard] = useState(createLatestRequestGuard); // tickets for the task-list request only (filter changes), see fetchTasks
  const [draft, setDraft] = useState(EMPTY_FILTERS); // the filter bar's controls, as typed
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [refreshError, setRefreshError] = useState(null);
  const [actionError, setActionError] = useState('');
  const [form, setForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const busyRef = useRef(false); // synchronous twin of `busy`: a second click in the same tick cannot start a second request
  const mountedRef = useRef(true);
  const returnFocusRef = useRef(null);
  const overlayWasOpen = useRef(false);

  // A filter change reloads only the task list (subjects and summary do not depend on filters). It takes a ticket from listGuard, so
  // a slower answer for an older filter can never replace a newer one; load() and refresh() take list tickets too, because they
  // also fetch the list. On failure the old list stays and a notice is shown.
  const fetchTasks = useCallback(async (filters) => {
    const ticket = listGuard.start();
    setListLoading(true);
    try {
      const tasks = await listTasks(filters);
      if (!listGuard.isCurrent(ticket)) return;
      setData((current) => (current.status === 'ready' ? { ...current, tasks } : current));
      setListError(null);
      setListLoading(false);
    } catch (error) {
      if (!listGuard.isCurrent(ticket)) return;
      setListError(error);
      setListLoading(false);
    }
  }, [listGuard]);

  // Turns draft changes into requests: search text waits for a pause in typing, other controls apply at once, an invalid or
  // unchanged draft sends nothing (utils/taskFilters.js). load() and refresh() read scheduler.applied, the filters last applied.
  const [scheduler] = useState(() => createFilterScheduler({ apply: fetchTasks }));

  // Each load takes a ticket. An answer is used only if its ticket is still the latest, so a retry or an unmount
  // cannot be overwritten (or have state set) by an older, slower request.
  const load = useCallback(async () => {
    const ticket = guard.start();
    listGuard.start(); // an older filter request must not overwrite this load
    setData(LOADING);
    setRefreshError(null);
    setListError(null);
    setListLoading(false);
    try {
      const [subjects, tasks, summary] = await Promise.all([listSubjects(), listTasks(scheduler.applied), getTaskSummary()]);
      if (!guard.isCurrent(ticket)) return;
      setData({ status: 'ready', subjects, tasks, summary, error: null });
    } catch (error) {
      if (!guard.isCurrent(ticket)) return;
      setData({ ...LOADING, status: 'error', error });
    }
  }, [guard, listGuard, scheduler]);

  // After a change: fetch subjects, tasks and the summary again (a subject change can affect all three). Same ticket rule as load().
  // The data on screen is replaced only when all answers arrive; if the refresh fails the old data stays and a notice is shown. Never rejects.
  // It fetches the list with the filters currently applied. If a filter change started a newer list request meanwhile, the
  // subjects and summary are still used but the list is left to that newer request.
  const refresh = useCallback(async () => {
    const ticket = guard.start();
    const listTicket = listGuard.start();
    try {
      const [subjects, tasks, summary] = await Promise.all([listSubjects(), listTasks(scheduler.applied), getTaskSummary()]);
      if (!guard.isCurrent(ticket)) return;
      const listCurrent = listGuard.isCurrent(listTicket);
      setData((current) => (current.status === 'ready' ? { ...current, subjects, summary, ...(listCurrent ? { tasks } : {}) } : current));
      setRefreshError(null);
      if (listCurrent) {
        setListError(null);
        setListLoading(false);
      }
    } catch (error) {
      if (!guard.isCurrent(ticket)) return;
      setRefreshError(error);
      if (listGuard.isCurrent(listTicket)) setListLoading(false);
    }
  }, [guard, listGuard, scheduler]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      guard.invalidate(); // unmounted: every request still in flight becomes stale
      listGuard.invalidate();
      scheduler.dispose(); // and a search waiting for its pause never fires
    };
  }, [load, guard, listGuard, scheduler]);

  // Every draft change goes to the scheduler (the first run, with untouched controls, sends nothing).
  useEffect(() => {
    scheduler.update(draft);
  }, [draft, scheduler]);

  // A subject deleted in the subject manager can no longer be a filter: drop it from the draft so the select and the request agree.
  useEffect(() => {
    if (data.status !== 'ready' || draft.subjectId === '') return;
    if (!data.subjects.some((subject) => String(subject.id) === draft.subjectId)) setDraft((current) => ({ ...current, subjectId: '' }));
  }, [data.status, data.subjects, draft.subjectId]);

  // When the form or dialog closes, focus goes back to the control that opened it, or to the Tasks heading if that control is gone
  // (for example the Delete button of a task that no longer exists).
  const overlayOpen = form !== null || deleteTarget !== null;
  useEffect(() => {
    if (overlayWasOpen.current && !overlayOpen) {
      const opener = returnFocusRef.current;
      const target = opener && opener.isConnected && !opener.disabled ? opener : document.getElementById('tasks-heading');
      if (target) target.focus();
    }
    overlayWasOpen.current = overlayOpen;
  }, [overlayOpen]);

  // Runs one change, then the refresh (runMutation). Rethrows the error so each caller can show it where it belongs.
  async function perform(action, taskId = null) {
    busyRef.current = true;
    setBusy(true);
    setPendingTaskId(taskId);
    try {
      await runMutation(action, refresh);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setBusy(false);
        setPendingTaskId(null);
      }
    }
  }

  const rememberOpener = () => {
    returnFocusRef.current = document.activeElement;
  };

  function openForm(task) {
    if (busyRef.current) return;
    rememberOpener();
    setActionError('');
    setForm({ task });
  }

  // TaskForm shows whatever this throws; on success the form closes.
  async function handleSaveTask(value) {
    if (busyRef.current) throw new Error('Another request is still running.');
    const editing = form ? form.task : null;
    await perform(() => (editing ? updateTask(editing.id, value) : createTask(value)), editing ? editing.id : null);
    if (mountedRef.current) setForm(null);
  }

  async function handleToggleTask(task) {
    if (busyRef.current) return;
    setActionError('');
    try {
      await perform(() => setTaskCompleted(task.id, !task.isCompleted), task.id);
    } catch (error) {
      if (mountedRef.current) setActionError(actionErrorMessage(error, 'Could not update the task. Please try again.'));
    }
  }

  function openDeleteDialog(task) {
    if (busyRef.current) return;
    rememberOpener();
    setActionError('');
    setDeleteError('');
    setDeleteTarget(task);
  }

  function closeDeleteDialog() {
    if (busyRef.current) return;
    setDeleteTarget(null);
    setDeleteError('');
  }

  async function handleConfirmDelete() {
    if (busyRef.current || !deleteTarget) return;
    setDeleteError('');
    try {
      await perform(() => deleteTask(deleteTarget.id), deleteTarget.id);
      if (mountedRef.current) setDeleteTarget(null);
    } catch (error) {
      if (mountedRef.current) setDeleteError(actionErrorMessage(error, 'Could not delete the task. Please try again.'));
    }
  }

  // SubjectManager shows whatever these throw. A subject change refreshes subjects, tasks and summary like any other change.
  async function runSubjectChange(action) {
    if (busyRef.current) throw new Error('Another request is still running.');
    setActionError('');
    await perform(action);
  }
  const handleCreateSubject = (name) => runSubjectChange(() => createSubject(name));
  const handleRenameSubject = (id, name) => runSubjectChange(() => renameSubject(id, name));
  const handleDeleteSubject = (id) => runSubjectChange(() => deleteSubject(id));

  function closeForm() {
    if (busyRef.current) return;
    setForm(null);
  }

  const handleFilterChange = (name, value) => setDraft((current) => ({ ...current, [name]: value }));
  // Clear filters applies at once (no search pause) and also puts sort and order back to the server defaults.
  function handleResetFilters() {
    scheduler.reset();
    setDraft(EMPTY_FILTERS);
  }
  const retryList = () => fetchTasks(scheduler.applied);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
  }

  return (
    <main className="page dashboard">
      <header className="page-header">
        <h1>Dashboard</h1>
        <div className="page-header-user">
          <span>Hello, {user.name}</span>
          <button type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </header>
      <DashboardContent
        {...data}
        onRetry={load}
        refreshError={refreshError}
        onRefresh={refresh}
        actionError={actionError}
        busy={busy}
        pendingTaskId={pendingTaskId}
        form={form}
        onNewTask={() => openForm(null)}
        onEditTask={openForm}
        onToggleTask={handleToggleTask}
        onDeleteTask={openDeleteDialog}
        onSaveTask={handleSaveTask}
        onCancelForm={closeForm}
        deleteTarget={deleteTarget}
        deleteError={deleteError}
        onConfirmDelete={handleConfirmDelete}
        onCancelDelete={closeDeleteDialog}
        onCreateSubject={handleCreateSubject}
        onRenameSubject={handleRenameSubject}
        onDeleteSubject={handleDeleteSubject}
        filters={draft}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        listLoading={listLoading}
        listError={listError}
        onRetryList={retryList}
      />
    </main>
  );
}
