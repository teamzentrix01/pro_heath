'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { AdminDashboard } from '@/components/AdminDashboard';
import { UserForm } from '@/components/UserForm';

export default function Dashboard() {
  const { user, isAuthReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthReady && !user) {
      router.replace('/');
    }
  }, [isAuthReady, user, router]);

  if (!isAuthReady || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return user.isAdmin ? <AdminDashboard /> : <UserForm />;
}