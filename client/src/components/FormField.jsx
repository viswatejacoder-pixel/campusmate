// Label + control + error message. The error is linked with aria-describedby and is text, so it does not rely on colour alone.
// `as` picks the control ('input' by default; T-080 M3 also uses 'select' and 'textarea', with their options passed as children).
export default function FormField({ id, label, error, as: Control = 'input', ...inputProps }) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <Control
        id={id}
        name={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="field-error">
          Error: {error}
        </p>
      )}
    </div>
  );
}
