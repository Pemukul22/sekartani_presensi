import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  Lock, 
  RefreshCw, 
  FileText, 
  Settings, 
  KeyRound, 
  Upload, 
  Download, 
  Trash2, 
  Search, 
  X, 
  AlertTriangle, 
  UserCheck, 
  LogOut,
  ShieldCheck,
  User,
  Globe,
  Code2
} from 'lucide-react';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters
};

export default function App() {
  // Admin Mode & Security State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');
  const [adminPin, setAdminPin] = useState(() => {
    return localStorage.getItem('presensi_admin_pin') || 'admin123';
  });

  // Navigation for Admin Panel
  const [adminTab, setAdminTab] = useState('riwayat'); // 'riwayat', 'lokasi', 'pin', 'deploy'

  // Location Settings State (Managed solely by Admin)
  const [targetLocation, setTargetLocation] = useState(() => {
    const saved = localStorage.getItem('presensi_target_location');
    return saved ? JSON.parse(saved) : {
      name: 'Kantor / Sekolah Utama',
      lat: -6.175392,
      lng: 106.827153,
      radius: 50 // Default 50 meters radius limit
    };
  });

  // Current User GPS State
  const [userCoords, setUserCoords] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [isFetchingGps, setIsFetchingGps] = useState(false);
  const [distance, setDistance] = useState(null);

  // Ultra-simplified User Form State (Only Full Name)
  const [employeeName, setEmployeeName] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);

  // Camera & Selfie State
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  // Attendance Logs Storage
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('presensi_logs');
    return saved ? JSON.parse(saved) : [];
  });

  // UI Toast & Modal State
  const [toast, setToast] = useState(null);
  const [selectedPhotoModal, setSelectedPhotoModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // PIN Reset Form State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  useEffect(() => {
    localStorage.setItem('presensi_target_location', JSON.stringify(targetLocation));
  }, [targetLocation]);

  useEffect(() => {
    localStorage.setItem('presensi_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('presensi_admin_pin', adminPin);
  }, [adminPin]);

  const fetchCurrentLocation = () => {
    setIsFetchingGps(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Browser tidak mendukung GPS Geolocation.');
      setIsFetchingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setUserCoords(coords);
        setIsFetchingGps(false);

        // Compute distance to target office coordinates
        const dist = calculateDistance(
          coords.lat,
          coords.lng,
          targetLocation.lat,
          targetLocation.lng
        );
        setDistance(dist);
      },
      (err) => {
        console.error('GPS Error:', err);
        setIsFetchingGps(false);
        if (err.code === 1) {
          setGpsError('Akses lokasi ditolak. Harap izinkan GPS pada browser Anda.');
        } else if (err.code === 2) {
          setGpsError('Sinyal GPS tidak ditemukan.');
        } else {
          setGpsError('Gagal mendapatkan lokasi GPS saat ini.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    fetchCurrentLocation();
  }, [targetLocation]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera stream error:', err);
      setCameraError('Kamera tidak diizinkan atau tidak ditemukan.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    if (!isAdmin && !capturedPhoto) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isAdmin, capturedPhoto]);

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    // Mirror standard selfie orientation
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleSubmitAttendance = (e) => {
    e.preventDefault();

    if (!employeeName.trim()) {
      showToast('Harap masukkan Nama Lengkap Anda.', 'error');
      return;
    }

    if (!capturedPhoto) {
      showToast('Bukti foto selfie wajib diambil!', 'error');
      return;
    }

    const isOutOfRange = distance !== null && distance > targetLocation.radius;
    if (isOutOfRange) {
      showToast(`Gagal Absen! Anda berada di luar radius lokasi (${distance}m > ${targetLocation.radius}m).`, 'error');
      return;
    }

    const newRecord = {
      id: Date.now(),
      employeeName: employeeName.trim(),
      timestamp: new Date().toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'medium'
      }),
      distance: distance !== null ? `${distance} m` : 'N/A',
      isValidLocation: !isOutOfRange,
      photo: capturedPhoto
    };

    setLogs([newRecord, ...logs]);
    setLastReceipt(newRecord);
    showToast(`Presensi Berhasil Ditambahkan!`, 'success');

    // Reset Form Snapshot
    setCapturedPhoto(null);
    setEmployeeName('');
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPinInput === adminPin) {
      setIsAdmin(true);
      setShowAdminLoginModal(false);
      setAdminPinInput('');
      setAdminPinError('');
      showToast('Berhasil masuk ke Mode Admin', 'success');
    } else {
      setAdminPinError('PIN Admin salah. Silakan coba lagi.');
    }
  };

  const handleChangePin = (e) => {
    e.preventDefault();
    if (newPin.length < 4) {
      showToast('PIN minimal 4 karakter.', 'error');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('Konfirmasi PIN baru tidak cocok.', 'error');
      return;
    }
    setAdminPin(newPin);
    setNewPin('');
    setConfirmPin('');
    showToast('PIN Admin berhasil diperbarui!', 'success');
  };

  const exportToCSV = () => {
    if (logs.length === 0) {
      showToast('Tidak ada data riwayat presensi.', 'error');
      return;
    }

    const headers = ['Nama Lengkap', 'Waktu', 'Jarak (m)', 'Status Lokasi'];
    const rows = logs.map(log => [
      `"${log.employeeName}"`,
      `"${log.timestamp}"`,
      `"${log.distance}"`,
      `"${log.isValidLocation ? 'DALAM RADIUS' : 'LUAR RADIUS'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Presensi_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter(log =>
    log.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isWithinRadius = distance !== null && distance <= targetLocation.radius;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      
      {}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 shadow-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2 rounded-xl shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                Presensi Geolokasi
              </h1>
              <p className="text-[11px] text-slate-400">Target: {targetLocation.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isAdmin ? (
              <button
                onClick={() => setShowAdminLoginModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold transition-all"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Mode</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsAdmin(false);
                  showToast('Keluar dari Mode Admin', 'info');
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar Admin</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl shadow-2xl border text-xs sm:text-sm font-medium transition-all ${
          toast.type === 'error' 
            ? 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-950/50' 
            : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-950/50'
        }`}>
          {toast.type === 'error' ? <XCircle className="w-5 h-5 text-rose-400 shrink-0" /> : <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col space-y-6">

        {/* ================= USER MODE: ULTRA-SIMPLE ATTENDANCE FORM ================= */}
        {!isAdmin && (
          <div className="max-w-md mx-auto w-full space-y-5">
            
            {/* Realtime GPS Status Banner */}
            <div className={`p-4 rounded-2xl border flex items-start space-x-3 transition-all ${
              isWithinRadius 
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200' 
                : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
            }`}>
              {isWithinRadius ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-1 flex-1">
                <p className="font-bold text-sm">
                  {isWithinRadius 
                    ? 'Dalam Radius (Siap Absen)' 
                    : 'Di Luar Radius (Akses Dibatasi)'}
                </p>
                <p className="text-slate-300 leading-relaxed">
                  Jarak Anda: <strong>{distance !== null ? `${distance}m` : 'Mencari GPS...'}</strong>. Batas radius lokasi: <strong>{targetLocation.radius}m</strong>.
                </p>
                {gpsError && <p className="text-rose-400 font-medium">{gpsError}</p>}
              </div>
              <button 
                onClick={fetchCurrentLocation} 
                className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs shrink-0 border border-slate-700"
                title="Cek Ulang GPS"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingGps ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>

            {/* Simple Attendance Form Box */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <h2 className="font-bold text-slate-100 text-base flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  <span>Form Presensi</span>
                </h2>
              </div>

              <form onSubmit={handleSubmitAttendance} className="space-y-4">
                {/* 1. Full Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nama Lengkap *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Masukkan nama lengkap Anda"
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* 2. Live Webcam Selfie Snapshot */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Bukti Foto Selfie *
                  </label>
                  
                  <div className="relative aspect-video w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
                    {!capturedPhoto ? (
                      <>
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="w-full h-full object-cover transform -scale-x-100" 
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {cameraError && (
                          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center">
                            <AlertTriangle className="w-8 h-8 text-rose-500 mb-2" />
                            <p className="text-xs text-rose-300 font-medium">{cameraError}</p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={takeSnapshot}
                          disabled={!!cameraError}
                          className="absolute bottom-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-full text-xs shadow-lg shadow-emerald-500/30 flex items-center space-x-1.5 transition-transform active:scale-95"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Ambil Foto</span>
                        </button>
                      </>
                    ) : (
                      <div className="relative w-full h-full">
                        <img src={capturedPhoto} alt="Selfie Snapshot" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={retakePhoto}
                          className="absolute bottom-3 right-3 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 backdrop-blur-sm"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Foto Ulang</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={!isWithinRadius || !capturedPhoto}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Kirim Presensi Sekarang</span>
                </button>

                {!isWithinRadius && (
                  <p className="text-[11px] text-rose-400 text-center font-medium">
                    * Tombol kirim terkunci karena posisi Anda di luar radius.
                  </p>
                )}
                {!capturedPhoto && isWithinRadius && (
                  <p className="text-[11px] text-amber-400 text-center font-medium">
                    * Ambil foto selfie snapshot terlebih dahulu.
                  </p>
                )}
              </form>
            </div>

            {/* Receipt Modal / Status Confirmation */}
            {lastReceipt && (
              <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle className="w-4 h-4" />
                    <span>Presensi Berhasil Terkirim</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{lastReceipt.timestamp}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
                  <div>Nama: <strong>{lastReceipt.employeeName}</strong></div>
                  <div>Jarak GPS: <strong>{lastReceipt.distance}</strong></div>
                  <div className="col-span-2">Lokasi: <strong className="text-emerald-400">Terverifikasi Valid</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= ADMIN PANEL MODE ================= */}
        {isAdmin && (
          <div className="space-y-5">
            
            {/* Admin Navigation Tabs */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-1.5 rounded-2xl overflow-x-auto">
              <div className="flex space-x-2">
                <button
                  onClick={() => setAdminTab('riwayat')}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    adminTab === 'riwayat' 
                      ? 'bg-emerald-500 text-slate-950 shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Riwayat Presensi ({logs.length})</span>
                </button>

                <button
                  onClick={() => setAdminTab('lokasi')}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    adminTab === 'lokasi' 
                      ? 'bg-emerald-500 text-slate-950 shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Atur Lokasi Absen</span>
                </button>

                <button
                  onClick={() => setAdminTab('pin')}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    adminTab === 'pin' 
                      ? 'bg-emerald-500 text-slate-950 shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Ganti PIN Admin</span>
                </button>

                <button
                  onClick={() => setAdminTab('deploy')}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    adminTab === 'deploy' 
                      ? 'bg-emerald-500 text-slate-950 shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Panduan Deploy Vercel</span>
                </button>
              </div>
            </div>

            {/* ADMIN TAB 1: ATTENDANCE LOGS */}
            {adminTab === 'riwayat' && (
              <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-100 text-base">Rekap Presensi Pengguna</h2>
                    <p className="text-xs text-slate-400">Riwayat presensi yang telah diverifikasi lokasi &amp; selfie</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={exportToCSV}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Ekspor CSV</span>
                    </button>
                    {logs.length > 0 && (
                      <button
                        onClick={() => {
                          if (window.confirm('Bersihkan seluruh riwayat presensi?')) {
                            setLogs([]);
                            showToast('Riwayat berhasil dibersihkan.', 'success');
                          }
                        }}
                        className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900 text-rose-400 border border-rose-800/50 rounded-xl text-xs font-semibold flex items-center space-x-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Hapus All</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari Nama Pengguna..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Waktu</th>
                        <th className="py-3 px-4">Nama Lengkap</th>
                        <th className="py-3 px-4">Status GPS</th>
                        <th className="py-3 px-4">Foto Snapshot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500">
                            Belum ada riwayat presensi tersimpan.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-800/30">
                            <td className="py-3 px-4 text-slate-400 font-mono">{log.timestamp}</td>
                            <td className="py-3 px-4 font-semibold text-slate-200">{log.employeeName}</td>
                            <td className="py-3 px-4">
                              <span className={`text-[10px] font-bold ${log.isValidLocation ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {log.isValidLocation ? 'VALID' : 'INVALID'} ({log.distance})
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {log.photo ? (
                                <button
                                  onClick={() => setSelectedPhotoModal(log)}
                                  className="w-8 h-8 rounded overflow-hidden border border-slate-700 block hover:scale-105 transition-transform"
                                >
                                  <img src={log.photo} alt="Snapshot" className="w-full h-full object-cover" />
                                </button>
                              ) : (
                                <span className="text-slate-500 italic">No Photo</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ADMIN TAB 2: LOCATION SETTINGS */}
            {adminTab === 'lokasi' && (
              <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 max-w-lg mx-auto space-y-4">
                <div>
                  <h2 className="font-bold text-slate-100 text-base flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-emerald-400" />
                    <span>Atur Koordinat Lokasi Absen</span>
                  </h2>
                  <p className="text-xs text-slate-400">Pengaturan pusat koordinat dan radius toleransi (Khusus Admin)</p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    showToast('Lokasi target presensi berhasil diperbarui!', 'success');
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Nama Lokasi / Instansi
                    </label>
                    <input
                      type="text"
                      value={targetLocation.name}
                      onChange={(e) => setTargetLocation({ ...targetLocation, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={targetLocation.lat}
                        onChange={(e) => setTargetLocation({ ...targetLocation, lat: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={targetLocation.lng}
                        onChange={(e) => setTargetLocation({ ...targetLocation, lng: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Batas Radius Toleransi (Meter)
                    </label>
                    <input
                      type="number"
                      value={targetLocation.radius}
                      onChange={(e) => setTargetLocation({ ...targetLocation, radius: parseInt(e.target.value) || 50 })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (userCoords) {
                        setTargetLocation({
                          ...targetLocation,
                          lat: userCoords.lat,
                          lng: userCoords.lng
                        });
                        showToast('Koordinat diset ke GPS Anda saat ini.', 'success');
                      } else {
                        showToast('GPS belum terdeteksi.', 'error');
                      }
                    }}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center space-x-2"
                  >
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>Gunakan Koordinat GPS Saya Saat Ini</span>
                  </button>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl"
                  >
                    Simpan Perubahan
                  </button>
                </form>
              </div>
            )}

            {/* ADMIN TAB 3: CHANGE PIN */}
            {adminTab === 'pin' && (
              <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 max-w-sm mx-auto space-y-4">
                <div>
                  <h2 className="font-bold text-slate-100 text-base flex items-center space-x-2">
                    <KeyRound className="w-5 h-5 text-emerald-400" />
                    <span>Ganti PIN Akses Admin</span>
                  </h2>
                </div>

                <form onSubmit={handleChangePin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      PIN Baru
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Masukkan PIN baru"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Konfirmasi PIN Baru
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Ulangi PIN baru"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl"
                  >
                    Simpan PIN Baru
                  </button>
                </form>
              </div>
            )}

            {/* ADMIN TAB 4: DETAILED VERCEL DEPLOYMENT GUIDE */}
            {adminTab === 'deploy' && (
              <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 max-w-2xl mx-auto space-y-5 text-xs text-slate-300">
                <div className="border-b border-slate-800 pb-3">
                  <h2 className="font-bold text-slate-100 text-base flex items-center space-x-2">
                    <Globe className="w-5 h-5 text-emerald-400" />
                    <span>Panduan Lengkap Hosting di Vercel (vercel.app)</span>
                  </h2>
                  <p className="text-slate-400 mt-1">Langkah-langkah untuk menerbitkan web presensi ini agar bisa diakses publik secara gratis di Vercel.</p>
                </div>

                <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-1">
                  <p className="font-bold text-emerald-300">Mengapa Harus Vercel?</p>
                  <p className="leading-relaxed">
                    Sensor Kamera WebRTC &amp; GPS Geolocation **wajib berjalan di protocol HTTPS**. Vercel menyediakan domain `https://...vercel.app` bersertifikat SSL resmi gratis secara otomatis.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-slate-200 text-sm flex items-center space-x-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <span>Langkah 1: Siapkan Project React (Vite / Next)</span>
                  </h3>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                    <p className="text-slate-500"># 1. Buat projek Vite React baru</p>
                    <p>npm create vite@latest presensi-app -- --template react</p>
                    <p>cd presensi-app</p>
                    <p className="text-slate-500 mt-2"># 2. Install Lucide Icons &amp; Tailwind CSS</p>
                    <p>npm install lucide-react tailwindcss @tailwindcss/vite</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-slate-200 text-sm flex items-center space-x-2">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>Langkah 2: Upload Kode ke GitHub</span>
                  </h3>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed">
                    <li>Buat Repository baru di <a href="https://github.com/new" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-semibold">GitHub.com</a> (misal: <code>presensi-geolokasi</code>).</li>
                    <li>Upload atau `git push` seluruh berkas kode projek Anda ke repository GitHub tersebut.</li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-slate-200 text-sm flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span>Langkah 3: Deploy di Vercel</span>
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 pl-1 leading-relaxed">
                    <li>Buka platform <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-semibold">Vercel.com</a> lalu Login dengan akun GitHub Anda.</li>
                    <li>Klik tombol **"Add New..."** &gt; **"Project"**.</li>
                    <li>Pilih repository GitHub <code>presensi-geolokasi</code> yang telah di-upload.</li>
                    <li>Di halaman konfigurasi, pilih **Framework Preset: Vite** (atau Next.js jika menggunakan Next).</li>
                    <li>Klik **"Deploy"** dan tunggu proses pengerjaan (sekitar 1 menit).</li>
                    <li>Selesai! Web presensi Anda kini tayang secara live di domain misal: <code>https://presensi-app.vercel.app</code>.</li>
                  </ol>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => {
                setShowAdminLoginModal(false);
                setAdminPinError('');
                setAdminPinInput('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="mx-auto w-10 h-10 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400 mb-2">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-100 text-base">Autentikasi Admin</h3>
              <p className="text-xs text-slate-400">Masukkan PIN Admin untuk mengubah lokasi &amp; rekap</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="PIN Admin (Default: admin123)"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-center font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                {adminPinError && (
                  <p className="text-[11px] text-rose-400 mt-1 text-center font-medium">{adminPinError}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                Masuk Admin
              </button>
            </form>
          </div>
        </div>
      )}

      {}
      {selectedPhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-xs">{selectedPhotoModal.employeeName} - {selectedPhotoModal.timestamp}</h3>
              <button onClick={() => setSelectedPhotoModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                <img src={selectedPhotoModal.photo} alt="Proof" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-800/60 py-4 bg-slate-950 text-center text-[11px] text-slate-500">
        Aplikasi Presensi Geolokasi &amp; Foto Selfie &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}