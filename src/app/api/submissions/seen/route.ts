import { requireAdmin } from '@/lib/auth';
import { markAllSubmissionsSeen } from '@/lib/submissions';
import { NextResponse } from 'next/server';

export async function PATCH() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 });

  await markAllSubmissionsSeen();
  return NextResponse.json({ success: true });
}
