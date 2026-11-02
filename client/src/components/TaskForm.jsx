import { useState } from 'react';
import FormField from './FormField.jsx';
import { PRIORITIES } from '../utils/validation.js';
import { describeSaveError, initialTaskFormValues, prepareTaskSubmission } from '../utils/taskForm.js';

const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };

// Create (task = null) or edit form (T-080 M3). Checks the input with the same rules as the server before sending, and shows the
// server's per-field and general errors if it still refuses. `onSubmit(value)` must reject on failure; the parent closes the form
// on success. Every control is disabled while the request is running, and what the student typed is kept after a failure.
export default function TaskForm({ task = null, subjects, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => initialTaskFormValues(task));
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const editing = task !== null;
  const change = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    // subjectId is converted with Number() inside prepareTaskSubmission: the server rejects the text "3".
    const { fields, value } = prepareTaskSubmission(values);
    setFieldErrors(fields);
    if (Object.keys(fields).length > 0) {
      setFormError('Please fix the errors below.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(value);
    } catch (error) {
      const { fields: serverFields, message } = describeSaveError(error);
      setFieldErrors(serverFields);
      setFormError(message);
      setSubmitting(false);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate aria-labelledby="task-form-heading">
      <h3 id="task-form-heading">{editing ? 'Edit task' : 'New task'}</h3>
      {formError && (
        <p role="alert" className="form-error">
          {formError}
        </p>
      )}
      <FormField id="title" label="Title" type="text" autoComplete="off" autoFocus required aria-required="true"
        value={values.title} onChange={change('title')} error={fieldErrors.title} disabled={submitting} />
      <FormField id="description" label="Description (optional)" as="textarea" rows={4}
        value={values.description} onChange={change('description')} error={fieldErrors.description} disabled={submitting} />
      <FormField id="subjectId" label="Subject" as="select" required aria-required="true"
        value={values.subjectId} onChange={change('subjectId')} error={fieldErrors.subjectId} disabled={submitting}>
        <option value="">Select a subject</option>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </FormField>
      <FormField id="dueDate" label="Due date" type="date" required aria-required="true"
        value={values.dueDate} onChange={change('dueDate')} error={fieldErrors.dueDate} disabled={submitting} />
      <FormField id="priority" label="Priority" as="select"
        value={values.priority} onChange={change('priority')} error={fieldErrors.priority} disabled={submitting}>
        {PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {PRIORITY_LABELS[priority]}
          </option>
        ))}
      </FormField>
      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : editing ? 'Save changes' : 'Add task'}
        </button>
        <button type="button" className="task-toggle" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}
