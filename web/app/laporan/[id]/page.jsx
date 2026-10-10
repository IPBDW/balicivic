"use client";

// /laporan/[id] — tracking page untuk warga (URL-based ticket).
// Warga bisa bookmark URL ini dan balik lagi untuk lihat status.
// Auto-refresh tiap 10 detik untuk status real-time.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import NavbarApp from '@/components/NavbarApp';
import BottomNav from '@/components/BottomNav';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge, StatusBadge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { apiGet, imgUrl } from '@/lib/api';
import { statusLabel, severityLabel, classLabel } from '@/lib/design-system';

const PIPELINE = ['PENDING', 'IN_PROGRESS', 'DONE'];
const PIPELINE_LABEL = {
  PENDING: 'Dilaporkan',
  IN_PROGRESS: 'Dikerjakan',
  DONE: 'Selesai',
};

export default function TrackingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id;
  const ticketFromUrl = searchParams?.get('ticket') || null;

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchIssue = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiGet(`/api/issues/${id}`);
      setIssue(data);
      setError(null);
    } catch (e) {
      setError(e.message || 'Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchIssue();
    const interval = setInterval(fetchIssue, 10000);
    return () => clearInterval(interval);
  }, [fetchIssue]);

  if (loading) {
    return (
      <div className="min-h-screen ds-bg pb-24 md:pb-12">
        <NavbarApp active="/laporan" />
        <main className="max-w-2xl mx-auto px-4 py-10">
          <div className="animate-pulse space-y-4">
            <div className="h-8 ds-surface-muted rounded w-1/2" />
            <div className="h-32 ds-surface-muted rounded" />
            <div className="h-48 ds-surface-muted rounded" />
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="min-h-screen ds-bg pb-24 md:pb-12">
        <NavbarApp active="/laporan" />
        <main className="max-w-2xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex h-14 w-14 rounded-full bg-[var(--status-error-bg)] items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-xl font-bold ds-text mb-2">Laporan tidak ditemukan</h1>
          <p className="ds-text-muted text-sm mb-6">{error || 'Periksa kembali link laporan kamu.'}</p>
          <Link href="/lapor">
            <Button variant="primary">Buat laporan baru</Button>
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  const pipelineIndex = PIPELINE.indexOf(issue.status);
  const isError = issue.status === 'ERROR';
  const photo = imgUrl(issue.image_url);

  return (
    <div className="min-h-screen ds-bg pb-24 md:pb-12">
      <NavbarApp active="/laporan" />

      <main className="max-w-2xl mx-auto px-4 py-6 md:py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link href="/laporan" className="text-xs ds-text-muted hover:ds-text inline-flex items-center gap-1 mb-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Kembali
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold ds-text">Detail Laporan</h1>
            {ticketFromUrl && (
              <div className="mt-2 inline-flex items-center gap-2 ds-surface-muted px-3 py-1.5 rounded-[var(--radius-sm)]">
                <span className="text-xs ds-text-muted">ID Tiket:</span>
                <code className="ds-font-mono text-sm font-semibold ds-text">{ticketFromUrl}</code>
              </div>
            )}
          </div>
          <ThemeToggle />
        </div>

        {/* Status tracker (pipeline visual) */}
        {!isError && (
          <Card padding="md" className="mb-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Status</CardTitle>
                <StatusBadge status={issue.status} size="md" />
              </div>
            </CardHeader>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {PIPELINE.map((step, i) => {
                const reached = pipelineIndex >= i;
                const isCurrent = pipelineIndex === i;
                return (
                  <div key={step} className="text-center">
                    <div
                      className={[
                        'h-10 w-10 mx-auto rounded-full flex items-center justify-center transition-colors',
                        reached
                          ? 'bg-[var(--brand-primary)] text-white'
                          : 'ds-surface-muted ds-text-subtle',
                        isCurrent ? 'ring-4 ring-[var(--brand-primary-soft)] animate-pulse' : '',
                      ].join(' ')}
                    >
                      {reached ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className="text-sm font-semibold">{i + 1}</span>
                      )}
                    </div>
                    <p className={[
                      'mt-2 text-xs font-medium',
                      reached ? 'ds-text' : 'ds-text-subtle',
                    ].join(' ')}>
                      {PIPELINE_LABEL[step]}
                    </p>
                  </div>
                );
              })}
            </div>
            {issue.status === 'PENDING' && (
              <p className="text-xs ds-text-muted mt-4 text-center">
                Laporan kamu akan diverifikasi oleh admin sebelum diteruskan ke tim di lapangan.
              </p>
            )}
            {issue.status === 'IN_PROGRESS' && (
              <p className="text-xs ds-text-muted mt-4 text-center">
                Tim sudah diterjunkan. Pantau update berikutnya di halaman ini.
              </p>
            )}
            {issue.status === 'DONE' && (
              <p className="text-xs ds-text-muted mt-4 text-center text-[var(--status-done)]">
                Laporan sudah selesai ditangani. Terima kasih!
              </p>
            )}
          </Card>
        )}

        {isError && (
          <Card padding="md" className="mb-4 bg-[var(--status-error-bg)] border-[var(--status-error)]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[var(--status-error)] text-white flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold ds-text">Laporan ditolak</h3>
                <p className="text-xs ds-text-muted">Laporan ini tidak dapat diproses. Silakan buat laporan baru.</p>
              </div>
            </div>
          </Card>
        )}

        {/* Foto + info utama */}
        <Card padding="none" className="mb-4 overflow-hidden">
          {photo ? (
            <img src={photo} alt="Foto laporan" className="w-full aspect-[4/3] object-cover" />
          ) : (
            <div className="w-full aspect-[4/3] ds-surface-muted flex items-center justify-center">
              <span className="ds-text-subtle text-sm">Foto belum tersedia</span>
            </div>
          )}
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs ds-text-subtle uppercase tracking-wider mb-1">Kategori</p>
                <h2 className="text-lg font-semibold ds-text">
                  {classLabel[issue.issue_class] || issue.issue_class?.replace(/_/g, ' ') || 'Memproses...'}
                </h2>
              </div>
              {issue.severity_label && (
                <SeverityBadge severity={issue.severity_label} size="md" />
              )}
            </div>
            {issue.final_score != null && (
              <div className="flex items-center gap-2 text-xs ds-text-muted">
                <span>Skor AI:</span>
                <code className="ds-font-mono font-semibold ds-text">{issue.final_score}/100</code>
              </div>
            )}
          </div>
        </Card>

        {/* Timeline */}
        {issue.timeline && issue.timeline.length > 0 && (
          <Card padding="md" className="mb-4">
            <CardHeader>
              <CardTitle>Riwayat</CardTitle>
              <CardDescription>Jejak perubahan status laporan.</CardDescription>
            </CardHeader>
            <ol className="relative border-l-2 ds-border-color ml-3 space-y-4">
              {issue.timeline.map((event, i) => (
                <li key={i} className="ml-6">
                  <span className={[
                    'absolute -left-[9px] h-4 w-4 rounded-full border-2 ds-surface',
                    event.status === 'DONE' ? 'bg-[var(--status-done)] border-[var(--status-done)]'
                      : event.status === 'IN_PROGRESS' ? 'bg-[var(--status-in-progress)] border-[var(--status-in-progress)]'
                        : 'bg-[var(--status-pending)] border-[var(--status-pending)]',
                  ].join(' ')} />
                  <p className="text-sm font-medium ds-text">{event.message || statusLabel[event.status]}</p>
                  <p className="text-xs ds-text-muted">
                    {event.actor || 'Sistem'} · {event.timestamp?.slice(0, 16)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {/* Lokasi */}
        {issue.kecamatan && (
          <Card padding="md" className="mb-4">
            <CardHeader>
              <CardTitle>Lokasi</CardTitle>
            </CardHeader>
            <div className="flex items-start gap-2 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 ds-text-muted">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <div>
                <p className="ds-text">{issue.kecamatan}</p>
                {issue.kabupaten && <p className="ds-text-muted text-xs">{issue.kabupaten}</p>}
              </div>
            </div>
            {issue.latitude != null && issue.longitude != null && (
              <p className="mt-2 text-xs ds-text-subtle ds-font-mono">
                {issue.latitude.toFixed(5)}, {issue.longitude.toFixed(5)}
              </p>
            )}
          </Card>
        )}

        {/* CTA: Bagikan */}
        <Card padding="md" variant="muted" className="text-center">
          <p className="text-sm ds-text font-medium mb-2">Bagikan laporan</p>
          <p className="text-xs ds-text-muted mb-4">
            Simpan link ini untuk cek status laporan kamu sewaktu-waktu.
          </p>
          <Link href="/lapor">
            <Button variant="secondary">Buat laporan lain</Button>
          </Link>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}