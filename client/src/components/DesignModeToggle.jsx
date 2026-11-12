import { DESIGN_MODES, useDesignMode } from '../context/DesignModeContext.jsx';

// Minimal / Vibrant switch in the dashboard sidebar. It only calls setMode from DesignModeContext (presentation only):
// no navigation, no request, so the session, the route and the loaded data stay as they are. Reuses the theme switch styling.
const LABELS = { minimal: 'Minimal', vibrant: 'Vibrant' };

export default function DesignModeToggle() {
  const { mode, setMode } = useDesignMode();
  return (
    <div className="theme-toggle design-toggle" role="group" aria-label="Design mode">
      {DESIGN_MODES.map((value) => (
        <button key={value} type="button" className="theme-option" aria-pressed={mode === value} onClick={() => setMode(value)}>
          <span className="design-label">{LABELS[value]}</span>
        </button>
      ))}
    </div>
  );
}
