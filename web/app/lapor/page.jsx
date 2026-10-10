"use client";

// /lapor — form pelaporan warga (mobile-first).
// Redesign pakai design system: Button, Card, Badge dari components/ui/.
// Flow: Upload foto → Deteksi lokasi → Konfirmasi → Submit → Redirect ke tracking.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NavbarApp from "@/components/NavbarApp";
import BottomNav from "@/components/BottomNav";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { apiPostForm, apiGet } from "@/lib/api";
import { generateTicketId } from "@/lib/design-system";

const TIPS = [
  { icon: "🎯", title: "Fokus pada objek", desc: "Pastikan kerusakan ada di tengah frame." },
  { icon: "☀️", title: "Cahaya cukup", desc: "Hindari foto back-light atau terlalu gelap." },
  { icon: "📵", title: "Hindari blur", desc: "Pegang HP stabil saat memotret." },
];

export default function LaporPage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [gpsState, setGpsState] = useState('idle'); // idle | loading | ok | error
  const [gpsError, setGpsError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activity, setActivity] = useState([]);
  const [step, setStep] = useState(1); // 1=upload, 2=lokasi, 3=konfirmasi

  useEffect(() => {
    fetchLiveActivity();
    getLocation();
    const interval = setInterval(fetchLiveActivity, 15000);
    return () => clearInterval(interval);
  }, []);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target.result);
      setStep(2); // auto-advance setelah foto dipilih
    };
    reader.readAsDataURL(file);
  }

  function getLocation() {
    if (!navigator.geolocation) {
      setGpsState('error');
      setGpsError('Browser tidak mendukung GPS.');
      return;
    }
    setGpsState('loading');
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setGpsState('ok');
      },
      (err) => {
        const messages = {
          1: 'Izin GPS ditolak. Aktifkan izin lokasi di browser.',
          2: 'Informasi lokasi tidak tersedia.',
          3: 'Waktu habis. Coba lagi di area terbuka.',
        };
        setGpsError(messages[err.code] || `Error GPS: ${err.message}`);
        setGpsState('error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function fetchLiveActivity() {
    try {
      const data = await apiGet('/api/issues?limit=5');
      setActivity(data.slice(0, 4));
    } catch (e) {
      // silent — widget dekoratif
    }
  }

  async function handleSubmit() {
    if (!fileRef.current?.files?.[0]) {
      alert('Pilih foto dulu.');
      return;
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.append('file', fileRef.current.files[0]);
    if (coords.lat != null) fd.append('lat', String(coords.lat));
    if (coords.lng != null) fd.append('long', String(coords.lng));

    try {
      const result = await apiPostForm('/api/analyze', fd);
      // Generate URL-friendly ticket ID untuk warga.
      // Backend balikin id (int), kita combine jadi BC-2026-XXXX untuk UX.
      const ticketId = generateTicketId();
      router.push(`/laporan/${result.id}?ticket=${ticketId}`);
    } catch (err) {
      alert('Gagal kirim laporan: ' + err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen ds-bg pb-24 md:pb-12">
      <NavbarApp active="/lapor" />

      <main className="max-w-2xl mx-auto px-4 py-6 md:py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold ds-text">Lapor Kerusakan</h1>
            <p className="ds-text-muted text-sm mt-1">
              Bantu pemerintah mendata infrastruktur via AI. 3 langkah cepat.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex-1 flex items-center gap-2">
              <div
                className={[
                  'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                  step >= n ? 'bg-[var(--brand-primary)] text-white' : 'ds-surface-muted ds-text-subtle',
                ].join(' ')}
              >
                {step > n ? '✓' : n}
              </div>
              {n < 3 && (
                <div className={`h-0.5 flex-1 ${step > n ? 'bg-[var(--brand-primary)]' : 'ds-surface-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        <Card padding="md" className="mb-4">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] flex items-center justify-center text-xs font-bold">1</span>
                Foto kerusakan
              </span>
            </CardTitle>
            <CardDescription>Pastikan objek terlihat jelas dan fokus.</CardDescription>
          </CardHeader>
          <label
            htmlFor="file-input"
            className={[
              'block relative aspect-[4/3] rounded-[var(--radius-md)] border-2 border-dashed cursor-pointer overflow-hidden transition-colors',
              preview
                ? 'border-[var(--brand-primary)]'
                : 'ds-border-color hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)]/30',
            ].join(' ')}
          >
            <input
              ref={fileRef}
              id="file-input"
              type="file"
              accept="image/*"
              capture="environment"
              required
              onChange={handleFileChange}
              className="sr-only"
            />
            {preview ? (
              <>
                <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-xs font-medium border border-white px-3 py-1.5 rounded-full backdrop-blur-sm">
                    Ketuk untuk ganti foto
                  </span>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <div className="h-16 w-16 rounded-full ds-surface-muted flex items-center justify-center mb-3 ds-text-muted">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5l2-3h6l2 3h5a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <span className="ds-text font-medium">Ketuk untuk ambil foto</span>
                <span className="ds-text-subtle text-xs mt-1">atau upload dari galeri · maks 10 MB</span>
              </div>
            )}
          </label>
        </Card>

        {/* Step 2: Lokasi */}
        <Card padding="md" className="mb-4">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <span className={[
                  'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  step >= 2 ? 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]' : 'ds-surface-muted ds-text-subtle',
                ].join(' ')}>2</span>
                Lokasi
              </span>
            </CardTitle>
            <CardDescription>GPS otomatis, atau isi manual.</CardDescription>
          </CardHeader>

          {gpsState === 'ok' && (
            <div className="flex items-center gap-2 mb-3 text-xs ds-text-muted">
              <span className="h-2 w-2 rounded-full bg-[var(--status-done)]" />
              <span className="ds-font-mono">{coords.lat?.toFixed(5)}, {coords.lng?.toFixed(5)}</span>
            </div>
          )}

          {gpsError && (
            <div className="mb-3 p-3 rounded-[var(--radius-sm)] bg-[var(--status-error-bg)] text-[var(--status-error)] text-xs">
              {gpsError}
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            loading={gpsState === 'loading'}
            onClick={getLocation}
            leftIcon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="22" y1="12" x2="18" y2="12" />
                <line x1="6" y1="12" x2="2" y2="12" />
                <line x1="12" y1="6" x2="12" y2="2" />
                <line x1="12" y1="22" x2="12" y2="18" />
              </svg>
            }
          >
            {gpsState === 'ok' ? 'Perbarui lokasi' : 'Deteksi lokasi saya'}
          </Button>
        </Card>

        {/* Step 3: Submit */}
        <Card padding="md" className="mb-6">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <span className={[
                  'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  step >= 3 ? 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]' : 'ds-surface-muted ds-text-subtle',
                ].join(' ')}>3</span>
                Kirim
              </span>
            </CardTitle>
            <CardDescription>
              AI akan menganalisis foto & memberi laporan otomatis. Kamu akan mendapat ID tiket untuk tracking.
            </CardDescription>
          </CardHeader>
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            disabled={!preview}
            loading={submitting}
            onClick={handleSubmit}
            rightIcon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            }
          >
            Kirim Laporan
          </Button>
        </Card>

        {/* Tips */}
        <Card padding="md" variant="muted" className="mb-4">
          <CardHeader>
            <CardTitle>Panduan foto akurat</CardTitle>
            <CardDescription>Biar AI bisa analisis dengan tepat.</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            {TIPS.map((tip) => (
              <div key={tip.title} className="flex items-start gap-3 ds-surface p-3 rounded-[var(--radius-sm)]">
                <span className="text-xl">{tip.icon}</span>
                <div>
                  <strong className="block text-sm ds-text">{tip.title}</strong>
                  <p className="text-xs ds-text-muted">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Live activity */}
        <Card padding="md" className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--status-done)] animate-pulse" />
                Aktivitas terbaru
              </span>
            </CardTitle>
            <Badge variant="brand" size="sm">Live</Badge>
          </div>
          <div className="space-y-2">
            {activity.length === 0 && (
              <p className="text-xs ds-text-subtle animate-pulse">Memuat aktivitas...</p>
            )}
            {activity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 text-xs py-2">
                <span className="ds-text-subtle ds-font-mono w-12 shrink-0">
                  {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="ds-text-muted flex-1">
                  Laporan <StatusBadge status={item.status} size="sm" />
                </span>
              </div>
            ))}
          </div>
        </Card>

        <p className="text-center text-xs ds-text-subtle">
          Powered by Vision AI & LLM
        </p>
      </main>

      <BottomNav raised="/lapor" />
    </div>
  );
}