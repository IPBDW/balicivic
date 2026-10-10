// GET /api/distribution — pie/donut chart data
import { getAllIssues } from '@/lib/dummyStore';
import { distributionFromIssues } from '@/lib/dummyData';

export async function GET() {
  return Response.json(distributionFromIssues(getAllIssues()));
}