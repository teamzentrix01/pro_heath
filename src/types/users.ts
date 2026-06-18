export type UserRole = 'admin' | 'user';

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  loginCount: number;
  submissionCount: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
