import { getAllIssues } from '@/lib/dummyStore';
import { distributionFromIssues } from '@/lib/dummyData';
import { DUMMY_BLOCKED, blockedResponse } from '@/lib/dummyGuard';

// GET /api/distribution — pie/donut chart data

export async function GET() {
  if (DUMMY_BLOCKED) return blockedResponse();
  return Response.json(distributionFromIssues(getAllIssues()));
}