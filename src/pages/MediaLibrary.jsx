import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Music, FolderOpen, Trash2, Search, Grid, List,
  HardDrive, Film, FileAudio, X, Tag,
  Play, Eye, AlertCircle, CheckCircle2, Video, ImageIcon
} from 'lucide-react';
import Modal from '../components/shared/Modal';
import { useMedia } from '../hooks/useMediaStore';
import { streamApi } from '../services/streamApi';
import './MediaLibrary.css';

const CATEGORIES = [
  { id: 'all', label: 'Semua', icon: FolderOpen },
  { id: 'video', label: 'Video', icon: Film },
  { id: 'music', label: 'Musik', icon: FileAudio },
  { id: 'image', label: 'Gambar', icon: ImageIcon || FolderOpen },
  { id: 'intro-outro', label: 'Intro/Outro', icon: Play },
  { id: 'overlay', label: 'Overlay', icon: Grid },
  { id: 'background', label: 'Background', icon: Video },
];

const UPLOAD_TABS = [
  { id: 'video', label: '🎬 Video', accept: '.mp4,.mkv,.mov,.avi,.webm', formats: 'MP4, MKV, MOV, AVI, WEBM', mime: 'video/' },
  { id: 'audio', label: '🎵 Audio', accept: '.mp3,.wav,.flac,.ogg,.aac,.m4a', formats: 'MP3, WAV, FLAC, OGG, AAC, M4A', mime: 'audio/' },
  { id: 'image', label: '🖼️ Gambar', accept: '.jpg,.jpeg,.png,.webp,.gif', formats: 'JPG, PNG, WEBP, GIF', mime: 'image/' },
];

const MUSIC_GRADIENT = 'linear-gradient(135deg, #2dd4a8 0%, #4d8eff 100%)';
const VIDEO_GRADIENT = 'linear-gradient(135deg, #4d8eff 0%, #a855f7 100%)';
const IMAGE_GRADIENT = 'linear-gradient(135deg, #ffc144 0%, #ff3b5c 100%)';

// ─── Generate video thumbnail ───
function useVideoThumbnail(file) {
  const [thumb, setThumb] = useState(null);
  useEffect(() => {
    if (file.type !== 'video' || !file.objectUrl) return;
    let cancelled = false;
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    video.src = file.objectUrl;
    video.addEventListener('loadedmetadata', () => { video.currentTime = Math.min(video.duration * 0.1, 1); });
    video.addEventListener('seeked', () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 180;
        canvas.getContext('2d').drawImage(video, 0, 0, 320, 180);
        setThumb(canvas.toDataURL('image/jpeg', 0.8));
      } catch {}
    });
    return () => { cancelled = true; video.src = ''; };
  }, [file.objectUrl, file.type]);
  return thumb;
}

// ─── File Card ───
function FileCard({ f, onPreview, onDelete, onCategoryEdit, editingCategory, onCategoryChange }) {
  const thumb = useVideoThumbnail(f);
  const getExt = (name) => name.split('.').pop().toUpperCase();
  const isImage = f.type === 'image' || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name);

  return (
    <div className="glass-card file-card">
      <div
        className={`file-thumb ${f.type}`}
        style={
          isImage && f.objectUrl ? { backgroundImage: `url("${f.objectUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } :
          thumb ? { backgroundImage: `url("${thumb}")`, backgroundSize: 'cover', backgroundPosition: 'center' } :
          { background: f.type === 'video' ? VIDEO_GRADIENT : isImage ? IMAGE_GRADIENT : MUSIC_GRADIENT }
        }
      >
        {!thumb && !isImage && (f.type === 'video' ? <Film size={20} strokeWidth={1.5} /> : <Music size={20} strokeWidth={1.5} />)}
        {f.duration && f.duration !== '0:00' && <span className="file-duration">{f.duration}</span>}
        <span className="file-ext-badge">{getExt(f.name)}</span>
        <span className={`file-server-dot ${f.serverFilename ? 'ready' : 'noserver'}`} title={f.serverFilename ? 'File di server' : 'File lokal'}>
          {f.serverFilename ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
        </span>
        <button className="file-play-overlay" onClick={() => onPreview(f)} title="Preview">
          <Play size={18} fill="white" />
        </button>
      </div>
      <div className="file-body">
        <span className="file-name" title={f.name}>{f.name}</span>
        <div className="file-meta">
          <span>{(f.size / 1048576).toFixed(1)} MB</span>
          {f.serverFilename && <span className="file-server-label">✓ Server</span>}
        </div>
      </div>
      <div className="file-actions-hover">
        <button className="file-action-btn" title="Preview" onClick={() => onPreview(f)}><Eye size={13} /></button>
        <button className="file-action-btn" title="Kategori" onClick={() => onCategoryEdit(f.id)}><Tag size={13} /></button>
        <button className="file-action-btn danger" title="Hapus" onClick={() => onDelete(f.id)}><Trash2 size={13} /></button>
      </div>
      {editingCategory === f.id && (
        <div className="cat-dropdown">
          {CATEGORIES.filter(c => c.id !== 'all').map(c => (
            <button key={c.id} className={`cat-drop-item ${f.category === c.id ? 'selected' : ''}`}
              onClick={() => onCategoryChange(f.id, c.id)}>
              <c.icon size={14} /> {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Preview Modal ───
function PreviewModal({ file, onClose }) {
  if (!file) return null;
  const getExt = (name) => name.split('.').pop().toUpperCase();
  const fmt = (b) => (b >= 1048576) ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB';

  const encPath = (p) => p.split('/').map(s => encodeURIComponent(s)).join('/');
  const playUrl = file.serverFilename
    ? (file.type === 'video' ? `/api/video/play/${encPath(file.serverFilename)}` : `/uploads/${encPath(file.serverFilename)}`)
    : file.objectUrl || null;

  const imageUrl = file.type === 'image'
    ? (file.url || (file.serverFilename ? `/uploads/${encPath(file.serverFilename)}` : file.objectUrl))
    : null;

  return (
    <Modal isOpen={true} onClose={onClose} title="Media Preview">
      <div className="media-preview-modal">
        <div className="media-preview-player">
          {file.type === 'video' ? (
            <div className="media-preview-video-wrap">
              {playUrl ? (
                <video controls autoPlay className="media-preview-video" src={playUrl} />
              ) : (
                <div className="media-preview-placeholder">
                  <Film size={40} strokeWidth={1} />
                  <span>Preview tidak tersedia</span>
                </div>
              )}
            </div>
          ) : file.type === 'image' ? (
            <div className="media-preview-video-wrap">
              {imageUrl ? <img src={imageUrl} alt={file.name} className="media-preview-video" style={{ objectFit: 'contain' }} /> : null}
            </div>
          ) : (
            <div className="media-preview-audio-wrap">
              <div className="media-preview-audio-art" style={{ background: MUSIC_GRADIENT }}>
                <Music size={48} strokeWidth={1} />
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 500, marginTop: 8 }}>{file.name}</span>
              </div>
              {playUrl ? (
                <audio controls autoPlay className="media-preview-audio" src={playUrl}>
                  Browser tidak mendukung audio.
                </audio>
              ) : (
                <div className="media-preview-placeholder small">
                  <AlertCircle size={24} />
                  <span>Audio tidak bisa diputar</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="media-preview-info">
          {[
            ['Nama', file.name],
            ['Tipe', `${file.type === 'video' ? 'Video' : file.type === 'image' ? 'Image' : 'Audio'} (${getExt(file.name)})`],
            ['Ukuran', fmt(file.size)],
            file.duration && file.duration !== '0:00' ? ['Durasi', file.duration] : null,
            ['Server', file.serverFilename ? `✅ ${file.serverFilename}` : '❌ Belum di-upload'],
          ].filter(Boolean).map(([label, val]) => (
            <div key={label} className="mpi-row">
              <span className="mpi-label">{label}</span>
              <span className="mpi-value" style={{ wordBreak: 'break-all', maxWidth: '60%', textAlign: 'right', fontSize: '11px' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ─── Main ───
export default function MediaLibrary() {
  const { files, addFiles, deleteFile, changeCategory } = useMedia();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTab, setUploadTab] = useState('video');
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const fileInputRef = useRef(null);

  const formatSize = useCallback((bytes) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!showDeleteConfirm) return;
    const fileToDelete = files.find(f => f.id === showDeleteConfirm);
    if (fileToDelete && fileToDelete.serverFilename) {
      streamApi.deleteFile(fileToDelete.serverFilename).catch(console.error);
    }
    deleteFile(showDeleteConfirm);
    setShowDeleteConfirm(null);
  }, [showDeleteConfirm, files, deleteFile]);

  // Fetch real storage info
  useEffect(() => {
    fetch('/api/storage/info').then(r => r.json()).then(setStorageInfo).catch(() => {});
  }, [files.length]);

  const totalDisk = storageInfo?.total || 0;
  const usedDisk = storageInfo?.used || 0;
  const freeDisk = storageInfo?.free || 0;
  const uploadsSize = storageInfo?.uploadsSize || files.reduce((s, f) => s + f.size, 0);
  const usedPercent = totalDisk > 0 ? Math.min(100, (usedDisk / totalDisk) * 100) : 0;

  const filtered = files.filter(f => {
    const isImageFile = f.type === 'image' || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name);
    // If it's an image but wrongly categorized as video (due to old bug), treat its category as image
    const effCat = (f.category === 'video' && isImageFile) ? 'image' : (f.category || f.type);
    const matchCat = activeCategory === 'all' || effCat === activeCategory || (activeCategory === 'image' && isImageFile);
    const matchSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const currentUploadTab = UPLOAD_TABS.find(t => t.id === uploadTab);

  const handleFileSelect = async (e) => {
    const selected = Array.from(e.target.files || []);
    const newFiles = [];

    const getDuration = (file, objectUrl, type) => {
      return new Promise((resolve) => {
        if (type === 'image') return resolve(null);
        const media = document.createElement(type === 'video' ? 'video' : 'audio');
        media.onloadedmetadata = () => {
          const d = media.duration;
          if (isNaN(d)) return resolve('0:00');
          const h = Math.floor(d / 3600);
          const m = Math.floor((d % 3600) / 60);
          const s = Math.floor(d % 60);
          resolve(h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`);
        };
        media.onerror = () => resolve('0:00');
        media.src = objectUrl;
      });
    };

      for (let f of selected) {
        let type = uploadTab; // default
        const nameL = f.name.toLowerCase();
        if (f.type.startsWith('audio/') || nameL.endsWith('.m4a') || nameL.endsWith('.mp3')) type = 'music';
        else if (f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/.test(nameL)) type = 'image';
        else if (f.type.startsWith('video/') || nameL.endsWith('.mp4') || nameL.endsWith('.mkv')) type = 'video';
      
      const objectUrl = URL.createObjectURL(f);
      const duration = await getDuration(f, objectUrl, type);
      newFiles.push({ file: f, name: f.name, size: f.size, type, objectUrl, duration });
    }

    setUploadFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeUploadFile = (idx) => setUploadFiles(prev => prev.filter((_, i) => i !== idx));

  const doUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    const progress = {};
    const errors = {};
    uploadFiles.forEach((_, i) => { progress[i] = 0; });
    setUploadProgress({ ...progress });
    setUploadErrors({});

    const newEntries = [];
    const CONCURRENCY = 3; // Upload up to 3 files at once for max speed

    const uploadOne = async (i) => {
      const uf = uploadFiles[i];
      try {
        const result = await streamApi.uploadFile(uf.file, (pct) => {
          setUploadProgress(prev => ({ ...prev, [i]: pct }));
        });

        if (result && result.success) {
          newEntries.push({
            id: Date.now() + i + Math.floor(Math.random() * 100),
            name: uf.name, type: uf.type, category: activeCategory !== 'all' ? activeCategory : (uf.type === 'music' ? 'music' : uf.type),
            size: uf.size, duration: uf.duration || null, date: new Date().toISOString(),
            status: 'ready', objectUrl: result.file.url,
            serverFilename: result.file.filename, serverPath: result.file.path,
          });
        } else {
          errors[i] = result?.error || 'Upload gagal';
        }
      } catch (err) {
        errors[i] = err.message || 'Server tidak terhubung';
        setUploadProgress(prev => ({ ...prev, [i]: 100 }));
      }
    };

    // Run uploads in batches of CONCURRENCY
    for (let start = 0; start < uploadFiles.length; start += CONCURRENCY) {
      const batch = [];
      for (let j = start; j < Math.min(start + CONCURRENCY, uploadFiles.length); j++) {
        batch.push(uploadOne(j));
      }
      await Promise.all(batch);
    }

    setUploadErrors(errors);
    addFiles(newEntries);
    setUploadFiles([]);
    setUploading(false);
    setUploadProgress({});
    if (Object.keys(errors).length === 0) setShowUploadModal(false);
  };

  const catStats = CATEGORIES.map(c => ({
    ...c,
    count: c.id === 'all' ? files.length : files.filter(f => {
      const isImageFile = f.type === 'image' || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name);
      const effCat = (f.category === 'video' && isImageFile) ? 'image' : (f.category || f.type);
      return effCat === c.id || (c.id === 'image' && isImageFile);
    }).length,
  }));

  return (
    <div className="page">
      <h1 className="page-title">Media Library</h1>
      <p className="page-subtitle">Upload dan kelola file video, musik & gambar untuk streaming</p>

      {/* Storage Bar — Real Disk */}
      <div className="glass-card storage-bar">
        <div className="storage-info">
          <HardDrive size={18} />
          <span className="storage-text">
            <strong>{storageInfo ? storageInfo.usedGB : '...'} GB</strong> / {storageInfo ? storageInfo.totalGB : '...'} GB
            {storageInfo && <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: 8 }}>Uploads: {storageInfo.uploadsSizeGB} GB</span>}
          </span>
          <span className="storage-percent">{usedPercent.toFixed(1)}%</span>
        </div>
        <div className="storage-track">
          <div className={`storage-fill ${usedPercent > 80 ? 'warn' : usedPercent > 50 ? 'mid' : ''}`}
            style={{ width: `${usedPercent}%` }} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="media-toolbar">
        <div className="media-search">
          <Search size={16} className="media-search-icon" />
          <input type="text" placeholder="Cari file..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} className="media-search-input" />
        </div>
        <div className="toolbar-right">
          <div className="view-toggle">
            <button className={`vt-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><Grid size={16} /></button>
            <button className={`vt-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><List size={16} /></button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
            <Upload size={16} /> Upload File
          </button>
        </div>
      </div>

      <div className="media-layout">
        <div className="media-cats">
          {catStats.map(c => (
            <button key={c.id} className={`cat-btn ${activeCategory === c.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(c.id)}>
              <c.icon size={16} />
              <span className="cat-label">{c.label}</span>
              <span className="cat-count">{c.count}</span>
            </button>
          ))}
        </div>

        <div className="media-files">
          {filtered.length === 0 ? (
            <div className="empty-media">
              <FolderOpen size={48} strokeWidth={1} />
              <span>{files.length === 0 ? 'Belum ada file. Klik "Upload File".' : 'Tidak ada file ditemukan.'}</span>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="file-grid">
              {filtered.map(f => (
                <FileCard key={f.id} f={f}
                  onPreview={file => setPreviewFile(file)}
                  onDelete={id => setShowDeleteConfirm(id)}
                  onCategoryEdit={id => setEditingCategory(editingCategory === id ? null : id)}
                  editingCategory={editingCategory}
                  onCategoryChange={(id, cat) => { changeCategory(id, cat); setEditingCategory(null); }}
                />
              ))}
            </div>
          ) : (
            <div className="file-list-view">
              <div className="file-list-header">
                <span className="flh-name">Nama File</span>
                <span className="flh">Tipe</span>
                <span className="flh">Ukuran</span>
                <span className="flh">Server</span>
                <span className="flh">Aksi</span>
              </div>
              {filtered.map(f => (
                <div key={f.id} className="file-list-item" style={{ position: 'relative' }}>
                  <span className="fli-name">
                    {f.type === 'video' ? <Film size={14} /> : f.type === 'image' ? <Eye size={14} /> : <Music size={14} />}
                    {f.name}
                  </span>
                  <span className="fli">{f.type === 'video' ? 'Video' : f.type === 'image' ? 'Image' : 'Musik'}</span>
                  <span className="fli">{formatSize(f.size)}</span>
                  <span className="fli">
                    {f.serverFilename ? <span style={{ color: 'var(--accent-green)', fontSize: '11px' }}>✓</span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>}
                  </span>
                  <span className="fli fli-actions">
                    <button className="file-action-btn" onClick={() => setPreviewFile(f)}><Play size={12} /></button>
                    <button className="file-action-btn" onClick={() => setEditingCategory(editingCategory === f.id ? null : f.id)}><Tag size={12} /></button>
                    <button className="file-action-btn danger" onClick={() => setShowDeleteConfirm(f.id)}><Trash2 size={12} /></button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal with Tabs */}
      <Modal isOpen={showUploadModal} onClose={() => { if (!uploading) { setShowUploadModal(false); setUploadFiles([]); setUploadErrors({}); } }}
        title="Upload File Media">
        <div className="upload-modal-body">
          {/* Upload Tabs */}
          <div className="upload-tabs">
            {UPLOAD_TABS.map(t => (
              <button key={t.id} className={`upload-tab-btn ${uploadTab === t.id ? 'active' : ''}`}
                onClick={() => { if (!uploading) { setUploadTab(t.id); setUploadFiles([]); } }}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="upload-dropzone" onClick={() => !uploading && fileInputRef.current?.click()}>
            <Upload size={36} />
            <span>Klik untuk pilih file {currentUploadTab?.label}</span>
            <small>Format: {currentUploadTab?.formats}</small>
            <input ref={fileInputRef} type="file" accept={currentUploadTab?.accept} multiple hidden onChange={handleFileSelect} />
          </div>

          {Object.keys(uploadErrors).length > 0 && (
            <div style={{ padding: '8px 12px', background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--accent-red)' }}>
              ⚠ Beberapa file gagal di-upload ke server.
            </div>
          )}

          {uploadFiles.length > 0 && (
            <>
              <div className="upload-file-list">
                {uploadFiles.map((uf, i) => (
                  <div key={i} className="upload-file-item">
                    <div className="ufi-icon">
                      {uf.type === 'video' ? <Film size={16} /> : uf.type === 'image' ? <Eye size={16} /> : <Music size={16} />}
                    </div>
                    <div className="ufi-info">
                      <span className="ufi-name">{uf.name}</span>
                      <span className="ufi-size">{formatSize(uf.size)}</span>
                    </div>
                    {uploading ? (
                      <div className="ufi-progress">
                        <div className="ufi-progress-bar">
                          <div className="ufi-progress-fill" style={{ width: `${uploadProgress[i] || 0}%` }} />
                        </div>
                        <span className="ufi-progress-pct">{uploadProgress[i] || 0}%</span>
                      </div>
                    ) : (
                      <button className="ufi-remove" onClick={() => removeUploadFile(i)}><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>

              <button className="btn btn-primary upload-start-btn" onClick={doUpload} disabled={uploading}>
                <Upload size={16} />
                {uploading ? 'Uploading...' : `Upload ${uploadFiles.length} File`}
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={showDeleteConfirm !== null} onClose={() => setShowDeleteConfirm(null)} title="Hapus File?">
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16 }}>File yang dihapus tidak dapat dikembalikan.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)}>Batal</button>
          <button className="btn btn-primary" onClick={handleDeleteConfirm}>Hapus</button>
        </div>
      </Modal>

      {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}
