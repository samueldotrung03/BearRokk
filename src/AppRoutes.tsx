import { Navigate, Route, Routes } from 'react-router';
import { Feed } from './components/Feed.tsx';
import { ForYou } from './components/ForYou.tsx';
import { Shell } from './components/Shell.tsx';
import { SimplePage } from './pages/SimplePage.tsx';
import { useBrowseMode } from './state/mode.tsx';

export function AppRoutes() {
  const { mode } = useBrowseMode();
  return (
    <Shell>
      <Routes>
        <Route path="/" element={mode === 'feed' ? <Feed /> : <ForYou />} />
        <Route path="/saved" element={<Feed savedOnly />} />
        <Route path="/roadmap" element={<SimplePage id="roadmap" />} />
        <Route path="/discover" element={<SimplePage id="discover" />} />
        <Route path="/applications" element={<SimplePage id="applications" />} />
        <Route path="/calendar" element={<SimplePage id="calendar" />} />
        <Route path="/agents" element={<SimplePage id="agents" />} />
        <Route path="/settings" element={<SimplePage id="settings" />} />
        <Route path="/profile" element={<SimplePage id="profile" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
