// FILE: components/ui/CameraScanner.jsx
// Modal scan barcode via kamera HP. Pakai BarcodeDetector API (Chrome Android)
// dengan fallback ke jsQR untuk browser yang belum mendukung.

'use client';

import { useEffect, useRef, useState } from 'react';

export default function CameraScanner({ open, onDetected, onClose }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const rafRef     = useRef(null);
  const detRef     = useRef(null);
  const [status, setStatus] = useState('Memulai kamera...');
  const [torchOn, setTorchOn] = useState(false);
  const trackRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setStatus('Memulai kamera...');
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

        // Coba BarcodeDetector (Chrome Android 83+)
        if ('BarcodeDetector' in window) {
          detRef.current = new window.BarcodeDetector({ formats: ['code_128','qr_code','ean_13','ean_8','code_39','upc_a','upc_e'] });
          setStatus('Arahkan kamera ke barcode...');
          scanWithDetector();
        } else {
          // Fallback: jsQR
          const { default: jsQR } = await import('jsqr');
          detRef.current = { jsqr: jsQR };
          setStatus('Arahkan kamera ke barcode...');
          scanWithJsQR();
        }
      } catch (err) {
        if (!cancelled) setStatus(`Kamera tidak bisa dibuka: ${err.message}`);
      }
    }

    function scanWithDetector() {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(scanWithDetector); return;
      }
      detRef.current.detect(videoRef.current).then((codes) => {
        if (codes?.length) { handleResult(codes[0].rawValue); return; }
        rafRef.current = requestAnimationFrame(scanWithDetector);
      }).catch(() => { rafRef.current = requestAnimationFrame(scanWithDetector); });
    }

    function scanWithJsQR() {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(scanWithJsQR); return;
      }
      const canvas = canvasRef.current;
      const ctx    = canvas.getContext('2d');
      canvas.width  = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = detRef.current.jsqr(img.data, img.width, img.height);
      if (code) { handleResult(code.data); return; }
      rafRef.current = requestAnimationFrame(scanWithJsQR);
    }

    function handleResult(value) {
      if (!value) return;
      stopCamera();
      onDetected(value.trim());
    }

    start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open]); // eslint-disable-line

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function toggleTorch() {
    try {
      const newState = !torchOn;
      await trackRef.current?.applyConstraints({ advanced: [{ torch: newState }] });
      setTorchOn(newState);
    } catch { /* torch tidak didukung */ }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-label="Scan barcode">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-semibold">Scan Barcode</p>
        <div className="flex items-center gap-3">
          <button onClick={toggleTorch} title="Senter"
            className={`rounded-full p-2 transition ${torchOn ? 'bg-yellow-400 text-black' : 'bg-white/20 text-white'}`}>
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 2h6l1 7H8L9 2zm-1 7l2 13h4l2-13H8z"/>
            </svg>
          </button>
          <button onClick={() => { stopCamera(); onClose(); }}
            className="rounded-full bg-white/20 p-2 text-white hover:bg-white/40">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Video */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {/* Garis bidik */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-52 w-72">
            {/* Sudut atas-kiri */}
            <div className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-brand-400 rounded-tl-md" />
            {/* Sudut atas-kanan */}
            <div className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-brand-400 rounded-tr-md" />
            {/* Sudut bawah-kiri */}
            <div className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-brand-400 rounded-bl-md" />
            {/* Sudut bawah-kanan */}
            <div className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-brand-400 rounded-br-md" />
            {/* Garis scan animasi */}
            <div className="absolute inset-x-0 top-0 h-0.5 animate-bounce bg-brand-400 opacity-80" />
          </div>
        </div>
        {/* Canvas tersembunyi untuk jsQR */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Status */}
      <div className="px-4 py-4 text-center text-sm text-slate-300">
        {status}
        <p className="mt-1 text-xs text-slate-500">
          Scan otomatis — tidak perlu tekan tombol apapun
        </p>
      </div>
    </div>
  );
}
