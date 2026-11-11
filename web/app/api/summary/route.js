import { getAllIssues } from '@/lib/dummyStore';
import { summaryFromIssues } from '@/lib/dummyData';
import { DUMMY_BLOCKED, blockedResponse } from '@/lib/dummyGuard';

// GET /api/summary — dashboard ringkasan (dengan field 'error')

export async function GET() {
  if (DUMMY_BLOCKED) return blockedResponse();
  return Response.json(summaryFromIssues(getAllIssues()));
}