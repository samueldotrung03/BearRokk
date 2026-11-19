import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Assistant } from './components/Assistant.tsx';
import { Dock } from './components/Dock.tsx';
import { Spotlight } from './components/Spotlight.tsx';
import './styles/assistant.css';
import './styles/spotlight.css';
import { Agents } from './pages/Agents.tsx';
import { Applications } from './pages/Applications.tsx';
import { Calendar } from './pages/Calendar.tsx';
import { Discover } from './pages/Discover.tsx';
import { Feed } from './pages/Feed.tsx';
import { Profile } from './pages/Profile.tsx';
import { Roadmap } from './pages/Roadmap.tsx';
import { Saved } from './pages/Saved.tsx';
import { SignIn } from './pages/SignIn.tsx';

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <div className="window-drag" aria-hidden="true" />
      {pathname !== '/signin' && <Dock />}
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Assistant />
      <Spotlight />
    </>
  );
}
