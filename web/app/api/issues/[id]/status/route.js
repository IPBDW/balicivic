// PUT /api/issues/[id]/status — admin update status (PENDING → IN_PROGRESS → DONE)
// Mirror: backend/main.py:update_status
import { getIssue, updateIssue, appendTimeline } from '@/lib/dummyStore';
import { isAdminAuthorized } from '@/lib/dummyData';

const ALLOWED = ['PENDING', 'IN_PROGRESS', 'DONE', 'ERROR'];

export async function PUT(req, ctx) {
  if (!isAdminAuthorized(req)) {
    return Response.json({ detail: 'Token admin tidak valid' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) {
    return Response.json({ detail: 'ID tidak valid' }, { status: 422 });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  if (!ALLOWED.includes(status)) {
    return Response.json({ detail: `Status '${status}' tidak dikenal` }, { status: 422 });
  }
  const issue = getIssue(numId);
  if (!issue) {
    return Response.json({ detail: 'Laporan tidak ditemukan' }, { status: 404 });
  }

  const messages = {
    IN_PROGRESS: 'Laporan Diverifikasi & Tim Dikerahkan',
    DONE: 'Perbaikan Selesai & Laporan Ditutup',
    ERROR: 'Laporan Ditolak / Invalid',
    PENDING: 'Status diperbarui',
  };
  const event = {
    status,
    actor: 'Admin Dinas',
    message: messages[status] || 'Status diperbarui',
  };

  updateIssue(numId, { status });
  appendTimeline(numId, event);

  return Response.json({
    message: 'Status berhasil diupdate',
    current_status: status,
    history: {
      ...event,
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
    },
  });
}