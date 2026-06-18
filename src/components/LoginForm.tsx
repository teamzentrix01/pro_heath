'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const clearBrowserFilledValues = () => {
      if (emailInputRef.current) {
        emailInputRef.current.value = '';
      }
      if (passwordInputRef.current) {
        passwordInputRef.current.value = '';
      }
    };

    clearBrowserFilledValues();
    const timer = window.setTimeout(clearBrowserFilledValues, 300);

    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    const success = await login(email.trim(), password);
    setIsSubmitting(false);
    setPassword('');

    if (success) {
      router.replace('/dashboard');
    } else {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">Health track </h1>
          <p className="text-gray-600 text-sm">Healthcare Management System</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          <input className="hidden" type="text" name="username" autoComplete="username" tabIndex={-1} />
          <input className="hidden" type="password" name="password" autoComplete="current-password" tabIndex={-1} />
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Admin ID / Email
            </label>
            <input
              ref={emailInputRef}
              type="text"
              id="email"
              name="health_track _email"
              value={email}
              readOnly={!canEdit}
              onFocus={() => setCanEdit(true)}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              data-lpignore="true"
              data-1p-ignore="true"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Enter admin ID or email"
            />
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              ref={passwordInputRef}
              type="password"
              id="password"
              name="health_track _access_key"
              value={password}
              readOnly={!canEdit}
              onFocus={() => setCanEdit(true)}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="one-time-code"
              data-lpignore="true"
              data-1p-ignore="true"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Enter your password"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition duration-200 disabled:bg-gray-400"
          >
            {isSubmitting ? 'Please wait...' : 'Login'}
          </button>
        </form>

      </div>
    </div>
  );
};
