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
    <div className="app-surface flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/75 shadow-[0_30px_80px_rgba(30,64,175,.16)] backdrop-blur-xl lg:grid-cols-[1.1fr_.9fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#173b76] via-blue-600 to-teal-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="relative z-10">
            <div className="mb-12 flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-2xl font-black ring-1 ring-white/25">+</span>
              <div><strong className="block text-lg">PRO HealthTrack</strong><span className="text-sm text-blue-100">Care operations platform</span></div>
            </div>
            <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">Healthcare leads, beautifully organized.</h2>
            <p className="mt-5 max-w-md leading-7 text-blue-100">A secure workspace for patient referrals, document management and real-time lead tracking.</p>
          </div>
          <div className="relative z-10 grid grid-cols-3 gap-3">
            {['Secure access', 'Live tracking', 'Simple workflow'].map((item) => <div key={item} className="rounded-xl border border-white/15 bg-white/10 p-3 text-center text-xs font-semibold backdrop-blur">{item}</div>)}
          </div>
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/15" />
          <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        </section>
        <div className="w-full p-7 sm:p-10 lg:p-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 text-2xl font-black text-white shadow-lg shadow-blue-200 lg:hidden">+</div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[.18em] text-blue-600">Welcome back</p>
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-950">Sign in to your account</h1>
          <p className="text-sm text-slate-500">Use your admin or PRO credentials to continue</p>
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
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 py-3 font-bold text-white shadow-lg shadow-blue-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:bg-gray-400"
          >
            {isSubmitting ? 'Please wait...' : 'Login'}
          </button>
        </form>

        </div>
      </div>
    </div>
  );
};
