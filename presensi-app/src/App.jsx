import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Camera, RefreshCw, CheckCircle2, XCircle, Shield,
  Settings, LogOut, Download, Trash2, Key, HelpCircle, UserCheck,
  Copy, CheckCheck
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, remove } from 'firebase/database';
import logoImg from './assets/logo.jpeg'; // Pastikan logo.jpeg ada di folder src/assets/

// Inisialisasi Firebase menggunakan Environment Variables dari Vite/Vercel
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const DEFAULT_TARGET_LOCATION = {
  name: 'Sawah Sekar Tani',
  lat: -7.7599,
  lng: 110.4091,
  radius: 100
};

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPin, setAdminPin] = useState(() => localStorage.getItem('presensi_admin_pin') || 'admin123');
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinError, setPinError] = useState('');

  const [newPin, setNewPin] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState('');

  // Target Lokasi disinkronkan langsung dari Firebase
  const [targetLocation, setTargetLocation] = useState(DEFAULT_TARGET_LOCATION);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('logs');

  const [fullName, setFullName] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState('');

  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Log Presensi disinkronkan langsung dari Firebase
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [searchLog, setSearchLog] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Listener Realtime Database untuk Lokasi Target
  useEffect(() => {
    const targetRef = ref(db, 'settings/targetLocation');
    const unsubscribe = onValue(targetRef, (snapshot) => {
      if (snapshot.exists()) {
        setTargetLocation(snapshot.val());
      }
    });
    return () => unsubscribe();
  }, []);

  // Listener Realtime Database untuk Log Kehadiran
  useEffect(() => {
    const logsRef = ref(db, 'attendanceLogs');
    const unsubscribe = onValue(logsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const formattedLogs = Object.keys(data).map(key => ({
          firebaseKey: key,
          ...data[key]
        })).sort((a, b) => b.id - a.id);
        setAttendanceLogs(formattedLogs);
      } else {
        setAttendanceLogs([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchCurrentLocation = useCallback(() => {
    setLocLoading(true);
    setLocError('');
    if (!navigator.geolocation) {
      setLocError('Geolokasi tidak didukung oleh browser Anda.');
      setLocLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        const dist = calculateDistance(latitude, longitude, targetLocation.lat, targetLocation.lng);
        setDistance(dist);
        setIsWithinRadius(dist <= targetLocation.radius);
        setLocLoading(false);
      },
      (err) => {
        setLocError(`Gagal mengambil lokasi: ${err.message}. Pastikan izin GPS aktif.`);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [targetLocation.lat, targetLocation.lng, targetLocation.radius]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchCurrentLocation(); }, 100);
    return () => clearTimeout(timer);
  }, [fetchCurrentLocation]);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch {
      setCameraError('Gagal mengakses kamera. Izinkan akses kamera pada browser Anda.');
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!isAdmin && !capturedPhoto) {
      const timer = setTimeout(() => { startCamera(); }, 100);
      return () => { clearTimeout(timer); stopCamera(); };
    }
    return () => { stopCamera(); };
  }, [isAdmin, capturedPhoto, startCamera, stopCamera]);

  const captureSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
      stopCamera();
    }
  };

  const retakePhoto = () => { setCapturedPhoto(null); };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (pinInput === adminPin) {
      setIsAdmin(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('PIN Admin Salah!');
    }
  };

  const handleAdminLogout = () => { setIsAdmin(false); setActiveTab('logs'); };

  const handleChangePin = (e) => {
    e.preventDefault();
    if (newPin.trim().length >= 4) {
      setAdminPin(newPin);
      localStorage.setItem('presensi_admin_pin', newPin);
      setPinChangeSuccess('PIN berhasil diperbarui!');
      setNewPin('');
      setTimeout(() => setPinChangeSuccess(''), 3000);
    }
  };

  const generateShareLink = () => {
    // URL tidak lagi memerlukan parameter karena tersinkronisasi server
    return window.location.origin + window.location.pathname;
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(generateShareLink());
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch {
      const el = document.createElement('textarea');
      el.value = generateShareLink();
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  const handleSaveTargetLocation = (e) => {
    e.preventDefault();
    // Simpan ke Firebase
    set(ref(db, 'settings/targetLocation'), targetLocation)
      .then(() => {
        fetchCurrentLocation();
        alert('Lokasi target presensi berhasil diperbarui ke semua perangkat!');
      })
      .catch((error) => alert('Gagal menyimpan koordinat: ' + error.message));
  };

  const setCurrentAsTarget = () => {
    if (userLocation) {
      setTargetLocation({
        ...targetLocation,
        lat: Number(userLocation.lat.toFixed(6)),
        lng: Number(userLocation.lng.toFixed(6)),
      });
    } else {
      alert('Lokasi GPS Anda belum terdeteksi.');
    }
  };

  const handleSubmitAttendance = (e) => {
    e.preventDefault();
    if (!fullName.trim()) { alert('Harap isi Nama Lengkap Anda.'); return; }
    if (!capturedPhoto) { alert('Harap ambil foto selfie terlebih dahulu.'); return; }
    if (!isWithinRadius) { alert('Gagal! Anda berada di luar radius lokasi presensi.'); return; }

    const newRecord = {
      id: Date.now(),
      name: fullName,
      timestamp: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }),
      lat: userLocation ? userLocation.lat : null,
      lng: userLocation ? userLocation.lng : null,
      distance: distance ? Math.round(distance) : 0,
      photo: capturedPhoto,
    };

    // Kirim data presensi ke Firebase
    push(ref(db, 'attendanceLogs'), newRecord)
      .then(() => {
        setSubmitSuccess(true);
        setFullName('');
        setCapturedPhoto(null);
      })
      .catch((error) => alert('Gagal mengirim presensi: ' + error.message));
  };

  const deleteLog = (firebaseKey) => {
    if (window.confirm('Hapus catatan presensi ini?')) {
      // Hapus data spesifik dari Firebase
      remove(ref(db, `attendanceLogs/${firebaseKey}`))
        .catch((error) => alert('Gagal menghapus log: ' + error.message));
    }
  };

  const exportToCSV = () => {
    if (attendanceLogs.length === 0) { alert('Tidak ada data untuk diekspor.'); return; }
    const headers = ['ID', 'Waktu', 'Nama Lengkap', 'Jarak (m)', 'Latitude', 'Longitude'];
    const rows = attendanceLogs.map((log) => [
      log.id, `"${log.timestamp}"`, `"${log.name}"`, log.distance, log.lat, log.lng,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `rekap_presensi_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = attendanceLogs.filter((log) =>
    log.name.toLowerCase().includes(searchLog.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ios-bg)' }}>
      {/* ===== iOS NAVBAR ===== */}
      <header className="ios-navbar">
        <div className="ios-navbar-inner">
          <div className="ios-brand">
            <img src={logoImg} alt="Logo Presensi" className="ios-brand-logo" />
            <div>
              <div className="ios-brand-title">Presensi Sekar Tani</div>
              <div className="ios-brand-subtitle">Bergerak Berdampak Migunani</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isAdmin ? (
              <button
                id="btn-admin-login"
                className="ios-btn ios-btn-admin"
                onClick={() => setShowPinModal(true)}
              >
                <Shield size={13} />
                Admin
              </button>
            ) : (
              <>
                <span className="ios-btn-admin-badge">Admin Active</span>
                <button className="ios-btn-logout" onClick={handleAdminLogout}>
                  <LogOut size={13} />
                  Keluar
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="ios-main">
        {!isAdmin ? (
          /* ==================== USER INTERFACE ==================== */
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            {submitSuccess ? (
              <div className="ios-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div className="ios-success-icon" style={{ marginBottom: 18 }}>
                  <CheckCircle2 size={36} />
                </div>
                <div className="ios-body-lg" style={{ marginBottom: 8 }}>Presensi Berhasil Dikirim!</div>
                <div className="ios-caption" style={{ marginBottom: 28 }}>
                  Data lokasi dan bukti foto selfie Anda telah dicatat oleh sistem.
                </div>
                <button
                  id="btn-absen-lagi"
                  className="ios-btn ios-btn-success"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 16 }}
                  onClick={() => setSubmitSuccess(false)}
                >
                  Absen Lagi
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitAttendance} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* GPS Status Card */}
                <div>
                  <div className="ios-section-label">Status Lokasi GPS</div>
                  <div className="ios-card">
                    {locLoading ? (
                      <div className="ios-status-row">
                        <div className="ios-caption" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--ios-blue)' }} />
                          Mengambil koordinat GPS...
                        </div>
                      </div>
                    ) : locError ? (
                      <div className="ios-card-section">
                        <div style={{
                          background: 'rgba(255,59,48,0.08)', borderRadius: 10,
                          padding: '10px 14px', color: 'var(--ios-red)', fontSize: 13
                        }}>
                          {locError}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="ios-status-row">
                          <div>
                            <div className="ios-caption">Jarak ke Target</div>
                            <div className="ios-body-lg" style={{ marginTop: 2 }}>
                              {distance !== null ? `${Math.round(distance)} meter` : '—'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="ios-caption">Batas Toleransi</div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ios-label)', marginTop: 2 }}>
                              {targetLocation.radius} meter
                            </div>
                          </div>
                        </div>
                        <hr className="ios-card-divider" />
                        <div className="ios-status-row">
                          <div>
                            {isWithinRadius ? (
                              <span className="ios-pill-success">
                                <CheckCircle2 size={13} />
                                Di Lokasi {targetLocation.name}
                              </span>
                            ) : (
                              <span className="ios-pill-danger">
                                <XCircle size={13} />
                                Di Luar Radius (≤ {targetLocation.radius}m)
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            id="btn-refresh-gps"
                            onClick={fetchCurrentLocation}
                            disabled={locLoading}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--ios-blue)', display: 'flex', alignItems: 'center',
                              gap: 4, fontSize: 13, fontWeight: 600
                            }}
                          >
                            <RefreshCw size={14} />
                            Perbarui
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Nama Lengkap */}
                <div>
                  <div className="ios-section-label">Nama Lengkap</div>
                  <input
                    id="input-nama"
                    type="text"
                    required
                    placeholder="Masukkan nama lengkap Anda"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="ios-input"
                  />
                </div>

                {/* Camera */}
                <div>
                  <div className="ios-section-label">Bukti Foto Selfie</div>
                  <div className="ios-camera-wrap">
                    {cameraError ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: '100%', padding: 20, textAlign: 'center',
                        color: 'var(--ios-red)', fontSize: 13
                      }}>
                        {cameraError}
                      </div>
                    ) : capturedPhoto ? (
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <img
                          src={capturedPhoto}
                          alt="Snapshot Presensi"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          id="btn-foto-ulang"
                          onClick={retakePhoto}
                          style={{
                            position: 'absolute', bottom: 12, right: 12,
                            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
                            color: '#fff', border: 'none', borderRadius: 20,
                            padding: '8px 16px', fontSize: 13, fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
                          }}
                        >
                          <RefreshCw size={13} />
                          Foto Ulang
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                        />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        {cameraActive && (
                          <button
                            type="button"
                            id="btn-ambil-foto"
                            onClick={captureSnapshot}
                            style={{
                              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                              background: 'rgba(255,255,255,0.95)', color: '#000',
                              border: 'none', borderRadius: 30, padding: '10px 24px',
                              fontSize: 14, fontWeight: 700,
                              display: 'flex', alignItems: 'center', gap: 8,
                              cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                            }}
                          >
                            <Camera size={15} />
                            Ambil Foto
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit */}
                <button
                  id="btn-submit-presensi"
                  type="submit"
                  disabled={!isWithinRadius || !capturedPhoto || !fullName.trim()}
                  className="ios-btn ios-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '15px 22px' }}
                >
                  Kirim Presensi Sekarang
                </button>
              </form>
            )}
          </div>
        ) : (
          /* ==================== ADMIN INTERFACE ==================== */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="ios-segmented">
              <button
                id="tab-logs"
                className={`ios-segmented-btn${activeTab === 'logs' ? ' active' : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                <UserCheck size={13} />
                Rekap Presensi
              </button>
              <button
                id="tab-settings"
                className={`ios-segmented-btn${activeTab === 'settings' ? ' active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings size={13} />
                Pengaturan
              </button>
              <button
                id="tab-deploy"
                className={`ios-segmented-btn${activeTab === 'deploy' ? ' active' : ''}`}
                onClick={() => setActiveTab('deploy')}
              >
                <HelpCircle size={13} />
                Panduan
              </button>
            </div>

            {/* TAB 1: LOGS */}
            {activeTab === 'logs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div className="ios-body-lg">Laporan Kehadiran</div>
                    <div className="ios-caption" style={{ marginTop: 2 }}>Total: {attendanceLogs.length} data tersimpan di server</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      id="input-search-log"
                      type="text"
                      placeholder="Cari nama..."
                      value={searchLog}
                      onChange={(e) => setSearchLog(e.target.value)}
                      className="ios-input"
                      style={{ width: 150, padding: '8px 14px', fontSize: 14 }}
                    />
                    <button
                      id="btn-export-csv"
                      className="ios-btn ios-btn-primary"
                      style={{ padding: '9px 16px', fontSize: 13 }}
                      onClick={exportToCSV}
                    >
                      <Download size={13} />
                      Export CSV
                    </button>
                  </div>
                </div>

                <div className="ios-card" style={{ overflowX: 'auto' }}>
                  <table className="ios-table">
                    <thead>
                      <tr>
                        <th>Foto</th>
                        <th>Nama Lengkap</th>
                        <th>Waktu</th>
                        <th>Jarak</th>
                        <th style={{ textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: 'var(--ios-label-3)', padding: '32px 14px' }}>
                            Belum ada riwayat presensi.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => (
                          <tr key={log.firebaseKey}>
                            <td>
                              {log.photo ? (
                                <img
                                  src={log.photo}
                                  alt="Selfie"
                                  onClick={() => setPreviewPhoto(log.photo)}
                                  style={{
                                    width: 38, height: 38, objectFit: 'cover',
                                    borderRadius: 8, cursor: 'pointer',
                                    boxShadow: 'var(--ios-shadow-sm)'
                                  }}
                                />
                              ) : (
                                <span style={{ color: 'var(--ios-gray-2)', fontStyle: 'italic' }}>—</span>
                              )}
                            </td>
                            <td style={{ fontWeight: 600 }}>{log.name}</td>
                            <td style={{ color: 'var(--ios-label-3)' }}>{log.timestamp}</td>
                            <td>
                              <span className="ios-distance-badge">{log.distance}m</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                onClick={() => deleteLog(log.firebaseKey)}
                                style={{
                                  background: 'none', border: 'none',
                                  color: 'var(--ios-red)', cursor: 'pointer',
                                  padding: '6px 8px', borderRadius: 8,
                                  display: 'inline-flex', alignItems: 'center'
                                }}
                                title="Hapus"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: SETTINGS */}
            {activeTab === 'settings' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                <form onSubmit={handleSaveTargetLocation} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div className="ios-section-label">Sinkronisasi Koordinat (Server)</div>
                  <div className="ios-card">
                    <div className="ios-card-section" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--ios-separator)' }}>
                        <MapPin size={15} style={{ color: 'var(--ios-blue)' }} />
                        <span style={{ fontWeight: 700, fontSize: 15 }}>Atur Lokasi Target Server</span>
                      </div>

                      <div>
                        <label style={{ fontSize: 12, color: 'var(--ios-label-3)', fontWeight: 500, marginBottom: 6, display: 'block' }}>Nama Lokasi</label>
                        <input
                          id="input-location-name"
                          type="text"
                          value={targetLocation?.name || ''}
                          onChange={(e) => setTargetLocation({ ...targetLocation, name: e.target.value })}
                          className="ios-input"
                          style={{ fontSize: 14 }}
                          required
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--ios-label-3)', fontWeight: 500, marginBottom: 6, display: 'block' }}>Latitude</label>
                          <input
                            id="input-latitude"
                            type="number" step="any"
                            value={targetLocation?.lat || 0}
                            onChange={(e) => setTargetLocation({ ...targetLocation, lat: parseFloat(e.target.value) || 0 })}
                            className="ios-input"
                            style={{ fontSize: 13 }}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--ios-label-3)', fontWeight: 500, marginBottom: 6, display: 'block' }}>Longitude</label>
                          <input
                            id="input-longitude"
                            type="number" step="any"
                            value={targetLocation?.lng || 0}
                            onChange={(e) => setTargetLocation({ ...targetLocation, lng: parseFloat(e.target.value) || 0 })}
                            className="ios-input"
                            style={{ fontSize: 13 }}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: 12, color: 'var(--ios-label-3)', fontWeight: 500, marginBottom: 6, display: 'block' }}>Radius Toleransi (Meter)</label>
                        <input
                          id="input-radius"
                          type="number"
                          value={targetLocation?.radius || 10}
                          onChange={(e) => setTargetLocation({ ...targetLocation, radius: parseInt(e.target.value) || 10 })}
                          className="ios-input"
                          style={{ fontSize: 14 }}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          type="button"
                          id="btn-gunakan-gps"
                          className="ios-btn ios-btn-ghost"
                          style={{ flex: 1, justifyContent: 'center' }}
                          onClick={setCurrentAsTarget}
                        >
                          <MapPin size={13} />
                          Gunakan GPS Saya
                        </button>
                        <button
                          type="submit"
                          id="btn-simpan-lokasi"
                          className="ios-btn ios-btn-primary"
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          Push ke Server
                        </button>
                      </div>

                      <div style={{ paddingTop: 4 }}>
                        <div style={{ fontSize: 12, color: 'var(--ios-label-3)', fontWeight: 500, marginBottom: 8 }}>
                          Link Utama Aplikasi (Tanpa Parameter):
                        </div>
                        <div style={{
                          background: 'var(--ios-gray-6)', borderRadius: 10,
                          padding: '10px 12px', fontSize: 11,
                          color: 'var(--ios-blue)', fontFamily: 'monospace',
                          wordBreak: 'break-all', marginBottom: 10,
                          border: '1px solid var(--ios-separator)'
                        }}>
                          {generateShareLink()}
                        </div>
                        <button
                          type="button"
                          id="btn-salin-link"
                          onClick={copyShareLink}
                          className={`ios-btn ${copySuccess ? 'ios-btn-success' : 'ios-btn-primary'}`}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          {copySuccess ? <CheckCheck size={14} /> : <Copy size={14} />}
                          {copySuccess ? 'Link Tersalin!' : 'Salin Link Presensi'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>

                <form onSubmit={handleChangePin} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div className="ios-section-label">Ubah PIN Admin (Local)</div>
                  <div className="ios-card">
                    <div className="ios-card-section" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--ios-separator)' }}>
                        <Key size={15} style={{ color: 'var(--ios-blue)' }} />
                        <span style={{ fontWeight: 700, fontSize: 15 }}>PIN Admin</span>
                      </div>

                      {pinChangeSuccess && (
                        <div style={{
                          background: 'rgba(52,199,89,0.12)', borderRadius: 10,
                          padding: '10px 14px', color: 'var(--ios-green-dark)', fontSize: 13
                        }}>
                          {pinChangeSuccess}
                        </div>
                      )}

                      <div>
                        <label style={{ fontSize: 12, color: 'var(--ios-label-3)', fontWeight: 500, marginBottom: 6, display: 'block' }}>PIN Baru (Min. 4 Karakter)</label>
                        <input
                          id="input-new-pin"
                          type="password"
                          placeholder="Masukkan PIN baru"
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value)}
                          className="ios-input"
                          style={{ fontSize: 15, letterSpacing: 4 }}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        id="btn-update-pin"
                        className="ios-btn ios-btn-primary"
                        style={{ justifyContent: 'center' }}
                      >
                        Update PIN
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 3: PANDUAN */}
            {activeTab === 'deploy' && (
              <div>
                <div className="ios-section-label">Panduan Firebase Mode</div>
                <div className="ios-card">
                  <div className="ios-card-section">
                    <p style={{ fontSize: 14, color: 'var(--ios-label-2)', lineHeight: 1.5, marginBottom: 12 }}>
                      Aplikasi kini telah terhubung ke **Firebase Realtime Database**.
                    </p>
                    <ul style={{ fontSize: 14, color: 'var(--ios-label-2)', lineHeight: 1.6, paddingLeft: 20 }}>
                      <li>Setiap perubahan koordinat target yang Anda klik **"Push ke Server"** akan secara instan berubah di *smartphone* seluruh peserta yang sedang membuka web.</li>
                      <li>Data presensi yang dikirim peserta tidak lagi tersimpan di perangkat lokal, melainkan masuk terpusat ke database server Anda.</li>
                      <li>Link utama tidak perlu dibagikan ulang setiap kali Anda merubah titik kordinat. Cukup bagikan link domain utamanya saja.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ===== MODAL ADMIN LOGIN ===== */}
      {showPinModal && (
        <div className="ios-modal-overlay" onClick={() => setShowPinModal(false)}>
          <div className="ios-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ios-modal-handle" />

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'rgba(0,122,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', color: 'var(--ios-blue)'
              }}>
                <Shield size={24} />
              </div>
              <div className="ios-body-lg" style={{ marginBottom: 4 }}>Masuk Mode Admin</div>
              <div className="ios-caption">Masukkan PIN Admin untuk mengakses panel kontrol.</div>
            </div>

            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pinError && (
                <div style={{
                  background: 'rgba(255,59,48,0.08)', borderRadius: 10,
                  padding: '10px 14px', color: 'var(--ios-red)', fontSize: 13, textAlign: 'center'
                }}>
                  {pinError}
                </div>
              )}

              <input
                id="input-pin-admin"
                type="password"
                required
                placeholder="PIN Default: admin123"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="ios-input"
                style={{ textAlign: 'center', letterSpacing: 6, fontSize: 18 }}
                autoFocus
              />

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  id="btn-batal-modal"
                  className="ios-btn ios-btn-ghost"
                  style={{ flex: 1, justifyContent: 'center', padding: '13px' }}
                  onClick={() => setShowPinModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="btn-verifikasi-pin"
                  className="ios-btn ios-btn-primary"
                  style={{ flex: 1, justifyContent: 'center', padding: '13px' }}
                >
                  Verifikasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL PREVIEW FOTO ===== */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(12px)',
            zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, cursor: 'pointer'
          }}
        >
          <div style={{
            maxWidth: 420, width: '100%',
            borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)'
          }}>
            <img src={previewPhoto} alt="Bukti Foto" style={{ width: '100%', display: 'block' }} />
            <div style={{
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(10px)',
              color: 'rgba(255,255,255,0.7)',
              textAlign: 'center', fontSize: 13,
              padding: '12px'
            }}>
              Ketuk di mana saja untuk menutup
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}