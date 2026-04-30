import { useState } from 'react';
import {
  Eye, EyeOff, MonitorPlay, Camera, Image as ImageIcon, Type, Bell,
  Plus, Trash2, ChevronDown, ChevronUp, Move, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight, HelpCircle, Info, Images,
  Sparkles, Droplets, SunDim
} from 'lucide-react';
import { useOverlay } from '../hooks/useOverlayStore';
import { useMedia } from '../hooks/useMediaStore';
import './Overlays.css';

const ELEMENT_TYPES = [
  { type: 'text',    Icon: Type,        label: 'Text',         desc: 'Teks dinamis / overlay',      color: '#4d8eff' },
  { type: 'gallery', Icon: Images,      label: 'GIF / Image',  desc: 'Pilih dari galeri media',     color: '#2dd4a8' },
  { type: 'image',   Icon: ImageIcon,   label: 'Image URL',    desc: 'Gambar dari URL eksternal',   color: '#22d3ee' },
  { type: 'webcam',  Icon: Camera,      label: 'Webcam',       desc: 'Kamera dari perangkat',       color: '#a855f7' },
  { type: 'screen',  Icon: MonitorPlay, label: 'Screen',       desc: 'Tangkapan layar',             color: '#f59e0b' },
  { type: 'alert',   Icon: Bell,        label: 'Alert/Ticker', desc: 'Notifikasi / teks berjalan',  color: '#ff5a5a' },
];

const PRESET_FONTS = [
  'Bebas Neue', 'Courier Prime', 'Inter', 'Montserrat', 'Oswald',
  'Poppins', 'Press Start 2P', 'Rajdhani', 'Roboto',
];

const ANIMATIONS = [
  { value: 'none',      label: 'None' },
  { value: 'ov-pulse',  label: 'Pulse' },
  { value: 'ov-blink',  label: 'Blink' },
  { value: 'ov-slide-in', label: 'Slide In' },
  { value: 'ov-float',  label: 'Float' },
  { value: 'ov-ticker', label: 'Ticker (scroll)' },
];

const typeIcons = { webcam: Camera, screen: MonitorPlay, image: ImageIcon, gallery: Images, text: Type, alert: Bell };
const typeColor  = (t) => ELEMENT_TYPES.find(e => e.type === t)?.color || '#888';

// Dynamically load a Google Font by name
function loadGFont(name) {
  if (!name || name === 'inherit') return;
  const id = `gf-${name.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id; link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}&display=swap`;
  document.head.appendChild(link);
}
// Preload preset fonts
PRESET_FONTS.forEach(loadGFont);

/* ─── Gallery Picker ─── */
function GalleryPickerModal({ mediaFiles, onSelect, onClose }) {
  const images = mediaFiles.filter(f =>
    f.type === 'image' || /\.(gif|png|jpg|jpeg|webp|svg)$/i.test(f.name || '')
  );
  return (
    <div className="ov-modal-bg" onClick={onClose}>
      <div className="ov-modal ov-modal-wide" onClick={e => e.stopPropagation()}>
        <div className="ov-modal-header">
          <span>Pilih dari Galeri</span>
          <button className="ov-modal-close" onClick={onClose}>✕</button>
        </div>
        {images.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center', fontSize: 'var(--font-sm)' }}>
            Belum ada gambar/GIF. Upload di menu Gallery terlebih dahulu.
          </p>
        ) : (
          <div className="ov-gallery-grid">
            {images.map(img => {
              const encP = (p) => p.split('/').map(s => encodeURIComponent(s)).join('/');
              const url = img.objectUrl || img.url || `/uploads/${encP(img.serverFilename || img.name)}`;
              return (
                <button key={img.id || img.name} className="ov-gallery-item" onClick={() => onSelect(img, url)}>
                  <img src={url} alt={img.name} />
                  <span className="ov-gallery-name">{img.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Type Picker ─── */
function TypePickerModal({ onSelect, onClose }) {
  return (
    <div className="ov-modal-bg" onClick={onClose}>
      <div className="ov-modal" onClick={e => e.stopPropagation()}>
        <div className="ov-modal-header">
          <span>Pilih Jenis Element</span>
          <button className="ov-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ov-type-grid">
          {ELEMENT_TYPES.map(({ type, Icon, label, desc, color }) => (
            <button key={type} className="ov-type-card" onClick={() => onSelect(type)}>
              <span className="ov-type-icon" style={{ background: color + '33', color }}>
                <Icon size={22} />
              </span>
              <span className="ov-type-name">{label}</span>
              <span className="ov-type-desc">{desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function Overlays() {
  const {
    scenes, currentScene, activeSceneId,
    setActive, addScene, deleteScene, toggleSceneLive,
    toggleItem, addItem, deleteItem, updateItem, updateSceneName,
  } = useOverlay();
  const { files: mediaFiles } = useMedia();

  const [showTypePicker,    setShowTypePicker]    = useState(false);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [expandedItems,     setExpandedItems]     = useState({});
  const [sideTab,           setSideTab]           = useState('scenes');
  const [showGuide,         setShowGuide]         = useState(false);
  const [customFontInput,   setCustomFontInput]   = useState('');

  const toggleExpand = (id) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  const ui = (id, k, v) => updateItem(activeSceneId, id, { [k]: v });

  const handleTypeSelect = (type) => {
    if (type === 'gallery') { setShowTypePicker(false); setShowGalleryPicker(true); return; }
    const defaults = {
      text:   { label: 'New Text', fontsize: 40, fontcolor: '#ffffff', fontfamily: 'Inter', bold: false, italic: false, align: 'center', opacity: 1, shadow: false, shadowColor: '#000000', shadowBlur: 4, thickness: 0, animation: 'none', x: 50, y: 50 },
      image:  { label: 'Image',    imageUrl: '',  x: 50, y: 50, w: 200, h: 100, opacity: 1 },
      webcam: { label: 'Webcam',   x: 20, y: 60,  w: 160, h: 90, opacity: 1 },
      screen: { label: 'Screen',   x: 50, y: 50,  w: 300, h: 200, opacity: 1 },
      alert:  { label: 'Alert Text', fontsize: 32, fontcolor: '#ffdd55', fontfamily: 'Oswald', bold: true, italic: false, align: 'center', opacity: 1, shadow: true, shadowColor: '#000000', shadowBlur: 6, thickness: 1, animation: 'ov-ticker', x: 50, y: 85 },
    };
    addItem(activeSceneId, { type, visible: true, ...defaults[type] });
    setShowTypePicker(false);
  };

  const handleGallerySelect = (img, url) => {
    addItem(activeSceneId, { type: 'gallery', label: img.name, imageUrl: url, x: 50, y: 50, w: 120, h: 80, visible: true, opacity: 1 });
    setShowGalleryPicker(false);
  };

  const handleLoadCustomFont = () => {
    const name = customFontInput.trim();
    if (!name) return;
    loadGFont(name);
  };

  const getTextShadow = (item) => {
    if (!item.shadow) return '0 2px 6px rgba(0,0,0,0.7)';
    const c = item.shadowColor || '#000000';
    const b = item.shadowBlur ?? 4;
    return `${b/2}px ${b/2}px ${b}px ${c}, 0 1px 3px rgba(0,0,0,0.6)`;
  };

  return (
    <div className="page">
      <h1 className="page-title">Overlays &amp; Scenes</h1>
      <p className="page-subtitle">Kelola scene dan overlay untuk stream kamu</p>

      {showTypePicker    && <TypePickerModal onSelect={handleTypeSelect} onClose={() => setShowTypePicker(false)} />}
      {showGalleryPicker && <GalleryPickerModal mediaFiles={mediaFiles} onSelect={handleGallerySelect} onClose={() => setShowGalleryPicker(false)} />}

      <div className="overlay-grid">
        {/* ── Left: Preview + Guide (narrow) ── */}
        <div className="overlay-main">
          <div className="glass-card overlay-section">
            <div className="scene-preview">
              <div className="preview-canvas">
                <div className="canvas-video-wrapper">
                  <video className="canvas-video-bg" autoPlay loop muted playsInline
                    src="https://www.w3schools.com/html/mov_bbb.mp4" />
                </div>
                <div className="canvas-items-layer">
                  {currentScene?.items.filter(i => i.visible).map(item => {
                    const Icon = typeIcons[item.type] || Type;
                    const cx = Math.min(Math.max(item.x ?? 50, 3), 97);
                    const cy = Math.min(Math.max(item.y ?? 50, 3), 97);
                    const ff = item.fontfamily ? `'${item.fontfamily}', sans-serif` : 'inherit';
                    return (
                      <div key={item.id}
                        className={`canvas-item ${item.animation && item.animation !== 'none' ? item.animation : ''}`}
                        style={{
                          left: `${cx}%`, top: `${cy}%`,
                          transform: 'translate(-50%, -50%)',
                          opacity: item.opacity ?? 1,
                          fontFamily: ff,
                          fontWeight: item.bold ? 700 : 400,
                          fontStyle: item.italic ? 'italic' : 'normal',
                          color: item.fontcolor || '#fff',
                          fontSize: item.fontsize ? `${item.fontsize / 2}px` : '14px',
                          textShadow: getTextShadow(item),
                          textAlign: item.align || 'center',
                          WebkitTextStroke: item.thickness ? `${item.thickness}px ${item.fontcolor || '#fff'}` : 'none',
                        }}>
                        {(item.type === 'image' || item.type === 'gallery') && item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.label}
                            style={{ maxWidth: `${item.w || 120}px`, maxHeight: `${item.h || 80}px`, objectFit: 'contain', opacity: item.opacity ?? 1 }} />
                        ) : item.type === 'text' || item.type === 'alert' ? (
                          <span style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                            {item.label}
                          </span>
                        ) : (
                          <><Icon size={14} style={{ color: typeColor(item.type) }} /><span style={{ marginLeft: 4 }}>{item.label}</span></>
                        )}
                      </div>
                    );
                  })}
                  {(!currentScene || currentScene.items.filter(i => i.visible).length === 0) && (
                    <span className="canvas-empty">No visible elements</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Guide */}
          <div className="ov-guide glass-card">
            <button className="ov-guide-toggle" onClick={() => setShowGuide(g => !g)}>
              <HelpCircle size={15} />
              <span>Cara Penggunaan</span>
              {showGuide ? <ChevronUp size={14} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={14} style={{ marginLeft: 'auto' }} />}
            </button>
            {showGuide && (
              <div className="ov-guide-body">
                <div className="ov-guide-section">
                  <strong>⚙️ Cara Pakai</strong>
                  <ol className="ov-guide-steps">
                    <li>Buka tab <strong>Elements</strong> → klik <strong>Add</strong> → pilih jenis.</li>
                    <li>Klik ▾ untuk atur posisi, font, warna, opacity, bayangan, animasi.</li>
                    <li>Toggle 👁 untuk sembunyikan/tampilkan secara sementara.</li>
                    <li>Di menu <strong>Streams</strong>, pilih <em>Overlay Scene</em> untuk diterapkan.</li>
                  </ol>
                </div>
                <div className="ov-guide-note">
                  <Info size={13} />
                  <span><strong>Text</strong> dan <strong>Alert</strong> bekerja via FFmpeg. Posisi = persen dari canvas (0–100%).</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Sidebar (Scenes & Elements) ── */}
        <div className="overlay-sidebar">
          <div className="glass-card overlay-section">
            <div className="ov-tab-bar">
              <button className={`ov-tab ${sideTab === 'scenes' ? 'active' : ''}`} onClick={() => setSideTab('scenes')}>
                <MonitorPlay size={13} /> Scenes
              </button>
              <button className={`ov-tab ${sideTab === 'elements' ? 'active' : ''}`} onClick={() => setSideTab('elements')}>
                <Type size={13} /> Elements
                {currentScene?.items.length > 0 && <span className="ov-count">{currentScene.items.length}</span>}
              </button>
            </div>

            {/* ── Scenes Tab ── */}
            {sideTab === 'scenes' && (
              <div>
                <div className="section-header" style={{ marginTop: 12 }}>
                  <span className="section-sub">Daftar Scene</span>
                  <button className="btn btn-secondary" onClick={addScene}><Plus size={14} /> Tambah</button>
                </div>
                <div className="scene-list">
                  {scenes.map(s => (
                    <div key={s.id} className={`scene-item ${activeSceneId === s.id ? 'active' : ''}`} onClick={() => setActive(s.id)}>
                      <MonitorPlay size={16} />
                      <input className="scene-name-input" value={s.name}
                        onChange={e => updateSceneName(s.id, e.target.value)}
                        onClick={e => e.stopPropagation()} />
                      {s.active ? (
                        <span className="badge badge-live" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); toggleSceneLive(s.id); }}>Live</span>
                      ) : (
                        <span className="badge" style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#888' }} onClick={e => { e.stopPropagation(); toggleSceneLive(s.id); }}>Off</span>
                      )}
                      {/* Always show delete */}
                      <button className="scene-delete" title="Hapus scene"
                        onClick={e => { e.stopPropagation(); deleteScene(s.id); }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Elements Tab ── */}
            {sideTab === 'elements' && (
              <div>
                <div className="section-header" style={{ marginTop: 12 }}>
                  <span className="section-sub"><strong>{currentScene?.name}</strong></span>
                  <button className="btn btn-secondary" onClick={() => setShowTypePicker(true)}><Plus size={14} /> Add</button>
                </div>
                <div className="item-list">
                  {currentScene?.items.map(item => {
                    const Icon = typeIcons[item.type] || Type;
                    const expanded = expandedItems[item.id];
                    const color = typeColor(item.type);
                    const isText = item.type === 'text' || item.type === 'alert';
                    return (
                      <div key={item.id} className="overlay-item-card">
                        <div className="overlay-item-header">
                          <span className="ov-item-type-dot" style={{ background: color }} />
                          <Icon size={14} style={{ color, flexShrink: 0 }} />
                          <input className="item-label-input" value={item.label}
                            onChange={e => ui(item.id, 'label', e.target.value)} placeholder="Label..." />
                          <button className="item-expand-btn" onClick={() => toggleExpand(item.id)}>
                            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                          <button className="item-vis-btn" onClick={() => toggleItem(activeSceneId, item.id)}>
                            {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button className="item-del-btn" onClick={() => deleteItem(activeSceneId, item.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {expanded && (
                          <div className="overlay-item-details">
                            {/* ── Position & Size (Moved for Text, kept here for Non-Text) ── */}
                            {!isText && (
                              <div className="ov-prop-grid">
                                <div className="ov-prop-cell">
                                  <label>X%</label>
                                  <input type="number" className="ov-prop-input" value={item.x ?? 50}
                                    onChange={e => ui(item.id, 'x', Number(e.target.value))} />
                                </div>
                                <div className="ov-prop-cell">
                                  <label>Y%</label>
                                  <input type="number" className="ov-prop-input" value={item.y ?? 50}
                                    onChange={e => ui(item.id, 'y', Number(e.target.value))} />
                                </div>
                                <div className="ov-prop-cell">
                                  <label>W</label>
                                  <input type="number" className="ov-prop-input" value={item.w ?? 120}
                                    onChange={e => ui(item.id, 'w', Number(e.target.value))} />
                                </div>
                                <div className="ov-prop-cell">
                                  <label>H</label>
                                  <input type="number" className="ov-prop-input" value={item.h ?? 80}
                                    onChange={e => ui(item.id, 'h', Number(e.target.value))} />
                                </div>
                              </div>
                            )}

                            {/* ── Opacity ── */}
                            <div className="ov-prop-row">
                              <SunDim size={12} />
                              <label>Opacity</label>
                              <input type="range" min="0" max="1" step="0.05"
                                className="ov-slider" style={{ maxWidth: '100px', flex: '0 0 100px' }} value={item.opacity ?? 1}
                                onChange={e => ui(item.id, 'opacity', Number(e.target.value))} />
                              <span className="ov-slider-val" style={{ minWidth: 'auto', width: '28px', textAlign: 'left' }}>{Math.round((item.opacity ?? 1) * 100)}%</span>
                            </div>

                            {/* ── Text / Alert Properties ── */}
                            {isText && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px', padding: '4px 0' }}>
                                {/* Kolom Kiri: Tipografi */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div className="ov-prop-grid" style={{ borderTop: 'none', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                    <div className="ov-prop-cell" style={{ flex: 1 }}>
                                      <label>Font Size</label>
                                      <input type="number" className="ov-prop-input" value={item.fontsize ?? 40}
                                        onChange={e => ui(item.id, 'fontsize', Number(e.target.value))} />
                                    </div>
                                    <div className="ov-prop-cell">
                                      <label>Color</label>
                                      <input type="color" value={item.fontcolor || '#ffffff'}
                                        onChange={e => ui(item.id, 'fontcolor', e.target.value)}
                                        className="ov-color-input" />
                                    </div>
                                  </div>

                                  <div className="ov-prop-row" style={{ borderTop: 'none', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                    <label>Font</label>
                                    <select className="ov-select" style={{ maxWidth: 100 }}
                                      value={PRESET_FONTS.includes(item.fontfamily) ? item.fontfamily : '__custom__'}
                                      onChange={e => {
                                        if (e.target.value !== '__custom__') ui(item.id, 'fontfamily', e.target.value);
                                      }}>
                                      {PRESET_FONTS.map(f => (<option key={f} value={f}>{f}</option>))}
                                      <option value="__custom__">Custom...</option>
                                    </select>
                                    <input type="text" className="ov-prop-input" style={{ width: 80, flex: 1 }}
                                      placeholder="Google Font" value={customFontInput}
                                      onChange={e => setCustomFontInput(e.target.value)}
                                    />
                                    <button className="btn btn-secondary ov-apply-btn" onClick={() => {
                                      if (customFontInput.trim()) {
                                        loadGFont(customFontInput.trim());
                                        ui(item.id, 'fontfamily', customFontInput.trim());
                                        setCustomFontInput('');
                                      }
                                    }}>OK</button>
                                  </div>

                                  <div className="ov-prop-row" style={{ borderTop: 'none', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <label>Style</label>
                                      <div className="ov-btn-group">
                                        <button className={`ov-style-btn ${item.bold ? 'active' : ''}`}
                                          onClick={() => ui(item.id, 'bold', !item.bold)} title="Bold"><Bold size={13} /></button>
                                        <button className={`ov-style-btn ${item.italic ? 'active' : ''}`}
                                          onClick={() => ui(item.id, 'italic', !item.italic)} title="Italic"><Italic size={13} /></button>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <label>Align</label>
                                      <div className="ov-btn-group">
                                        {[{v:'left',I:AlignLeft},{v:'center',I:AlignCenter},{v:'right',I:AlignRight}].map(({v,I})=>(
                                          <button key={v} className={`ov-style-btn ${(item.align||'center')===v?'active':''}`}
                                            onClick={() => ui(item.id,'align',v)} title={v}><I size={13}/></button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="ov-prop-row" style={{ borderTop: 'none', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                    <label>Thickness</label>
                                    <input type="range" min="0" max="10" step="1"
                                      className="ov-slider" style={{ maxWidth: '100px', flex: '0 0 100px' }} value={item.thickness ?? 0}
                                      onChange={e => ui(item.id, 'thickness', Number(e.target.value))} />
                                    <span className="ov-slider-val" style={{ minWidth: 'auto', width: '28px', textAlign: 'left' }}>{item.thickness ?? 0}px</span>
                                  </div>
                                </div>

                                {/* Kolom Kanan: Efek & Animasi */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div className="ov-prop-row" style={{ borderTop: 'none', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', flexWrap: 'wrap' }}>
                                    <Droplets size={12} />
                                    <label>Shadow</label>
                                    <button className={`ov-style-btn ${item.shadow ? 'active' : ''}`}
                                      onClick={() => ui(item.id, 'shadow', !item.shadow)}>
                                      {item.shadow ? 'ON' : 'OFF'}
                                    </button>
                                    {item.shadow && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', width: '100%' }}>
                                        <label>Color</label>
                                        <input type="color" value={item.shadowColor || '#000000'}
                                          onChange={e => ui(item.id, 'shadowColor', e.target.value)}
                                          className="ov-color-input" style={{ width: 32, height: 26 }} />
                                        <label>Blur</label>
                                        <input type="number" className="ov-prop-input" style={{ width: 60 }}
                                          value={item.shadowBlur ?? 4}
                                          onChange={e => ui(item.id, 'shadowBlur', Number(e.target.value))} />
                                      </div>
                                    )}
                                  </div>

                                  <div className="ov-prop-row" style={{ borderTop: 'none', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                    <Sparkles size={12} />
                                    <label>Animasi</label>
                                    <select className="ov-select" style={{ maxWidth: '140px', flex: '1' }} value={item.animation || 'none'}
                                      onChange={e => ui(item.id, 'animation', e.target.value)}>
                                      {ANIMATIONS.map(a => (
                                        <option key={a.value} value={a.value}>{a.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ── Position & Size (For Text Elements, moved to bottom) ── */}
                            {isText && (
                              <div className="ov-prop-grid" style={{ marginTop: '8px' }}>
                                <div className="ov-prop-cell">
                                  <label>X%</label>
                                  <input type="number" className="ov-prop-input" value={item.x ?? 50}
                                    onChange={e => ui(item.id, 'x', Number(e.target.value))} />
                                </div>
                                <div className="ov-prop-cell">
                                  <label>Y%</label>
                                  <input type="number" className="ov-prop-input" value={item.y ?? 50}
                                    onChange={e => ui(item.id, 'y', Number(e.target.value))} />
                                </div>
                                <div className="ov-prop-cell">
                                  <label>W</label>
                                  <input type="number" className="ov-prop-input" value={item.w ?? 120}
                                    onChange={e => ui(item.id, 'w', Number(e.target.value))} />
                                </div>
                                <div className="ov-prop-cell">
                                  <label>H</label>
                                  <input type="number" className="ov-prop-input" value={item.h ?? 80}
                                    onChange={e => ui(item.id, 'h', Number(e.target.value))} />
                                </div>
                              </div>
                            )}

                            {/* Image URL */}
                            {item.type === 'image' && (
                              <div className="ov-prop-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                                <label>URL</label>
                                <input type="text" className="ov-prop-input ov-prop-full"
                                  value={item.imageUrl || ''} placeholder="https://..."
                                  onChange={e => ui(item.id, 'imageUrl', e.target.value)} />
                              </div>
                            )}

                            {/* Gallery replace */}
                            {item.type === 'gallery' && (
                              <div className="ov-prop-row">
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</span>
                                <button className="btn btn-secondary" style={{ fontSize: '10px', padding: '3px 8px', flexShrink:0 }}
                                  onClick={() => setShowGalleryPicker(true)}>Ganti</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {(!currentScene || currentScene.items.length === 0) && (
                    <p className="empty-text">Belum ada element. Klik <strong>Add</strong>.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
