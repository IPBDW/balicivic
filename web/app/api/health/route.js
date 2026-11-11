import { DUMMY_BLOCKED, blockedResponse } from '@/lib/dummyGuard';

// GET /health & GET / — liveness probe (mirror backend)
export async function GET() {
  if (DUMMY_BLOCKED) return blockedResponse();
  return Response.json({
    status: 'ok',
    db: 'ok',
    system: 'BaliCivic AI (dummy)',
  });
}