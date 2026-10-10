// GET /api/summary — dashboard ringkasan (dengan field 'error')
import { getAllIssues } from '@/lib/dummyStore';
import { summaryFromIssues } from '@/lib/dummyData';

export async function GET() {
  return Response.json(summaryFromIssues(getAllIssues()));
}