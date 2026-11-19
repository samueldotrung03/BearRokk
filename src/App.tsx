import { BrowserRouter, Route, Routes } from 'react-router';
import { Shell } from './components/Shell.tsx';
import { ModeProvider } from './state/mode.tsx';

export function App() {
  return (
    <BrowserRouter>
      <ModeProvider>
        <Shell>
          <Routes>
            <Route path="*" element={<p className="simple" style={{ color: 'white' }}>Opening your recommendations…</p>} />
          </Routes>
        </Shell>
      </ModeProvider>
    </BrowserRouter>
  );
}
