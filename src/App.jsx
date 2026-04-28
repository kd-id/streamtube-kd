import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/shared/ProtectedRoute';
import Login from './pages/Login';
import OAuthCallback from './pages/OAuthCallback';
import Dashboard from './pages/Dashboard';
import Streams from './pages/Streams';
import Overlays from './pages/Overlays';
import Analytics from './pages/Analytics';
import Monetization from './pages/Monetization';
import Settings from './pages/Settings';
import MediaLibrary from './pages/MediaLibrary';
import Playlist from './pages/Playlist';
import LogViewer from './pages/LogViewer';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/youtube/callback" element={<OAuthCallback />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/streams" element={<Streams />} />
          <Route path="/media" element={<MediaLibrary />} />
          <Route path="/playlist" element={<Playlist />} />
          <Route path="/overlays" element={<Overlays />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/monetization" element={<Monetization />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<LogViewer />} />
        </Route>
      </Route>
    </Routes>
  );
}
