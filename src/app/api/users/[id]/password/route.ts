import { getAuthenticatedUser } from '@/lib/auth';
import { getUserById, resetUserPassword } from '@/lib/users';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const manager = await getAuthenticatedUser();
  if (!manager || !['admin', 'pro'].includes(manager.role)) {
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  }

  const { id } = await context.params;
  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  const canReset = manager.role === 'admin'
    ? target.role !== 'admin'
    : target.role === 'doctor' && target.createdByUserId === manager.id;
  if (!canReset) return NextResponse.json({ error: 'You cannot reset this account password.' }, { status: 403 });

  const newPassword = String((await request.json()).newPassword ?? '');
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must contain at least 8 characters.' }, { status: 400 });
  }

  await resetUserPassword(id, newPassword);
  return NextResponse.json({ success: true });
}
