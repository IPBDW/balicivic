// GET /api/admin/verify — cek token admin (mirror backend)
import { isAdminAuthorized } from '@/lib/dummyData';

export async function GET(req) {
  if (!isAdminAuthorized(req)) {
    return Response.json({ detail: 'Token admin tidak valid' }, { status: 401 });
  }
  return Response.json({ valid: true });
}