// GET /api/issues — list dengan pagination & filter
// Mirror: backend/main.py:read_issues
import { getAllIssues } from '@/lib/dummyStore';

export async function GET(request) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
  const status = url.searchParams.get('status');
  const issueClass = url.searchParams.get('issue_class');

  let issues = getAllIssues();
  if (status) issues = issues.filter(i => i.status === status);
  if (issueClass) issues = issues.filter(i => i.issue_class === issueClass);
  issues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return Response.json(issues.slice(offset, offset + limit));
}