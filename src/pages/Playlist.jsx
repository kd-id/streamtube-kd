import { useState } from 'react';
import {
  Plus, Play, Pause, Trash2, GripVertical, Music, Film, Search,
  MoreVertical, Edit2, Edit3, Clock, ListMusic, FolderOpen, ChevronDown, X
} from 'lucide-react';
import Modal from '../components/shared/Modal';
import { usePlaylist } from '../hooks/usePlaylistStore';
import { useMedia } from '../hooks/useMediaStore';
import './Playlist.css';

function parseDuration(d) {
  if (!d) return 0;
  const parts = d.split(':').map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + (parts[1] || 0);
}

function formatTotalDuration(items) {
  const total = items.reduce((s, i) => s + parseDuration(i.duration || '0:00'), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export default function Playlist() {
  const { playlists, createPlaylist, deletePlaylist, renamePlaylist, addMediaToPlaylist, removeItemFromPlaylist, moveItemInPlaylist } = usePlaylist();
  const { files: mediaFiles } = useMedia();

  const [activeId, setActiveId] = useState(playlists[0]?.id || null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [editNameId, setEditNameId] = useState(null);
  const [editNameVal, setEditNameVal] = useState('');
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [mediaSearch, setMediaSearch] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [editData, setEditData] = useState(null);

  const activePlaylist = playlists.find(p => p.id === activeId);
  const filteredPlaylists = playlists.filter(p => p.name.toLowerCase().includes(playlistSearch.toLowerCase()));

  const handleCreatePlaylist = () => {
    if (!createForm.name.trim()) return;
    const np = createPlaylist({ name: createForm.name, description: createForm.description });
    setActiveId(np.id);
    setShowCreateModal(false);
    setCreateForm({ name: '', description: '' });
  };

  const handleDeletePlaylist = (id) => {
    deletePlaylist(id);
    if (activeId === id) setActiveId(playlists.find(p => p.id !== id)?.id || null);
  };

  const handleAddMedia = (media) => {
    addMediaToPlaylist(activeId, media);
  };

  const handleRemoveItem = (itemId) => {
    removeItemFromPlaylist(activeId, itemId);
  };

  const handleMoveItem = (fromIdx, toIdx) => {
    moveItemInPlaylist(activeId, fromIdx, toIdx);
  };

  const startRename = (p) => {
    setEditNameId(p.id);
    setEditNameVal(p.name);
  };

  const saveRename = () => {
    if (!editNameVal.trim()) return;
    renamePlaylist(editNameId, editNameVal);
    setEditNameId(null);
  };

  const filteredMedia = mediaFiles.filter(m => m.name.toLowerCase().includes(mediaSearch.toLowerCase()));

  return (
    <div className="page" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Playlist Manager</h1>
          <p className="page-subtitle">Create and manage playlists for streaming</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={14} /> Create Playlist
        </button>
      </div>

      <div className="pm-topbar">
        <div className="pm-search">
          <Search size={15} />
          <input type="text" placeholder="Search playlists..." value={playlistSearch} onChange={e => setPlaylistSearch(e.target.value)} />
        </div>
        <select className="form-input pm-sort" style={{ width: '150px' }}>
          <option>Newest</option>
        </select>
      </div>

      {playlists.length === 0 ? (
        <div className="pm-empty-state">
          <FolderOpen size={48} strokeWidth={1} />
          <h2>Belum ada Playlist</h2>
          <p>Tambahkan file video atau musik dari Galeri ke Playlist untuk diputar di live stream Anda.</p>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> Create Playlist
          </button>
        </div>
      ) : (
        <>
          <div className="pm-grid">
            {filteredPlaylists.length === 0 ? (
              <div className="pm-empty-search">Tidak ada playlist yang cocok dengan pencarian.</div>
            ) : (
              filteredPlaylists.map(p => {
                const vCount = p.items.filter(i => i.type === 'video').length;
                const aCount = p.items.filter(i => i.type === 'music').length;
                const thumbs = p.items.filter(i => i.type === 'video').slice(0, 4);
                
                return (
                  <div key={p.id} className="pm-card">
                    <h3 className="pm-card-title">{p.name}</h3>
                    <div className="pm-card-thumbs">
                      {[0, 1, 2, 3].map(i => {
                      const t = thumbs[i];
                      const thumbSrc = t?.serverFilename 
                        ? `/api/video/thumbnail/${encodeURIComponent(t.serverFilename)}`
                        : t?.objectUrl && !t.objectUrl.startsWith('blob:') 
                          ? `/api/video/thumbnail/${encodeURIComponent(t.objectUrl.split('/').pop())}`
                          : null;
                      return (
                        <div key={i} className="pm-thumb-slot">
                          {t ? (
                            thumbSrc 
                              ? <img src={thumbSrc} alt="" onError={e => { e.target.style.display='none'; }} />
                              : <Film size={16} color="var(--text-muted)"/>
                          ) : null}
                        </div>
                      );
                    })}
                    </div>
                    <p className="pm-card-desc">{p.description || 'No description'}</p>
                    
                    <div className="pm-card-footer">
                      <div className="pm-cf-stats">
                        <span><Film size={12} /> {vCount}</span>
                        <span><Music size={12} /> {aCount}</span>
                      </div>
                      <div className="pm-cf-actions">
                        <button className="pm-action-btn" title="Edit" onClick={() => { setEditData(p); setShowCreateModal(true); }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="pm-action-btn delete" title="Delete" onClick={() => handleDeletePlaylist(p.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="pm-showing">Showing 1-{filteredPlaylists.length} of {playlists.length} playlists</div>
        </>
      )}

      {/* Redesigned Unified Create/Edit Playlist Modal */}
      {showCreateModal && (
        <CreatePlaylistModal 
          isOpen={showCreateModal} 
          onClose={() => { setShowCreateModal(false); setEditData(null); }}
          initialData={editData}
          onSave={(data) => {
            if (editData) {
              const itemsToAdd = data.items.filter(i => !editData.items.find(old => old.id === i.id));
              const itemsToRemove = editData.items.filter(old => !data.items.find(nw => nw.id === old.id));
              renamePlaylist(editData.id, data.name);
              // Simplified approach for UI testing, more complete edit logic left to backend
              // In this case, we'd clear items and add again, but API doesn't support clear. 
              // We'll just update name for now or apply missing.
              itemsToRemove.forEach(i => removeItemFromPlaylist(editData.id, i.id));
              itemsToAdd.forEach(i => addMediaToPlaylist(editData.id, i));
            } else {
              const np = createPlaylist({ name: data.name, description: data.description, playbackMode: data.playbackMode });
              data.items.forEach(item => addMediaToPlaylist(np.id, item));
            }
            setShowCreateModal(false);
            setEditData(null);
          }}
          mediaFiles={mediaFiles}
        />
      )}

      {/* Maintain old Add Media modal for existing playlist edits if needed, or remove it?
          We'll keep a basic Add Media for the main list, but the user requested redesigning the playlist creation. */}
      {showAddMedia && (
        <Modal isOpen={showAddMedia} onClose={() => { setShowAddMedia(false); setMediaSearch(''); }} title="Tambah Media ke Playlist">
          <div className="add-media-modal">
            <div className="am-search">
              <Search size={14} />
              <input className="form-input am-search-input" placeholder="Cari file..." value={mediaSearch} onChange={e => setMediaSearch(e.target.value)} />
            </div>
            <div className="am-list">
              {filteredMedia.map(m => {
                const alreadyIn = activePlaylist?.items.some(i => i.mediaId === String(m.id));
                return (
                  <div key={m.id} className={`am-item ${alreadyIn ? 'added' : ''}`}>
                    <div className={`am-type ${m.type}`}>
                      {m.type === 'video' ? <Film size={14} /> : <Music size={14} />}
                    </div>
                    <div className="am-info">
                      <span className="am-name">{m.name}</span>
                      <span className="am-meta">{m.duration} • {(m.size / 1048576).toFixed(1)} MB</span>
                    </div>
                    <button
                      className={`btn btn-sm ${alreadyIn ? 'btn-secondary' : 'btn-blue'}`}
                      onClick={() => !alreadyIn && handleAddMedia(m)}
                      disabled={alreadyIn}
                    >
                      {alreadyIn ? 'Added' : <><Plus size={12} /> Add</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* --- New Unified Create Playlist Modal --- */
function CreatePlaylistModal({ isOpen, onClose, onSave, initialData, mediaFiles }) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [playbackMode, setPlaybackMode] = useState(initialData?.playbackMode || 'Sequential'); // Sequential | Shuffle
  const [activeTab, setActiveTab] = useState('videos'); // videos | audio
  const [search, setSearch] = useState('');
  
  // Format initialData.items if editing
  const [selectedItems, setSelectedItems] = useState(
    initialData?.items 
      ? initialData.items.map(i => ({ ...i, playlistItemId: i.id || (Date.now().toString() + Math.random()) }))
      : []
  );
  
  const filteredAvailable = mediaFiles.filter(m => {
    const pType = activeTab === 'videos' ? 'video' : 'music';
    const isAlreadySelected = selectedItems.some(sel => (sel.mediaId || sel.id) === m.id);
    return !isAlreadySelected && m.type === pType && m.name.toLowerCase().includes(search.toLowerCase());
  });
  
  const currentSelectedItems = selectedItems.filter(i => i.type === (activeTab === 'videos' ? 'video' : 'music'));

  const handleAddItem = (m) => {
    setSelectedItems(prev => [...prev, { ...m, playlistItemId: Date.now().toString() + Math.random() }]);
  };
  
  const handleRemoveItem = (playlistItemId) => {
    setSelectedItems(prev => prev.filter(i => i.playlistItemId !== playlistItemId));
  };
  
  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name, description, playbackMode, items: selectedItems });
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay">
      <div className="unified-pl-modal">
        <div className="upm-header">
          <h2>Create New Playlist</h2>
          <button className="upm-close" onClick={onClose}><X size={16}/></button>
        </div>
        
        <div className="upm-body">
          {/* Top Form Row */}
          <div className="upm-top-row">
            <div className="form-group flex-2">
              <label className="form-label">Playlist Name</label>
              <input className="form-input" placeholder="Enter playlist name..." value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">Video Playback</label>
              <select className="form-input" value={playbackMode} onChange={e => setPlaybackMode(e.target.value)}>
                <option value="Sequential">Sequential</option>
                <option value="Shuffle">Shuffle</option>
              </select>
            </div>
            <div className="form-group flex-2">
              <label className="form-label">Description (Optional)</label>
              <input className="form-input" placeholder="Short description..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          
          {/* Tabs */}
          <div className="upm-tabs">
            <button className={`upm-tab ${activeTab === 'videos' ? 'active' : ''}`} onClick={() => setActiveTab('videos')}>
              <Film size={14}/> Videos <span className="badge">{selectedItems.filter(i=>i.type==='video').length}</span>
            </button>
            <button className={`upm-tab ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => setActiveTab('audio')}>
              <Music size={14}/> Background Music <span className="badge">{selectedItems.filter(i=>i.type==='music').length}</span>
            </button>
          </div>
          
          {/* Split Pane */}
          <div className="upm-split">
            {/* Left: Available */}
            <div className="upm-pane left">
              <div className="upm-pane-header">
                <h3>Available {activeTab === 'videos' ? 'Videos' : 'Audio'}</h3>
                <span className="count">{filteredAvailable.length} total</span>
              </div>
              <div className="upm-search">
                <Search size={14}/>
                <input type="text" placeholder={`Search ${activeTab === 'videos' ? 'videos' : 'audio'}...`} value={search} onChange={e=>setSearch(e.target.value)} />
              </div>
              <div className="upm-list available-list">
                {filteredAvailable.map(m => (
                  <div key={m.id} className="upm-item">
                    <div className="upm-item-icon">
                      {m.type === 'video' ? <Film size={14}/> : <Music size={14}/>}
                    </div>
                    <div className="upm-item-info">
                      <div className="upm-item-name">{m.name}</div>
                      <div className="upm-item-duration">{m.duration}</div>
                    </div>
                    <button className="upm-add-btn" onClick={() => handleAddItem(m)}>
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Right: Selected */}
            <div className="upm-pane right">
              <div className="upm-pane-header">
                <h3>Selected {activeTab === 'videos' ? 'Videos' : 'Background Music'}</h3>
                {currentSelectedItems.length > 0 && <button className="upm-clear-btn" onClick={() => setSelectedItems(prev => prev.filter(i => i.type !== (activeTab === 'videos' ? 'video' : 'music')))}>Clear all</button>}
              </div>
              
              <div className="upm-list selected-list">
                {currentSelectedItems.length === 0 ? (
                  <div className="upm-empty">
                    {activeTab === 'videos' ? <Film size={32} /> : <Music size={32} />}
                    <h4>No {activeTab === 'videos' ? 'videos' : 'background music'} selected</h4>
                    <p>{activeTab === 'videos' ? 'Drag videos here or click to add' : 'This is optional'}</p>
                  </div>
                ) : (
                  currentSelectedItems.map((m, idx) => (
                    <div key={m.playlistItemId} className="upm-item selected">
                      <div className="upm-drag-handle"><GripVertical size={14}/></div>
                      <div className="upm-item-num">{idx + 1}</div>
                      <div className="upm-item-info">
                        <div className="upm-item-name">{m.name}</div>
                        <div className="upm-item-duration">{m.duration}</div>
                      </div>
                      <button className="upm-remove-btn" onClick={() => handleRemoveItem(m.playlistItemId)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="upm-footer">
          <div className="upm-summary">
            <Film size={14}/> {selectedItems.filter(i=>i.type==='video').length} videos
            <Music size={14} style={{marginLeft: 16}}/> {selectedItems.filter(i=>i.type==='music').length} audio
          </div>
          <div className="upm-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>Create Playlist</button>
          </div>
        </div>
      </div>
    </div>
  );
}
