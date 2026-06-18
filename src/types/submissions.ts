export type SubmissionStatus = 'Pending' | 'Approved' | 'Rejected';

export interface UploadedDocument {
  id?: string;
  name: string;
  type?: string;
  size?: number;
  isImage?: boolean;
  dataUrl?: string;
}

export interface UserSubmission {
  id: string;
  userId: string | null;
  submittedByEmail: string;
  submittedByName: string;
  fullName: string;
  gender: string;
  age: number;
  contactNumber: string | null;
  reference: string;
  status: SubmissionStatus;
  documents: UploadedDocument[];
  submittedAt: string;
}

export interface ReferenceAnalyticsRow {
  source: string;
  count: number;
}

export interface UserAnalyticsRow {
  userId: string | null;
  email: string;
  fullName: string;
  count: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}
