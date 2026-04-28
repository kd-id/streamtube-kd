import React, { useState } from 'react';
import { X, Mail, Copy, Check } from 'lucide-react';
import './ShareModal.css';

// Minimal inline SVGs for brands without relying on heavy external libs
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const RedditIcon = () => (
  <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
    <path d="M22 11.816c0-1.256-1.02-2.277-2.277-2.277-.593 0-1.122.252-1.526.634-1.488-1.066-3.486-1.745-5.69-1.836l1.242-5.835 4.02 1.002c.023 1.139.957 2.052 2.1 2.052 1.155 0 2.096-.941 2.096-2.096 0-1.154-.94-2.095-2.096-2.095-.873 0-1.616.536-1.921 1.29l-4.502-1.124a.482.482 0 0 0-.585.378l-1.353 6.368c-2.235.068-4.262.748-5.772 1.832-.403-.38-.934-.632-1.53-.632-1.255 0-2.276 1.02-2.276 2.277 0 .861.487 1.62 1.205 2.02-.047.242-.073.49-.073.743 0 3.125 4.053 5.679 9.034 5.679 4.982 0 9.035-2.554 9.035-5.68 0-.251-.026-.499-.072-.741.716-.4 1.203-1.156 1.203-2.015zM8.595 15.63a1.474 1.474 0 1 1 0-2.947 1.474 1.474 0 0 1 0 2.947zm6.756 2.505c-1.066 1.066-3.645 1.066-3.645 1.066s-2.58 0-3.641-1.066a.35.35 0 0 1 .496-.495c.783.784 2.453 1.042 3.145 1.042.693 0 2.363-.258 3.146-1.042a.35.35 0 0 1 .499.495zm-1.01-2.505a1.474 1.474 0 1 1 0-2.947 1.474 1.474 0 0 1 0 2.947z"/>
  </svg>
);

export default function ShareModal({ isOpen, onClose, stream, getDashboardUrl }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !stream) return null;

  const getShareUrl = (s) => {
    if (s.platform === 'youtube' || !s.platform) {
      if (s.broadcastId) {
        return `https://youtube.com/live/${s.broadcastId}?feature=share`;
      }
    }
    if (s.videoUrl) return s.videoUrl;
    return getDashboardUrl(s) || 'https://youtube.com/live/';
  };

  const shareUrl = getShareUrl(stream);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
  };

  const handleSocialShare = (platform) => {
    let url = '';
    const text = `Saksikan livestream saya: ${stream.title}`;
    
    switch (platform) {
      case 'whatsapp': url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + shareUrl)}`; break;
      case 'facebook': url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`; break;
      case 'twitter': url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`; break;
      case 'reddit': url = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(text)}`; break;
      case 'email': url = `mailto:?subject=${encodeURIComponent(stream.title)}&body=${encodeURIComponent(text + '\n' + shareUrl)}`; break;
    }
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Resolve thumbnail
  let thumbSrc = null;
  if (stream.selectedMedia?.serverFilename) {
    thumbSrc = `/api/video/thumbnail/${encodeURIComponent(stream.selectedMedia.serverFilename)}`;
  } else if (stream.thumbnailUrl && !stream.thumbnailUrl.startsWith('blob:')) {
    thumbSrc = stream.thumbnailUrl;
  }

  // Formatting date
  const dateStr = stream.createdAt || new Date().toISOString();
  const formattedDate = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="share-modal-content glass-card" onClick={e => e.stopPropagation()}>
        
        <div className="share-modal-header">
          <h3>Share Livestream</h3>
          <button className="share-modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="share-modal-body">
          <div className="share-stream-card">
            <div className="share-thumb">
              {thumbSrc ? (
                 <img src={thumbSrc} alt="" onError={(e) => e.target.style.display='none'} />
              ) : (
                 <div className="share-thumb-empty" />
              )}
              {stream.status === 'live' && (
                <span className="share-thumb-badge live">LIVE</span>
              )}
            </div>
            <div className="share-stream-info">
              <span className="share-stream-title">{stream.title}</span>
              <span className="share-stream-date">Terakhir diupdate {formattedDate}</span>
            </div>
          </div>

          <div className="share-social-section">
            <h4>Share a link</h4>
            <div className="share-social-scroll">
              <button className="share-social-btn" onClick={() => handleSocialShare('whatsapp')}>
                <div className="share-icon-wrap" style={{ background: '#25D366' }}>
                  <WhatsAppIcon />
                </div>
                <span>WhatsApp</span>
              </button>
              
              <button className="share-social-btn" onClick={() => handleSocialShare('facebook')}>
                <div className="share-icon-wrap" style={{ background: '#1877F2' }}>
                  <FacebookIcon />
                </div>
                <span>Facebook</span>
              </button>
              
              <button className="share-social-btn" onClick={() => handleSocialShare('twitter')}>
                <div className="share-icon-wrap" style={{ background: '#000000', border: '1px solid #333' }}>
                  <XIcon />
                </div>
                <span>X</span>
              </button>
              
              <button className="share-social-btn" onClick={() => handleSocialShare('email')}>
                <div className="share-icon-wrap" style={{ background: '#808080' }}>
                  <Mail fill="white" size={20} />
                </div>
                <span>Email</span>
              </button>
              
              <button className="share-social-btn" onClick={() => handleSocialShare('reddit')}>
                <div className="share-icon-wrap" style={{ background: '#FF4500' }}>
                  <RedditIcon />
                </div>
                <span>Reddit</span>
              </button>
            </div>
          </div>

          <div className="share-link-section">
            <div className="share-link-box">
              <span className="share-link-label">Video link</span>
              <div className="share-link-wrapper">
                <input 
                  type="text" 
                  value={shareUrl} 
                  readOnly 
                  onClick={e => e.target.select()}
                />
                <button className="share-copy-btn" onClick={handleCopy} title="Copy Link">
                  {copied ? <Check size={18} color="var(--accent-blue)" /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}
