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
  const [showPassword, setShowPassword] = useState(false);
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
          <h1 className="text-4xl font-bold text-blue-600 mb-2">PRO HealthTrack</h1>
          <p className="text-gray-600 text-sm">Healthcare Lead Management System</p>
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
              Email / ID
            </label>
            <input
              ref={emailInputRef}
              type="text"
              id="email"
              name="health_track_email"
              value={email}
              readOnly={!canEdit}
              onFocus={() => setCanEdit(true)}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              data-lpignore="true"
              data-1p-ignore="true"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Enter email or ID"
            />
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="health_track_access_key"
                value={password}
                readOnly={!canEdit}
                onFocus={() => setCanEdit(true)}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="one-time-code"
                data-lpignore="true"
                data-1p-ignore="true"
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-blue-600 focus:outline-none"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
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
