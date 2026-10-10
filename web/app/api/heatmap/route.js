// GET /api/heatmap — heatmap points untuk peta
// Mirror backend/main.py:get_heatmap_data (subset)
import { getAllIssues } from '@/lib/dummyStore';
import { heatmapFromIssues } from '@/lib/dummyData';

export async function GET() {
  return Response.json(heatmapFromIssues(getAllIssues()));
}