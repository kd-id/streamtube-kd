import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { YouTubeProvider } from './hooks/useYouTubeStore';
import { StreamProvider } from './hooks/useStreamStore';
import { MediaProvider } from './hooks/useMediaStore';
import { PlaylistProvider } from './hooks/usePlaylistStore';
import { LogProvider } from './hooks/useLogStore';
import { OverlayProvider } from './hooks/useOverlayStore';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <LogProvider>
        <AuthProvider>
          <YouTubeProvider>
            <MediaProvider>
              <PlaylistProvider>
                <StreamProvider>
                  <OverlayProvider>
                    <App />
                  </OverlayProvider>
                </StreamProvider>
              </PlaylistProvider>
            </MediaProvider>
          </YouTubeProvider>
        </AuthProvider>
      </LogProvider>
    </BrowserRouter>
);
