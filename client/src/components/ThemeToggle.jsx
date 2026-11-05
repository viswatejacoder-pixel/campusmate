import { useState } from 'react';
import Icon from './Icon.jsx';
import { applyTheme, currentTheme } from '../utils/theme.js';

// Light / Dark switch in the sidebar (Liquid Glass design). Two real buttons with aria-pressed; the choice is stored by utils/theme.js.
const OPTIONS = [
  ['light', 'Light', 'sun'],
  ['dark', 'Dark', 'moon'],
];

export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);
  function choose(next) {
    applyTheme(next);
    setTheme(next);
  }
  return (
    <div className="theme-toggle" role="group" aria-label="Colour theme">
      {OPTIONS.map(([value, label, icon]) => (
        <button key={value} type="button" className="theme-option" aria-pressed={theme === value} aria-label={`${label} theme`} onClick={() => choose(value)}>
          <Icon name={icon} size={16} />
          <span className="theme-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
