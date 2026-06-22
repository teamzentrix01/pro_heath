import { getAuthenticatedUser } from '@/lib/auth';
import { canManageSubmission, updateSubmissionCare } from '@/lib/submissions';
import { PaymentStatus, TreatmentStatus } from '@/types/submissions';
import { NextRequest, NextResponse } from 'next/server';

const treatments: TreatmentStatus[] = ['Admitted', 'Medicine Taken & Patient Left', 'Discharged'];
const paymentStatuses: PaymentStatus[] = ['Payment Pending', 'Processing', 'Paid', 'Payment Failed', 'On Hold'];

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user || !['admin', 'pro'].includes(user.role)) return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
  const { id } = await context.params;
  if (!(await canManageSubmission(id, user.id, user.role))) return NextResponse.json({ error: 'This patient is not assigned to you.' }, { status: 403 });

  const body = await request.json();
  const treatmentStatus = body.treatmentStatus as TreatmentStatus;
  const referralAmount = body.referralAmount === '' || body.referralAmount == null ? null : Number(body.referralAmount);
  const paymentStatus = body.paymentStatus ? body.paymentStatus as PaymentStatus : undefined;
  const transactionReference = String(body.transactionReference ?? '').trim();
  if (!treatments.includes(treatmentStatus) || (referralAmount !== null && (!Number.isFinite(referralAmount) || referralAmount < 0)) || (paymentStatus && !paymentStatuses.includes(paymentStatus))) {
    return NextResponse.json({ error: 'Invalid treatment or payment information.' }, { status: 400 });
  }
  if (paymentStatus === 'Paid' && transactionReference.length < 3) {
    return NextResponse.json({ error: 'Enter the payment transaction or receipt reference.' }, { status: 400 });
  }
  const submission = await updateSubmissionCare({
    id,
    changedBy: user.id,
    treatmentStatus,
    referralAmount,
    paymentStatus,
    transactionReference: transactionReference || null,
    note: String(body.note ?? '').trim() || null,
  });
  return submission ? NextResponse.json({ submission }) : NextResponse.json({ error: 'Accept the lead before updating patient care.' }, { status: 409 });
}
