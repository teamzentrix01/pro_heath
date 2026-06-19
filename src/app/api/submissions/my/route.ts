import { listSubmissionsByUserId } from '@/lib/submissions';
import { getAuthenticatedUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const submissions = await listSubmissionsByUserId(user.id);

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to load your submissions' }, { status: 500 });
  }
}
