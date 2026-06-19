import { updateSubmissionStatus } from '@/lib/submissions';
import { sendStatusUpdateEmail } from '@/lib/email';
import { requireAdmin } from '@/lib/auth';
import { SubmissionStatus } from '@/types/submissions';
import { NextRequest, NextResponse } from 'next/server';

const allowedStatuses: SubmissionStatus[] = ['Pending', 'Approved', 'Rejected'];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const status = body.status as SubmissionStatus;

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const result = await updateSubmissionStatus(id, status);

    if (!result) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Fire-and-forget email notification
    if (result.proEmail && result.submission) {
      void sendStatusUpdateEmail(
        result.proEmail,
        result.proName,
        result.submission.fullName,
        status,
        id
      );
    }

    return NextResponse.json({ submission: result.submission });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to update submission status' }, { status: 500 });
  }
}
