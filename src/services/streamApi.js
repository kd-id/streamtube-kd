// Stream API client — communicates with Vite dev server (integrated FFmpeg plugin)
// No separate backend needed — all endpoints served by vite dev server

import { logService, LOG_CATEGORIES } from './logService';

const API_BASE = '/api';

export const streamApi = {
  // Check if FFmpeg plugin is available
  async checkHealth() {
    try {
      logService.debug(LOG_CATEGORIES.NETWORK, 'Checking server health...');
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) {
        logService.warn(LOG_CATEGORIES.NETWORK, 'Health check failed', { status: res.status });
        return { backendOnline: false };
      }
      const data = await res.json();
      logService.info(LOG_CATEGORIES.NETWORK, 'Server online (integrated mode)', data);
      return { backendOnline: true, ...data };
    } catch (err) {
      logService.error(LOG_CATEGORIES.NETWORK, `Health check error: ${err.message}`);
      return { backendOnline: false };
    }
  },

  async checkFfmpeg() {
    try {
      logService.debug(LOG_CATEGORIES.FFMPEG, 'Checking FFmpeg availability...');
      const res = await fetch(`${API_BASE}/ffmpeg/check`);
      const data = await res.json();
      if (data.available) {
        logService.info(LOG_CATEGORIES.FFMPEG, `FFmpeg found: v${data.version}`);
      } else {
        logService.warn(LOG_CATEGORIES.FFMPEG, 'FFmpeg not found', data);
      }
      return data;
    } catch (err) {
      logService.error(LOG_CATEGORIES.FFMPEG, `FFmpeg check error: ${err.message}`);
      return { available: false, error: 'Server not responding' };
    }
  },

  // Upload a file
  async uploadFile(file, onProgress) {
    logService.info(LOG_CATEGORIES.MEDIA, `Uploading file: ${file.name} (${(file.size / 1048576).toFixed(1)} MB)`);
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('streamtube_token');

    const xhr = new XMLHttpRequest();
    return new Promise((resolve, reject) => {
      xhr.open('POST', `${API_BASE}/upload`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
          if (pct === 100) logService.debug(LOG_CATEGORIES.MEDIA, `Upload complete, processing...`);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          logService.info(LOG_CATEGORIES.MEDIA, `File uploaded: ${result.file?.filename}`, result.file);
          resolve(result);
        } else {
          const errMsg = `Upload failed: ${xhr.statusText}`;
          logService.error(LOG_CATEGORIES.MEDIA, errMsg);
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = () => {
        logService.error(LOG_CATEGORIES.MEDIA, 'Upload failed: network error');
        reject(new Error('Upload failed: network error'));
      };
      xhr.send(formData);
    });
  },

  // List uploaded files
  async listFiles() {
    try {
      const res = await fetch(`${API_BASE}/files`);
      return res.json();
    } catch (err) {
      logService.error(LOG_CATEGORIES.MEDIA, `List files error: ${err.message}`);
      return { files: [] };
    }
  },

  // Delete a file
  async deleteFile(filename) {
    logService.info(LOG_CATEGORIES.MEDIA, `Deleting file: ${filename}`);
    const res = await fetch(`${API_BASE}/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    return res.json();
  },

  // Start RTMP stream
  async startStream({ streamId, filename, filePath, playlistData, rtmpUrl, streamKey, bitrate, fps, resolution, loopVideo, sceneData }) {
    logService.info(LOG_CATEGORIES.STREAM, `Starting stream: ${streamId}`, { rtmpUrl, bitrate, fps, resolution, loopVideo });
    try {
      const res = await fetch(`${API_BASE}/stream/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId, filename, filePath, playlistData, rtmpUrl, streamKey,
          bitrate: bitrate || '2500', fps: fps || '30',
          resolution: resolution || '1280x720', loopVideo: loopVideo || false,
          sceneData: sceneData || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        logService.info(LOG_CATEGORIES.STREAM, `Stream started: ${streamId} → ${data.rtmpUrl}`);
      } else {
        logService.error(LOG_CATEGORIES.STREAM, `Stream start failed: ${data.error}`, data);
      }
      return data;
    } catch (err) {
      logService.error(LOG_CATEGORIES.STREAM, `Stream start error: ${err.message}`);
      return { success: false, error: `Server error: ${err.message}` };
    }
  },

  // Stop RTMP stream
  async stopStream(streamId) {
    logService.info(LOG_CATEGORIES.STREAM, `Stopping stream: ${streamId}`);
    try {
      const res = await fetch(`${API_BASE}/stream/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamId }),
      });
      const data = await res.json();
      logService.info(LOG_CATEGORIES.STREAM, `Stream stopped: ${streamId}`);
      return data;
    } catch (err) {
      logService.error(LOG_CATEGORIES.STREAM, `Stop stream error: ${err.message}`);
      return { success: false, error: err.message };
    }
  },

  // Get stream status
  async getStreamStatus(streamId) {
    try {
      const res = await fetch(`${API_BASE}/stream/status/${streamId}`);
      return res.json();
    } catch {
      return { status: 'offline', active: false };
    }
  },

  // Get all active streams
  async getActiveStreams() {
    try {
      const res = await fetch(`${API_BASE}/streams/active`);
      return res.json();
    } catch {
      return { streams: [] };
    }
  },
};
