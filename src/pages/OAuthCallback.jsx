import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useYouTube } from '../hooks/useYouTubeStore';
import './Login.css';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleYouTubeCallback } = useYouTube();
  const [error, setError] = useState(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('Otorisasi YouTube dibatalkan atau gagal. Silakan coba lagi.');
      return;
    }

    if (!code) {
      setError('Kode otorisasi tidak ditemukan.');
      return;
    }

    handleYouTubeCallback(code)
      .then(() => {
        navigate('/settings', { replace: true });
      })
      .catch((err) => {
        setError(`Gagal: ${err.message || 'Terjadi kesalahan saat menghubungkan YouTube channel.'}`);
      });
  }, [handleYouTubeCallback, navigate, searchParams]);

  if (error) {
    return (
      <div className="oauth-callback">
        <div className="oauth-error">
          <h2>Koneksi YouTube Gagal</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/settings', { replace: true })}>
            Kembali ke Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="oauth-callback">
      <div className="oauth-spinner" />
      <h2>Menghubungkan YouTube Channel...</h2>
      <p>Mohon tunggu, sedang memproses otorisasi</p>
    </div>
  );
}
