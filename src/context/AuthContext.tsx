'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppUser } from '@/types/users';
import { apiFetch } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: AppUser['role'];
  isAdmin: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthReady: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  updateUser: (user: AppUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_KEY = 'health_track _user';

const toAuthUser = (user: AppUser): AuthUser => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phoneNumber: user.phoneNumber,
  role: user.role,
  isAdmin: user.role === 'admin',
});

const getSavedUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;

  try {
    const savedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return savedUser ? (JSON.parse(savedUser) as AuthUser) : null;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUser(getSavedUser());
      setIsAuthReady(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const saveUser = (nextUser: AppUser) => {
    const authenticatedUser = toAuthUser(nextUser);
    setUser(authenticatedUser);
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedUser));
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      saveUser(data.user);
      return true;
    } catch {
      return false;
    }
  };

  const updateUser = (nextUser: AppUser) => {
    saveUser(nextUser);
  };

  const logout = () => {
    void apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthReady, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
