'use client';

import { useEffect, useRef, useState } from 'react';

export default function CameraScanner({ open, onDetected, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const fileRef   = useRef(null);
  const trackRef  = useRef(null);

  const [mode,    setMode]    = useState('loading'); // loading | live | denied | error | processing
  const [torchOn, setTorchOn] = useState(false);
  const [msg,     setMsg]     = useState('');

  useEffect(() => {
    if (!open) return;
    setMode('loading');
    setMsg('Memulai kamera...');
    setTorchOn(false);
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        trackRef.current  = stream.getVideoTracks()[0];
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setMode('live');
        setMsg('Arahkan ke barcode...');

        if ('BarcodeDetector' in window) {
          const det = new window.BarcodeDetector({
            formats: ['code_128','qr_code','ean_13','ean_8','code_39','upc_a','upc_e'],
          });
          const tick = () => {
            if (cancelled) return;
            det.detect(videoRef.current).then((codes) => {
              if (codes?.length) { handleResult(codes[0].rawValue); return; }
              rafRef.current = requestAnimationFrame(tick);
            }).catch(() => { rafRef.current = requestAnimationFrame(tick); });
          };
          rafRef.current = requestAnimationFrame(tick);
        } else {
          const { default: jsQR } = await import('jsqr');
          const tick = () => {
            if (cancelled) return;
            const canvas = canvasRef.current;
            if (!canvas || !videoRef.current || videoRef.current.readyState < 2) {
              rafRef.current = requestAnimationFrame(tick); return;
            }
            const ctx = canvas.getContext('2d');
            canvas.width  = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.drawImage(videoRef.current, 0, 0);
            const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height);
            if (code) { handleResult(code.data); return; }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      } catch (err) {
        if (cancelled) return;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setMode('denied');
        } else if (err.name === 'NotFoundError') {
          setMode('error'); setMsg('Kamera tidak ditemukan.');
        } else {
          setMode('error'); setMsg(`Kamera error: ${err.message}`);
        }
      }
    }

    start();
    return () => { cancelled = true; stop(); };
  }, [open]); // eslint-disable-line

  function stop() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function handleResult(value) {
    if (!value) return;
    stop();
    onDetected(value.trim());
  }

  function handleClose() { stop(); onClose(); }

  async function toggleTorch() {
    try {
      const next = !torchOn;
      await trackRef.current?.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch { /* torch tidak didukung */ }
  }

  // Fallback: ambil foto via input file → decode dengan jsQR
  async function handleFotoCapture(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMode('processing');
    setMsg('Memproses foto...');
    try {
      const { default: jsQR } = await import('jsqr');
      const bmp = await createImageBitmap(file);
      const canvas = canvasRef.current;
      canvas.width  = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      const img  = ctx.getImageData(0, 0, bmp.width, bmp.height);
      const code = jsQR(img.data, img.width, img.height);
      if (code) {
        onDetected(code.data.trim());
      } else {
        setMsg('Barcode tidak terbaca. Coba foto lebih dekat dan pastikan cahaya cukup.');
        setMode('denied'); // kembali ke layar pilihan
      }
    } catch (err) {
      setMsg(`Gagal memproses foto: ${err.message}`);
      setMode('denied');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Input foto tersembunyi (fallback) */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={handleFotoCapture} />
      {/* Canvas tersembunyi untuk jsQR */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-semibold">Scan Barcode</p>
        <div className="flex items-center gap-3">
          {mode === 'live' && (
            <button onClick={toggleTorch} title="Senter"
              className={`rounded-full p-2 transition ${torchOn ? 'bg-yellow-400 text-black' : 'bg-white/20 text-white'}`}>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 2h6l1 7H8L9 2zm-1 7l2 13h4l2-13H8z"/>
              </svg>
            </button>
          )}
          <button onClick={handleClose}
            className="rounded-full bg-white/20 p-2 text-white hover:bg-white/40">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Konten */}
      <div className="relative flex-1 overflow-hidden">
        {/* Video live */}
        <video ref={videoRef} className={`h-full w-full object-cover ${mode === 'live' ? '' : 'hidden'}`}
          muted playsInline />

        {/* Garis bidik — hanya saat live */}
        {mode === 'live' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-52 w-72">
              <div className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-brand-400 rounded-tl-md" />
              <div className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-brand-400 rounded-tr-md" />
              <div className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-brand-400 rounded-bl-md" />
              <div className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-brand-400 rounded-br-md" />
              <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 bg-brand-400 opacity-70 animate-pulse" />
            </div>
          </div>
        )}

        {/* Layar denied / error / processing / loading */}
        {mode !== 'live' && (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
            {mode === 'loading' || mode === 'processing' ? (
              <>
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                <p className="text-sm text-slate-300">{msg}</p>
              </>
            ) : (
              <>
                {mode === 'denied' && (
                  <div className="rounded-2xl bg-white/10 px-4 py-4 text-left text-sm text-slate-200 space-y-1.5 w-full max-w-xs">
                    <p className="font-semibold text-rose-400 text-center mb-2">
                      {msg || 'Kamera tidak bisa diakses'}
                    </p>
                    <p className="text-xs font-medium text-white">Cara izinkan kamera:</p>
                    <p className="text-xs">1. Buka <strong>Pengaturan Android</strong></p>
                    <p className="text-xs">2. Aplikasi → <strong>Chrome</strong> → Izin</p>
                    <p className="text-xs">3. <strong>Kamera</strong> → Izinkan</p>
                    <p className="text-xs">4. Kembali ke aplikasi → coba lagi</p>
                  </div>
                )}
                {mode === 'error' && (
                  <p className="text-sm text-slate-300">{msg}</p>
                )}

                {/* Tombol alternatif: foto barcode */}
                <div className="space-y-3 w-full max-w-xs">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 active:scale-95 transition">
                    📷 Foto Barcode (tanpa izin kamera)
                  </button>
                  <p className="text-xs text-slate-500 text-center">
                    Akan membuka kamera bawaan HP. Foto barcode, lalu sistem decode otomatis.
                  </p>
                  <button onClick={handleClose}
                    className="w-full rounded-2xl bg-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/20 transition">
                    Tutup
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Status bar bawah — hanya saat live */}
      {mode === 'live' && (
        <div className="px-4 py-3 text-center">
          <p className="text-sm text-slate-300">{msg}</p>
          <p className="mt-0.5 text-xs text-slate-500">Scan otomatis — tidak perlu tekan tombol</p>
        </div>
      )}
    </div>
  );
}
