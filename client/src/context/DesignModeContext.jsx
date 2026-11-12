import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// The chosen look of the whole product: 'minimal' or 'vibrant'. It is presentation only and never reaches the server or auth.
// Stored under one localStorage key (a mode name, nothing else) and mirrored on <html data-design> so CSS can follow it.
export const DESIGN_MODE_KEY = 'cm-design-mode';
export const DESIGN_MODES = ['minimal', 'vibrant'];
export const DEFAULT_DESIGN_MODE = 'vibrant'; // used only when there is neither a valid URL mode nor a valid saved choice

// Only the two known names are ever accepted, whatever the source (URL, storage, a prop).
export const normalizeDesignMode = (value) => (DESIGN_MODES.includes(value) ? value : null);

function fromUrl() {
  try {
    return normalizeDesignMode(new URLSearchParams(window.location.search).get('mode'));
  } catch {
    return null;
  }
}
function fromStorage() {
  try {
    return normalizeDesignMode(window.localStorage.getItem(DESIGN_MODE_KEY));
  } catch {
    return null;
  }
}
// URL (?mode=vibrant, validated) wins, then the stored choice, then the default.
export const initialDesignMode = () => fromUrl() || fromStorage() || DEFAULT_DESIGN_MODE;

// Called once before the first paint (like initTheme) so the page never flashes the wrong look.
export function initDesignMode() {
  const mode = initialDesignMode();
  document.documentElement.dataset.design = mode;
  return mode;
}

const DesignModeContext = createContext(null);
const FALLBACK = { mode: DEFAULT_DESIGN_MODE, setMode: () => {} }; // components rendered without a provider (tests) stay usable

export function DesignModeProvider({ children }) {
  const [mode, setModeState] = useState(initialDesignMode);

  // Only an explicit choice (switch click, or a valid ?mode in the URL) is saved: the untouched default is never written,
  // so changing the default later still reaches everyone who never chose.
  const save = useCallback((value) => {
    try {
      window.localStorage.setItem(DESIGN_MODE_KEY, value);
    } catch {
      // storage blocked: the choice still lasts for this page session
    }
  }, []);

  const setMode = useCallback((next) => {
    const valid = normalizeDesignMode(next);
    if (!valid) return;
    setModeState(valid);
    save(valid);
  }, [save]);

  useEffect(() => {
    document.documentElement.dataset.design = mode;
  }, [mode]);

  useEffect(() => {
    const fromQuery = fromUrl();
    if (fromQuery) save(fromQuery);
  }, [save]);

  // Another tab changed the mode.
  useEffect(() => {
    const onStorage = (event) => {
      const next = event.key === DESIGN_MODE_KEY ? normalizeDesignMode(event.newValue) : null;
      if (next) setModeState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <DesignModeContext.Provider value={value}>{children}</DesignModeContext.Provider>;
}

export function useDesignMode() {
  return useContext(DesignModeContext) || FALLBACK;
}
