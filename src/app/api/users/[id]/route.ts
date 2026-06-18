import { getUserById, updateUserProfile } from '@/lib/users';
import { getAuthenticatedUser } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser || (authenticatedUser.id !== id && authenticatedUser.role !== 'admin')) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const user = await getUserById(id);

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to load profile.' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser || (authenticatedUser.id !== id && authenticatedUser.role !== 'admin')) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const body = await request.json();
    const fullName = String(body.fullName ?? '').trim();
    const phoneNumber = String(body.phoneNumber ?? '').trim();
    const currentPassword = String(body.currentPassword ?? '');
    const newPassword = String(body.newPassword ?? '');

    if (!fullName || !/^\d{10}$/.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Full name and a valid 10-digit phone number are required.' },
        { status: 400 }
      );
    }

    if ((currentPassword || newPassword) && (!currentPassword || newPassword.length < 8)) {
      return NextResponse.json(
        { error: 'Enter your current password and a new password of at least 8 characters.' },
        { status: 400 }
      );
    }

    const user = await updateUserProfile(id, {
      fullName,
      phoneNumber,
      currentPassword: newPassword ? currentPassword : undefined,
      newPassword: newPassword || undefined,
    });
    if (!user) {
      return NextResponse.json(
        { error: newPassword ? 'Current password is incorrect.' : 'User not found.' },
        { status: newPassword ? 400 : 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to update profile.' }, { status: 500 });
  }
}
