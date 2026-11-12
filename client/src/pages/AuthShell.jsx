import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DESIGN_MODES, useDesignMode } from '../context/DesignModeContext.jsx';
import LoginPage from './LoginPage.jsx';
import RegisterPage from './RegisterPage.jsx';
import MinimalLoginPage from './MinimalLoginPage.jsx';
import RegisterPreviewPage from './RegisterPreviewPage.jsx';
import '../styles/authShell.css';

// One shell for /login and /register. It stays mounted while the route or the design mode changes, shows the matching page and
// crossfades between pages (about 340ms). The pages keep their own forms, validation and auth calls: nothing is duplicated here.
export const TRANSITION_MS = 340;
const PAGES = {
  'login:minimal': MinimalLoginPage,
  'login:vibrant': LoginPage,
  'register:minimal': RegisterPreviewPage,
  'register:vibrant': RegisterPage,
};
const MODE_LABELS = { minimal: 'Minimal', vibrant: 'Vibrant' };

export const authKey = (pathname, mode) => `${pathname.startsWith('/register') ? 'register' : 'login'}:${mode}`;

// +1 enters from the right (towards Register / Vibrant), -1 from the left (back to Login / Minimal).
export function transitionDirection(from, to) {
  const [fromView, fromMode] = from.split(':');
  const [toView, toMode] = to.split(':');
  if (fromView !== toView) return toView === 'register' ? 1 : -1;
  return DESIGN_MODES.indexOf(toMode) >= DESIGN_MODES.indexOf(fromMode) ? 1 : -1;
}

// Shows `target` and, when it changes, keeps the old page underneath until the crossfade is over. A change that arrives mid-way is
// held back and played afterwards, so rapid clicks never produce a half-finished or stacked state.
function useStagedKey(target) {
  const [stage, setStage] = useState({ current: target, leaving: null, dir: 1 });
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (stage.leaving || stage.current === target) return;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setStage({ current: target, leaving: null, dir: 1 });
      return;
    }
    setStage({ current: target, leaving: stage.current, dir: transitionDirection(stage.current, target) });
    timer.current = setTimeout(() => setStage((s) => ({ ...s, leaving: null })), TRANSITION_MS);
  }, [target, stage]);
  return stage;
}

export default function AuthShell() {
  const { pathname } = useLocation();
  const { mode, setMode } = useDesignMode();
  const { current, leaving, dir } = useStagedKey(authKey(pathname, mode));
  const keys = leaving ? [leaving, current] : [current];

  return (
    <div className="as-stage" style={{ '--as-dir': dir }}>
      {keys.map((key) => {
        const Page = PAGES[key];
        const isLeaving = key === leaving;
        const state = isLeaving ? ' as-leave' : leaving ? ' as-enter' : '';
        return (
          <div key={key} className={`as-layer as-layer--${key.split(':')[1]}${state}`} inert={isLeaving} aria-hidden={isLeaving ? 'true' : undefined}>
            <Page />
          </div>
        );
      })}
      <div className="ml-mode" role="group" aria-label="Design mode">
        {DESIGN_MODES.map((id) => (
          <button key={id} type="button" className="ml-mode-btn" aria-pressed={mode === id} onClick={() => setMode(id)}>
            {MODE_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  );
}
