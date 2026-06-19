export type SubmissionStatus = 'Pending' | 'Approved' | 'Rejected';

export interface SubmissionStatusEvent {
  id: string;
  fromStatus: SubmissionStatus;
  toStatus: SubmissionStatus;
  reason: string | null;
  createdAt: string;
}

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
  rejectionReason: string | null;
  adminSeenAt: string | null;
  statusUpdatedAt: string | null;
  statusHistory: SubmissionStatusEvent[];
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
