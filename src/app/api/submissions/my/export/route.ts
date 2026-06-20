import { listSubmissionsByUserId } from '@/lib/submissions';
import { getAuthenticatedUser } from '@/lib/auth';
import { NextResponse } from 'next/server';

const escapeCSV = (value: string) => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const submissions = await listSubmissionsByUserId(user.id, user.role);

    const headers = [
      'Patient Name',
      "Father's Name",
      'Gender',
      'Age',
      'Contact Number',
      'Address',
      'Current Location',
      'Approval Status',
      'Treatment Status',
      'Doctor / PRO',
      'Referral Amount',
      'Payment Method',
      'Payment Status',
      'Submitted Date',
      'Files Count',
    ];

    const rows = submissions.map((s) => [
      escapeCSV(s.fullName),
      escapeCSV(s.fatherName),
      escapeCSV(s.gender),
      String(s.age),
      escapeCSV(s.contactNumber || 'Not provided'),
      escapeCSV(s.address),
      escapeCSV(s.currentLocation),
      escapeCSV(s.status),
      escapeCSV(s.treatmentStatus),
      escapeCSV(s.submittedByName),
      s.referralAmount?.toFixed(2) ?? '',
      escapeCSV(s.paymentMethod ?? ''),
      escapeCSV(s.paymentStatus),
      escapeCSV(new Date(s.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })),
      String(s.documents.length),
    ]);

    // UTF-8 BOM for Excel compatibility
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const now = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="My_Leads_${now}.csv"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to export your submissions' }, { status: 500 });
  }
}
