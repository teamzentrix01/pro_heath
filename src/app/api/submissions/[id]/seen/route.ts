import { requireAdmin } from '@/lib/auth';
import { markSubmissionSeen } from '@/lib/submissions';
import { NextResponse } from 'next/server';

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 });

  const { id } = await context.params;
  const found = await markSubmissionSeen(id);
  return found
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
}
