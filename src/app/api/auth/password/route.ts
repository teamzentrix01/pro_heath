import { getAuthenticatedUser } from '@/lib/auth';
import { changeUserPassword } from '@/lib/users';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await request.json();
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');
  if (!currentPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'Enter the current password and a new password of at least 8 characters.' }, { status: 400 });
  }

  const changed = await changeUserPassword(user.id, currentPassword, newPassword);
  return changed
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
}
