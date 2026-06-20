export type SubmissionStatus = 'Pending' | 'Approved' | 'Rejected';
export type TreatmentStatus = 'Not Started' | 'Admitted' | 'Medicine Taken & Patient Left' | 'Discharged';
export type PaymentMethod = 'UPI' | 'Cash' | 'Bank Transfer';
export type PaymentStatus = 'Not Applicable' | 'Awaiting Method' | 'Payment Pending' | 'Processing' | 'Paid' | 'Payment Failed' | 'On Hold';

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
  submittedByRole: 'pro' | 'doctor' | 'admin';
  parentProId: string | null;
  parentProName: string;
  fullName: string;
  fatherName: string;
  gender: string;
  age: number;
  contactNumber: string | null;
  address: string;
  currentLocation: string;
  status: SubmissionStatus;
  treatmentStatus: TreatmentStatus;
  referralAmount: number | null;
  paymentMethod: PaymentMethod | null;
  paymentDetails: Record<string, string>;
  paymentStatus: PaymentStatus;
  transactionReference: string | null;
  paidAt: string | null;
  rejectionReason: string | null;
  adminSeenAt: string | null;
  statusUpdatedAt: string | null;
  statusHistory: SubmissionStatusEvent[];
  documents: UploadedDocument[];
  submittedAt: string;
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
