import { isAdminAuthorized } from '@/lib/dummyData';
import { DUMMY_BLOCKED, blockedResponse } from '@/lib/dummyGuard';

// GET /api/admin/verify — cek token admin (mirror backend)

export async function GET(req) {
  if (DUMMY_BLOCKED) return blockedResponse();
  if (!isAdminAuthorized(req)) {
    return Response.json({ detail: 'Token admin tidak valid' }, { status: 401 });
  }
  return Response.json({ valid: true });
}