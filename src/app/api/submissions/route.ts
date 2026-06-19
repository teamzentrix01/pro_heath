import { createSubmission, listSubmissions } from '@/lib/submissions';
import { getAuthenticatedUser, requireAdmin } from '@/lib/auth';
import { UploadedDocument } from '@/types/submissions';
import { NextRequest, NextResponse } from 'next/server';

type SubmissionDocumentInput = {
  name?: string;
  type?: string;
  size?: number;
  isImage?: boolean;
  dataUrl?: string;
};

const MAX_DOCUMENTS = 5;
const MAX_DOCUMENT_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_DOCUMENT_SIZE_BYTES = 6 * 1024 * 1024;
const allowedGenders = ['Male', 'Female', 'Other'];

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access is required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const submissions = await listSubmissions({
      search: searchParams.get('search') ?? undefined,
      date: searchParams.get('date') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    });

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to load submissions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUser = await getAuthenticatedUser();
    if (!authenticatedUser || authenticatedUser.role !== 'pro') {
      return NextResponse.json({ error: 'A PRO login is required.' }, { status: 401 });
    }

    const body = await request.json();
    const age = Number(body.age);
    const documentInputs: SubmissionDocumentInput[] = Array.isArray(body.documents)
      ? body.documents
      : [];

    if (
      !body.fullName?.trim() ||
      !allowedGenders.includes(body.gender) ||
      !Number.isInteger(age) ||
      age < 1 ||
      age > 150 ||
      (
        body.contactNumber?.trim() &&
        !/^\d{10}$/.test(body.contactNumber.trim())
      ) ||
      !body.reference?.trim()
    ) {
      return NextResponse.json({ error: 'Missing or invalid form fields' }, { status: 400 });
    }

    const documents: UploadedDocument[] = documentInputs
      .filter((document) => typeof document.name === 'string' && document.name.trim())
      .map((document) => ({
        name: document.name!.trim(),
        type: typeof document.type === 'string' ? document.type : undefined,
        size: Number(document.size ?? 0),
        isImage: Boolean(document.isImage),
        dataUrl: typeof document.dataUrl === 'string' ? document.dataUrl : undefined,
      }));

    const totalDocumentSize = documents.reduce(
      (total: number, document) => total + Number(document.size ?? 0),
      0
    );

    if (
      documents.length > MAX_DOCUMENTS ||
      documents.some((document) => Number(document?.size ?? 0) > MAX_DOCUMENT_SIZE_BYTES) ||
      totalDocumentSize > MAX_TOTAL_DOCUMENT_SIZE_BYTES
    ) {
      return NextResponse.json(
        { error: 'Upload up to 5 documents, 2 MB each, with a 6 MB total limit.' },
        { status: 413 }
      );
    }

    const submission = await createSubmission({
      userId: authenticatedUser.id,
      fullName: body.fullName.trim(),
      gender: body.gender,
      age,
      contactNumber: body.contactNumber?.trim() || null,
      reference: body.reference.trim(),
      documents,
    });

    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to save submission' }, { status: 500 });
  }
}
