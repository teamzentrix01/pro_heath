import { listSubmissions } from '@/lib/submissions';
import { requireAdmin } from '@/lib/auth';
import { NextResponse } from 'next/server';

const escapeCSV = (value: string) => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 });
    }

    const submissions = await listSubmissions({});

    const headers = [
      'Patient Name',
      'Gender',
      'Age',
      'Contact Number',
      'Reference / Source',
      'Status',
      'Submitted Date',
      'PRO Name',
      'PRO Email',
      'Files Count',
    ];

    const rows = submissions.map((s) => [
      escapeCSV(s.fullName),
      escapeCSV(s.gender),
      String(s.age),
      escapeCSV(s.contactNumber || 'Not provided'),
      escapeCSV(s.reference),
      escapeCSV(s.status),
      escapeCSV(new Date(s.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })),
      escapeCSV(s.submittedByName || 'Unknown'),
      escapeCSV(s.submittedByEmail),
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
        'Content-Disposition': `attachment; filename="PRO_HealthTrack_All_Leads_${now}.csv"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to export submissions' }, { status: 500 });
  }
}
