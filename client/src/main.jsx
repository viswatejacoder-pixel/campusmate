import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { DesignModeProvider, initDesignMode } from './context/DesignModeContext.jsx';
import App from './App.jsx';
import { initTheme } from './utils/theme.js';
import '@fontsource-variable/geist';
import '@fontsource-variable/bricolage-grotesque';
import './styles/theme.css';
import './styles/global.css';
import './styles/design.css';
import './styles/liquid.css';
import './styles/dashboardMinimal.css'; // Minimal design mode for the real app; must load after liquid.css

initTheme(); // sets <html data-theme> before the first paint
initDesignMode(); // and <html data-design> (minimal or vibrant)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <DesignModeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </DesignModeProvider>
    </BrowserRouter>
  </StrictMode>,
);