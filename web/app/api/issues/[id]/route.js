// GET /api/issues/[id] — detail satu issue. PK int.
import { getIssue } from '@/lib/dummyStore';

export async function GET(_req, ctx) {
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) {
    return Response.json({ detail: 'ID tidak valid' }, { status: 422 });
  }
  const issue = getIssue(numId);
  if (!issue) {
    return Response.json({ detail: 'Laporan tidak ditemukan' }, { status: 404 });
  }
  return Response.json(issue);
}

// DELETE /api/issues/[id] — admin hapus laporan (moderasi)
// Mirror: backend/main.py:delete_issue
import { deleteIssue } from '@/lib/dummyStore';
import { isAdminAuthorized } from '@/lib/dummyData';

export async function DELETE(req, ctx) {
  if (!isAdminAuthorized(req)) {
    return Response.json({ detail: 'Token admin tidak valid' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const numId = Number(id);
  const issue = getIssue(numId);
  if (!issue) {
    return Response.json({ detail: 'Laporan tidak ditemukan' }, { status: 404 });
  }
  deleteIssue(numId);
  return Response.json({
    message: 'Laporan dihapus',
    issue_id: numId,
    files_removed: [],
  });
}