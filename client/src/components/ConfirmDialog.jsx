import { useEffect, useRef } from 'react';

// Modal confirmation (T-080 M3) built on the native <dialog>: showModal() makes the rest of the page inert, keeps Tab inside the
// dialog and moves focus to the first button (Cancel, the safe choice). It is named by its title and described by its message.
// Mount it only while it is needed. While `busy` both buttons are disabled and Escape does nothing; `error` is announced.
export default function ConfirmDialog({ title, message, confirmLabel, busyLabel, busy = false, error = '', onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
    return () => {
      if (dialog && dialog.open) dialog.close();
    };
  }, []);

  // Escape fires "cancel". The browser would close the dialog itself, so always stop that and let the parent decide.
  function handleCancel(event) {
    event.preventDefault();
    if (!busy) onCancel();
  }

  return (
    <dialog ref={ref} className="confirm-dialog" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" onCancel={handleCancel}>
      <h2 id="confirm-dialog-title">{title}</h2>
      <p id="confirm-dialog-message" className="break-anywhere">
        {message}
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="task-toggle" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="button-danger" onClick={onConfirm} disabled={busy}>
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
