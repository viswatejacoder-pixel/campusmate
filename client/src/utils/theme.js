// Colour theme (T-095 Liquid Glass): "light" or "dark", kept on <html data-theme>. The choice is remembered in localStorage;
// without one, the system setting decides. Safe to import where there is no window (static render in the tests).
const KEY = 'campusmate-theme';
const valid = (value) => (value === 'light' || value === 'dark' ? value : null);

export function getStoredTheme() {
  try {
    return valid(window.localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function systemTheme() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function currentTheme() {
  if (typeof document !== 'undefined') {
    const set = valid(document.documentElement.dataset.theme);
    if (set) return set;
  }
  return getStoredTheme() || systemTheme();
}

export function applyTheme(theme, remember = true) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (!remember) return;
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    // storage blocked: the choice simply is not remembered
  }
}

export function initTheme() {
  applyTheme(getStoredTheme() || systemTheme(), false);
}
