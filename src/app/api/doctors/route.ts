import { getAuthenticatedUser } from '@/lib/auth';
import { createUser, listDoctors } from '@/lib/users';
import { NextRequest, NextResponse } from 'next/server';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user || !['admin', 'pro'].includes(user.role)) {
    return NextResponse.json({ error: 'PRO or admin access is required.' }, { status: 403 });
  }
  const doctors = await listDoctors(user.role === 'pro' ? user.id : undefined);
  return NextResponse.json({ doctors });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user || user.role !== 'pro') {
      return NextResponse.json({ error: 'Only a PRO can create doctor accounts.' }, { status: 403 });
    }
    const body = await request.json();
    const input = {
      email: String(body.email ?? '').trim().toLowerCase(),
      password: String(body.password ?? ''),
      fullName: String(body.fullName ?? '').trim(),
      phoneNumber: String(body.phoneNumber ?? '').trim(),
    };
    if (!emailPattern.test(input.email) || input.password.length < 8 || !input.fullName || !/^\d{10}$/.test(input.phoneNumber)) {
      return NextResponse.json({ error: 'Enter valid doctor details and an 8-character password.' }, { status: 400 });
    }
    const doctor = await createUser({ ...input, role: 'doctor', createdByUserId: user.id });
    return NextResponse.json({ doctor }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'This doctor email already exists.' }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Unable to create doctor.' }, { status: 500 });
  }
}
