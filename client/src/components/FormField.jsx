// Label + input + error message. The error is linked with aria-describedby and is text, so it does not rely on colour alone.
export default function FormField({ id, label, error, ...inputProps }) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
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
