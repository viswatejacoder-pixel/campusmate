import { useSearchParams } from 'react-router-dom';
import LoginPage from './LoginPage.jsx';
import MinimalLoginPage from './MinimalLoginPage.jsx';
import '../styles/minimalLogin.css';

// Design experiment at /login-preview. Minimal = the new monochrome page; Vibrant = the existing LoginPage, rendered untouched.
// The mode lives only in the URL (?mode=vibrant). It never touches the global Light/Dark theme or browser storage.
const MODES = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'vibrant', label: 'Vibrant' },
];

export default function LoginPreviewPage() {
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'vibrant' ? 'vibrant' : 'minimal';

  return (
    <>
      {mode === 'vibrant' ? <LoginPage /> : <MinimalLoginPage />}
      <div className="ml-mode" role="group" aria-label="Design mode">
        {MODES.map(({ id, label }) => (
          <button key={id} type="button" className="ml-mode-btn" aria-pressed={mode === id} onClick={() => setParams({ mode: id }, { replace: true })}>
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
