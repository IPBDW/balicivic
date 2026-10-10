"use client";

// /laporan — list publik semua laporan warga.
// Linear-style: dense table desktop, card list mobile.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import NavbarApp from '@/components/NavbarApp';
import BottomNav from '@/components/BottomNav';
import { Card } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { apiGet } from '@/lib/api';
import { classLabel } from '@/lib/design-system';

export default function LaporanListPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL'); // ALL | PENDING | IN_PROGRESS | DONE

  const fetchData = useCallback(async () => {
    try {
      const data = await apiGet(`/api/issues?limit=100`);
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filtered = filter === 'ALL' ? items : items.filter(i => i.status === filter);
  const counts = {
    ALL: items.length,
    PENDING: items.filter(i => i.status === 'PENDING').length,
    IN_PROGRESS: items.filter(i => i.status === 'IN_PROGRESS').length,
    DONE: items.filter(i => i.status === 'DONE').length,
  };

  return (
    <div className="min-h-screen ds-bg pb-24 md:pb-12">
      <NavbarApp active="/laporan" />

      <main className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold ds-text">Semua Laporan</h1>
            <p className="ds-text-muted text-sm mt-1">
              Arsip publik laporan warga. Update otomatis tiap 30 detik.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Filter tabs */}
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-2">
          {['ALL', 'PENDING', 'IN_PROGRESS', 'DONE'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                'shrink-0 h-9 px-4 rounded-full text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'ds-surface ds-border-color border ds-text-muted hover:ds-text',
              ].join(' ')}
            >
              {f === 'ALL' ? 'Semua' : f === 'IN_PROGRESS' ? 'Dikerjakan' : f === 'PENDING' ? 'Menunggu' : 'Selesai'}
              <span className="ml-1.5 opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="ds-surface ds-border-color border rounded-[var(--radius-md)] h-20 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <Card padding="lg" className="text-center">
            <p className="ds-text-muted mb-4">{error}</p>
            <Button onClick={fetchData} variant="secondary">Coba lagi</Button>
          </Card>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <Card padding="lg" className="text-center">
            <div className="inline-flex h-14 w-14 rounded-full ds-surface-muted items-center justify-center mb-4 ds-text-muted">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="font-semibold ds-text mb-1">Belum ada laporan</h3>
            <p className="ds-text-muted text-sm mb-4">Jadilah yang pertama melaporkan kerusakan di sekitarmu.</p>
            <Link href="/lapor">
              <Button variant="primary">Buat laporan pertama</Button>
            </Link>
          </Card>
        )}

        {/* List (cards di mobile, table di desktop) */}
        {!loading && !error && filtered.length > 0 && (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((item) => (
                <Link
                  key={item.id}
                  href={`/laporan/${item.id}`}
                  className="block ds-surface ds-border-color border rounded-[var(--radius-md)] p-4 hover:ds-shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-xs ds-text-muted">{classLabel[item.issue_class] || item.issue_class}</p>
                      <p className="text-sm ds-text font-medium mt-0.5 line-clamp-2">{item.title}</p>
                    </div>
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                  <div className="flex items-center gap-3 text-xs ds-text-subtle">
                    {item.kecamatan && <span>📍 {item.kecamatan}</span>}
                    {item.final_score != null && <span>Skor {item.final_score}</span>}
                    <span className="ml-auto ds-font-mono">
                      {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block ds-surface ds-border-color border rounded-[var(--radius-md)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="ds-surface-muted text-xs uppercase tracking-wider ds-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                    <th className="px-4 py-3 text-left font-semibold">Lokasi</th>
                    <th className="px-4 py-3 text-left font-semibold">Skor</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t ds-border-color hover:ds-surface-muted cursor-pointer transition-colors"
                      onClick={() => window.location.href = `/laporan/${item.id}`}
                    >
                      <td className="px-4 py-3 ds-text">{classLabel[item.issue_class] || item.issue_class}</td>
                      <td className="px-4 py-3 ds-text-muted">{item.kecamatan || '—'}</td>
                      <td className="px-4 py-3 ds-font-mono ds-text">{item.final_score ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} size="sm" /></td>
                      <td className="px-4 py-3 ds-text-subtle ds-font-mono text-xs">
                        {new Date(item.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}