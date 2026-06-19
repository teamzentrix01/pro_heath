import { getAuthenticatedUser } from '@/lib/auth';
import { getUserById } from '@/lib/users';
import { NextResponse } from 'next/server';

export async function GET() {
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await getUserById(authenticatedUser.id);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
