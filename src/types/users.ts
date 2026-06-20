export type UserRole = 'admin' | 'pro' | 'doctor';

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  createdByUserId: string | null;
  isActive: boolean;
  loginCount: number;
  submissionCount: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
