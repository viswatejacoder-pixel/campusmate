
import { useEffect, useRef, useState } from 'react';
import FormField from './FormField.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { validateSubjectName } from '../utils/validation.js';
import { describeSubjectError } from '../utils/subjectForm.js';

// Subject list with create, rename and delete (T-080 M4). Names are checked with the same rules as the server (trimmed, 1-100
// characters) before anything is sent. onCreate(name), onRename(id, name) and onDelete(id) must reject on failure: the error is
// shown here (field, SUBJECT_EXISTS and SUBJECT_IN_USE messages come from the API) and what the student typed is kept.
// The parent refreshes the lists and passes `locked` while any other request or form is open. Names render as React text only.
export default function SubjectManager({ subjects, locked = false, onCreate, onRename, onDelete }) {
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [editing, setEditing] = useState(null); // { id, name } while a subject is being renamed
  const [editError, setEditError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [pending, setPending] = useState(null); // 'create' | 'rename' | 'delete' | null
  const pendingRef = useRef(false); // synchronous twin of `pending`: a second submit in the same tick cannot start a second request
  const mountedRef = useRef(true);
  const focusIdRef = useRef(null); // element to focus when the rename form or delete dialog closes
  const busy = locked || pending !== null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // A subject that disappears from the list (deleted elsewhere, found by the refresh after a 404) cannot stay in rename mode:
  // its form is gone and `editing` would keep every Rename and Delete button disabled.
  useEffect(() => {
    if (editing && !subjects.some((subject) => subject.id === editing.id)) {
      setEditing(null);
      setEditError('');
    }
  }, [subjects, editing]);

  // After the rename form or delete dialog closes, focus goes back to the control that opened it, or to the heading if it is gone.
  const overlayOpen = editing !== null || deleteTarget !== null;
  const overlayWasOpen = useRef(false);
  useEffect(() => {
    if (overlayWasOpen.current && !overlayOpen) {
      const target = (focusIdRef.current && document.getElementById(focusIdRef.current)) || document.getElementById('subjects-heading');
      if (target && !target.disabled) target.focus();
    }
    overlayWasOpen.current = overlayOpen;
  }, [overlayOpen]);

  async function run(kind, action) {
    pendingRef.current = true;
    setPending(kind);
    try {
      await action();
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setPending(null);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (pendingRef.current || locked) return;
    const { fields, value } = validateSubjectName({ name: newName });
    if (fields.name) {
      setCreateError(fields.name);
      return;
    }
    setCreateError('');
    try {
      await run('create', () => onCreate(value.name));
      if (mountedRef.current) setNewName('');
    } catch (error) {
      if (mountedRef.current) setCreateError(describeSubjectError(error, 'Could not add the subject. Please try again.'));
    }
  }

  function startRename(subject) {
    if (busy) return;
    focusIdRef.current = `rename-subject-${subject.id}`;
    setEditError('');
    setEditing({ id: subject.id, name: subject.name });
  }

  function cancelRename() {
    if (pendingRef.current) return;
    setEditing(null);
    setEditError('');
  }

  async function handleRename(event, subject) {
    event.preventDefault();
    if (pendingRef.current || locked) return;
    const { fields, value } = validateSubjectName({ name: editing.name });
    if (fields.name) {
      setEditError(fields.name);
      return;
    }
    if (value.name === subject.name) {
      cancelRename(); // nothing changed, nothing to send
      return;
    }
    setEditError('');
    try {
      await run('rename', () => onRename(subject.id, value.name));
      if (mountedRef.current) setEditing(null);
    } catch (error) {
      if (mountedRef.current) setEditError(describeSubjectError(error, 'Could not rename the subject. Please try again.'));
    }
  }

  function openDelete(subject) {
    if (busy) return;
    focusIdRef.current = `delete-subject-${subject.id}`;
    setDeleteError('');
    setDeleteTarget(subject);
  }

  function closeDelete() {
    if (pendingRef.current) return;
    setDeleteTarget(null);
    setDeleteError('');
  }

  async function confirmDelete() {
    if (pendingRef.current || locked || !deleteTarget) return;
    setDeleteError('');
    try {
      await run('delete', () => onDelete(deleteTarget.id));
      if (mountedRef.current) setDeleteTarget(null);
    } catch (error) {
      if (mountedRef.current) setDeleteError(describeSubjectError(error, 'Could not delete the subject. Please try again.'));
    }
  }

  return (
    <>
      <form className="subject-form" onSubmit={handleCreate} noValidate aria-label="Add subject">
        <FormField id="new-subject-name" label="New subject name" type="text" autoComplete="off"
          value={newName} onChange={(event) => setNewName(event.target.value)} error={createError} disabled={busy} />
        <div className="form-actions">
          <button type="submit" disabled={busy}>
            {pending === 'create' ? 'Adding...' : 'Add subject'}
          </button>
        </div>
      </form>

      {subjects.length === 0 ? (
        <p className="empty-state">You have no subjects yet. Create a subject first (for example, Data Structures), then you can add tasks to it.</p>
      ) : (
        <ul className="subject-list subject-manager-list">
          {subjects.map((subject) => (
            <li key={subject.id} className="subject-row">
              {editing && editing.id === subject.id ? (
                <form className="subject-edit" onSubmit={(event) => handleRename(event, subject)} noValidate aria-label={`Rename subject: ${subject.name}`}>
                  <FormField id={`edit-subject-${subject.id}`} label="Subject name" type="text" autoComplete="off" autoFocus
                    value={editing.name} onChange={(event) => setEditing({ id: subject.id, name: event.target.value })}
                    error={editError} disabled={busy} />
                  <div className="form-actions">
                    <button type="submit" disabled={busy}>
                      {pending === 'rename' ? 'Saving...' : 'Save name'}
                    </button>
                    <button type="button" className="task-toggle" onClick={cancelRename} disabled={busy}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <span className="break-anywhere">{subject.name}</span>
                  <span className="task-actions">
                    <button type="button" id={`rename-subject-${subject.id}`} className="task-toggle" disabled={busy || editing !== null}
                      aria-label={`Rename subject: ${subject.name}`} onClick={() => startRename(subject)}>
                      Rename
                    </button>
                    <button type="button" id={`delete-subject-${subject.id}`} className="button-danger" disabled={busy || editing !== null}
                      aria-label={`Delete subject: ${subject.name}`} onClick={() => openDelete(subject)}>
                      Delete
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this subject?"
          message={`"${deleteTarget.name}" will be deleted permanently. Subjects that still have tasks cannot be deleted.`}
          confirmLabel="Delete subject"
          busyLabel="Deleting..."
          busy={pending === 'delete'}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={closeDelete}
        />
      )}
    </>
  );
}
