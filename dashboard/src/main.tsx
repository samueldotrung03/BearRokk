import '@fontsource-variable/dm-sans';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router';
import { App } from './App.tsx';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { LiveProvider } from './state/live.tsx';
import { StoreProvider } from './state/StoreProvider.tsx';

// In the macOS desktop app the title bar is hidden; this class makes room for the window buttons.
if (/Electron/.test(navigator.userAgent) && /Mac/.test(navigator.userAgent)) {
  document.documentElement.classList.add('is-desktop');
}

// The desktop app loads the page from a file, where only hash-based routes work.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <StoreProvider>
          <LiveProvider>
            <App />
          </LiveProvider>
        </StoreProvider>
      </AuthProvider>
    </Router>
  </StrictMode>,
);
