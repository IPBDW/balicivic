import { getAllIssues } from '@/lib/dummyStore';
import { topLocationsFromIssues } from '@/lib/dummyData';
import { DUMMY_BLOCKED, blockedResponse } from '@/lib/dummyGuard';

// GET /api/top-locations — top 3 kabupaten dengan laporan terbanyak

export async function GET() {
  if (DUMMY_BLOCKED) return blockedResponse();
  return Response.json(topLocationsFromIssues(getAllIssues(), 3));
}