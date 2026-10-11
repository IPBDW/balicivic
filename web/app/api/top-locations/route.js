// GET /api/top-locations — top 3 kabupaten dengan laporan terbanyak
import { getAllIssues } from '@/lib/dummyStore';
import { topLocationsFromIssues } from '@/lib/dummyData';

export async function GET() {
  return Response.json(topLocationsFromIssues(getAllIssues(), 3));
}