import { useState } from 'react';

// Password input with a show/hide button. Same label + error markup as FormField (error linked with aria-describedby, text not colour only).
export default function PasswordField({ id, label, error, ...inputProps }) {
  const [shown, setShown] = useState(false);
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          name={id}
          type={shown ? 'text' : 'password'}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-controls={id}
          aria-label={`${shown ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && (
        <p id={errorId} className="field-error">
          Error: {error}
        </p>
      )}
    </div>
  );
}
