import { getAllIssues } from '@/lib/dummyStore';
import { DUMMY_BLOCKED, blockedResponse } from '@/lib/dummyGuard';

// GET /api/issues/count — total count untuk pagination UI

export async function GET() {
  if (DUMMY_BLOCKED) return blockedResponse();
  return Response.json({ total: getAllIssues().length });
}