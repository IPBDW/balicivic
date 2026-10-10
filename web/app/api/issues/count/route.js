// GET /api/issues/count — total count untuk pagination UI
import { getAllIssues } from '@/lib/dummyStore';

export async function GET() {
  return Response.json({ total: getAllIssues().length });
}