// GET /health & GET / — liveness probe (mirror backend)
export async function GET() {
  return Response.json({
    status: 'ok',
    db: 'ok',
    system: 'BaliCivic AI (dummy)',
  });
}