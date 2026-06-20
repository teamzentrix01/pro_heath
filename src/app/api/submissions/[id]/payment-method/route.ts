import { getAuthenticatedUser } from '@/lib/auth';
import { selectSubmissionPaymentMethod } from '@/lib/submissions';
import { PaymentMethod } from '@/types/submissions';
import { NextRequest, NextResponse } from 'next/server';

const methods: PaymentMethod[] = ['UPI', 'Cash', 'Bank Transfer'];

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== 'doctor') return NextResponse.json({ error: 'Doctor access is required.' }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json();
  const method = body.method as PaymentMethod;
  const details = body.details && typeof body.details === 'object' ? body.details as Record<string, string> : {};
  if (!methods.includes(method)) return NextResponse.json({ error: 'Select a valid payment method.' }, { status: 400 });
  if (method === 'UPI' && !String(details.upiId ?? '').trim()) return NextResponse.json({ error: 'UPI ID is required.' }, { status: 400 });
  if (method === 'Bank Transfer' && (!String(details.accountNumber ?? '').trim() || !String(details.ifsc ?? '').trim())) return NextResponse.json({ error: 'Account number and IFSC are required.' }, { status: 400 });
  const submission = await selectSubmissionPaymentMethod({ id, doctorId: user.id, method, details });
  return submission ? NextResponse.json({ submission }) : NextResponse.json({ error: 'Referral payment is not available for this lead.' }, { status: 409 });
}
