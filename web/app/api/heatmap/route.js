import { getAllIssues } from '@/lib/dummyStore';
import { heatmapFromIssues } from '@/lib/dummyData';
import { DUMMY_BLOCKED, blockedResponse } from '@/lib/dummyGuard';

// GET /api/heatmap — heatmap points untuk peta
// Mirror backend/main.py:get_heatmap_data (subset)

export async function GET() {
  if (DUMMY_BLOCKED) return blockedResponse();
  return Response.json(heatmapFromIssues(getAllIssues()));
}