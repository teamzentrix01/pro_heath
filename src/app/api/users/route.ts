import { requireAdmin } from '@/lib/auth';
import { createUser, listUsers } from '@/lib/users';
import { NextRequest, NextResponse } from 'next/server';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 });
    }

    const users = await listUsers();
    return NextResponse.json({
      users,
      summary: {
        registeredUsers: users.length,
        usersWhoLoggedIn: users.filter((user) => user.loginCount > 0).length,
        totalLogins: users.reduce((total, user) => total + user.loginCount, 0),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to load registered users.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 });
    }

    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const fullName = String(body.fullName ?? '').trim();
    const phoneNumber = String(body.phoneNumber ?? '').trim();

    if (
      !emailPattern.test(email) ||
      password.length < 8 ||
      !fullName ||
      !/^\d{10}$/.test(phoneNumber)
    ) {
      return NextResponse.json(
        { error: 'Enter a valid email, name, 10-digit phone number, and password of at least 8 characters.' },
        { status: 400 }
      );
    }

    const user = await createUser({ email, password, fullName, phoneNumber });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const databaseError = error as { code?: string };
    if (databaseError.code === '23505') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    console.error(error);
    return NextResponse.json({ error: 'Unable to create user.' }, { status: 500 });
  }
}
