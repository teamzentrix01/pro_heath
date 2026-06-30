import { getAuthenticatedUser } from '@/lib/auth';
import { getUserById } from '@/lib/users';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const authenticatedUser = await getAuthenticatedUser();

    if (!authenticatedUser) {
      return NextResponse.json({ user: null });
    }

    const user = await getUserById(authenticatedUser.id);

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Unable to hydrate authentication session:', error);
    return NextResponse.json({ user: null, serviceUnavailable: true });
  }
}
