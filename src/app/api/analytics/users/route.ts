import { getUserSubmissionAnalytics } from '@/lib/submissions';
import { requireAdmin } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') === 'monthly' ? 'monthly' : 'weekly';
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const groupBy = searchParams.get('groupBy') === 'doctor' ? 'doctor' : 'pro';
    
    const minAmountParam = searchParams.get('minAmount');
    const maxAmountParam = searchParams.get('maxAmount');
    const minAmount = minAmountParam !== null && minAmountParam !== '' ? Number(minAmountParam) : null;
    const maxAmount = maxAmountParam !== null && maxAmountParam !== '' ? Number(maxAmountParam) : null;
    
    const patientName = searchParams.get('patientName') || null;

    const rows = await getUserSubmissionAnalytics({
      period,
      date,
      groupBy,
      minAmount,
      maxAmount,
      patientName,
    });

    return NextResponse.json({ rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to load user analytics' }, { status: 500 });
  }
}
