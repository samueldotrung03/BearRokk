import { BrowserRouter } from 'react-router';
import { AppRoutes } from './AppRoutes.tsx';
import { ModeProvider } from './state/mode.tsx';
import { StudentProvider } from './state/student.tsx';

export function App() {
  return (
    <BrowserRouter>
      <StudentProvider>
        <ModeProvider>
          <AppRoutes />
        </ModeProvider>
      </StudentProvider>
    </BrowserRouter>
  );
}
