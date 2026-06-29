'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  SubmissionStatus,
  UserAnalyticsRow,
  UserSubmission,
} from '@/types/submissions';
import { AppUser } from '@/types/users';
import { apiFetch, apiUrl } from '@/lib/api';
import { CareManagement } from './CareManagement';
import { PasswordDialog } from './PasswordDialog';

const POLL_INTERVAL_MS = 15_000;
type AdminSection = 'dashboard' | 'accounts' | 'analytics' | 'submissions';

const sectionTitles: Record<AdminSection, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Operational summary and referral totals' },
  accounts: { title: 'PRO Accounts', subtitle: 'Create and manage care network accounts' },
  analytics: { title: 'Analytics', subtitle: 'Review lead performance by PRO' },
  submissions: { title: 'Submitted Leads', subtitle: 'Review patients, treatment, and payments' },
};

const statusStyles: Record<SubmissionStatus, string> = {
  Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Approved: 'bg-green-100 text-green-800 border-green-200',
  Rejected: 'bg-red-100 text-red-800 border-red-200',
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
};

const getPeriodRange = (period: 'weekly' | 'monthly', dateValue: string) => {
  const selected = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  const start = new Date(selected);

  if (period === 'weekly') {
    const day = start.getDay();
    const daysFromMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - daysFromMonday);
  } else {
    start.setDate(1);
  }

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  if (period === 'weekly') {
    end.setDate(end.getDate() + 7);
  } else {
    end.setMonth(end.getMonth() + 1);
  }

  return { start, end };
};

const downloadFile = (dataUrl: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const AdminDashboard = () => {
  const { logout, user } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [submissionPeriodFilter, setSubmissionPeriodFilter] = useState<'All' | 'weekly' | 'monthly'>('All');
  const [submissionPeriodDate, setSubmissionPeriodDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState<'All' | SubmissionStatus>('All');
  const [reviewLead, setReviewLead] = useState<UserSubmission | null>(null);
  const activeLead = reviewLead ? submissions.find(s => s.id === reviewLead.id) || reviewLead : null;
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [analyticsDate, setAnalyticsDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [analyticsGroupBy, setAnalyticsGroupBy] = useState<'pro' | 'doctor'>('pro');
  const [analyticsMinAmount, setAnalyticsMinAmount] = useState('');
  const [analyticsMaxAmount, setAnalyticsMaxAmount] = useState('');
  const [analyticsPatientName, setAnalyticsPatientName] = useState('');
  const [userAnalyticsRows, setUserAnalyticsRows] = useState<UserAnalyticsRow[]>([]);
  const [expandedAnalyticsRows, setExpandedAnalyticsRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedAnalyticsRows({});
  }, [analyticsDate, analyticsPeriod, analyticsGroupBy, analyticsMinAmount, analyticsMaxAmount, analyticsPatientName]);
  const [registeredUsers, setRegisteredUsers] = useState<AppUser[]>([]);
  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
  });
  const [userCreationMessage, setUserCreationMessage] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userFormResetKey, setUserFormResetKey] = useState(0);
  const [passwordDialog, setPasswordDialog] = useState<{ mode: 'change' | 'reset'; target?: AppUser } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [statusAction, setStatusAction] = useState<{
    submission: UserSubmission;
    status: SubmissionStatus;
  } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [newLeadNotice, setNewLeadNotice] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownSubmissionIdsRef = useRef<Set<string>>(new Set());

  const loadSubmissions = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setDashboardError('');
    }

    try {
      const response = await apiFetch('/api/submissions');

      if (!response.ok) {
        throw new Error('Unable to load submissions');
      }

      const data = await response.json();
      const incomingSubmissions = data.submissions as UserSubmission[];
      if (silent && knownSubmissionIdsRef.current.size > 0) {
        const newCount = incomingSubmissions.filter((item) => !knownSubmissionIdsRef.current.has(item.id)).length;
        if (newCount > 0) setNewLeadNotice(newCount);
      }
      knownSubmissionIdsRef.current = new Set(incomingSubmissions.map((item) => item.id));
      setSubmissions(data.submissions);
    } catch {
      if (!silent) {
        setDashboardError('Unable to load leads from the database.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSubmissions();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSubmissions]);

  // Real-time polling every 15 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => {
      void loadSubmissions(true);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadSubmissions]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await apiFetch('/api/users');
      if (!response.ok) {
        throw new Error('Unable to load users');
      }

      const data = await response.json();
      setRegisteredUsers(data.users);
    } catch {
      setDashboardError('Unable to load team accounts from the database.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  useEffect(() => {
    const loadUserAnalytics = async () => {
      try {
        const params = new URLSearchParams({
          period: analyticsPeriod,
          date: analyticsDate,
          groupBy: analyticsGroupBy,
        });
        if (analyticsMinAmount) params.append('minAmount', analyticsMinAmount);
        if (analyticsMaxAmount) params.append('maxAmount', analyticsMaxAmount);
        if (analyticsPatientName) params.append('patientName', analyticsPatientName);

        const response = await apiFetch(`/api/analytics/users?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Unable to load PRO analytics');
        }

        const data = await response.json();
        setUserAnalyticsRows(data.rows);
      } catch {
        setUserAnalyticsRows([]);
      }
    };

    void loadUserAnalytics();
  }, [analyticsDate, analyticsPeriod, analyticsGroupBy, analyticsMinAmount, analyticsMaxAmount, analyticsPatientName]);

  const updateStatus = async (submissionId: string, status: SubmissionStatus, reason = '') => {
    setDashboardError('');
    setIsUpdatingStatus(true);

    try {
      const response = await apiFetch(`/api/submissions/${submissionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Unable to update status');
      }

      const data = await response.json();
      setSubmissions((currentSubmissions) =>
        currentSubmissions.map((submission) =>
          submission.id === submissionId ? data.submission : submission
        )
      );
      setStatusAction(null);
      setStatusReason('');
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Unable to update this lead status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const markSeen = async (submissionId: string) => {
    setSubmissions((current) => current.map((item) =>
      item.id === submissionId ? { ...item, adminSeenAt: item.adminSeenAt ?? new Date().toISOString() } : item
    ));
    await apiFetch(`/api/submissions/${submissionId}/seen`, { method: 'PATCH' });
  };

  const markAllSeen = async () => {
    const seenAt = new Date().toISOString();
    setSubmissions((current) => current.map((item) => ({ ...item, adminSeenAt: item.adminSeenAt ?? seenAt })));
    await apiFetch('/api/submissions/seen', { method: 'PATCH' });
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const link = document.createElement('a');
      link.href = apiUrl('/api/submissions/export');
      link.click();
    } finally {
      setTimeout(() => setIsExporting(false), 2000);
    }
  };

  const filteredSubmissions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return submissions.filter((submission) => {
      const submittedDate = new Date(submission.submittedAt).toISOString().slice(0, 10);
      const documentText = submission.documents
        .map((document) => (typeof document === 'string' ? document : document.name))
        .join(' ');
      const searchableText = [
        submission.id,
        submission.submittedByEmail,
        submission.submittedByName,
        submission.fullName,
        submission.gender,
        submission.age,
        submission.contactNumber ?? '',
        submission.fatherName,
        submission.disease || '',
        submission.address,
        submission.currentLocation,
        submission.status,
        submittedDate,
        documentText,
      ]
        .join(' ')
        .toLowerCase();

      const isInSelectedPeriod =
        submissionPeriodFilter === 'All' ||
        (() => {
          const { start, end } = getPeriodRange(submissionPeriodFilter, submissionPeriodDate);
          const submittedAt = new Date(submission.submittedAt);
          return submittedAt >= start && submittedAt < end;
        })();

      return (
        (!normalizedSearch || searchableText.includes(normalizedSearch)) &&
        (!dateFilter || submittedDate === dateFilter) &&
        isInSelectedPeriod &&
        (statusFilter === 'All' || submission.status === statusFilter)
      );
    });
  }, [dateFilter, searchTerm, statusFilter, submissionPeriodDate, submissionPeriodFilter, submissions]);

  const statusCounts = submissions.reduce<Record<SubmissionStatus, number>>(
    (counts, submission) => {
      counts[submission.status ?? 'Pending'] += 1;
      return counts;
    },
    { Pending: 0, Approved: 0, Rejected: 0 }
  );

  const totalDocuments = submissions.reduce((sum, submission) => sum + submission.documents.length, 0);
  const totalReferralAmount = submissions.reduce((sum, submission) => sum + (submission.referralAmount ?? 0), 0);
  const paidReferralAmount = submissions.filter((submission) => submission.paymentStatus === 'Paid').reduce((sum, submission) => sum + (submission.referralAmount ?? 0), 0);
  const unreadCount = submissions.filter((submission) => !submission.adminSeenAt).length;

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setUserCreationMessage('');

    if (
      !newUser.fullName.trim() ||
      !newUser.email.trim() ||
      !/^\d{10}$/.test(newUser.phoneNumber) ||
      newUser.password.length < 8
    ) {
      setUserCreationMessage(
        'Enter a name, valid email, 10-digit phone number, and password of at least 8 characters.'
      );
      return;
    }

    setIsCreatingUser(true);

    try {
      const response = await apiFetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to create PRO');
      }

      setNewUser({ fullName: '', email: '', phoneNumber: '', password: '' });
      setUserFormResetKey((key) => key + 1);
      setUserCreationMessage('PRO credentials created successfully.');
      await loadUsers();
    } catch (error) {
      setUserCreationMessage(
        error instanceof Error ? error.message : 'Unable to create PRO.'
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="app-surface admin-dashboard">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="brand-mark">
          <div className="brand-icon">+</div>
          <div>
            <strong>PRO HealthTrack</strong>
            <small>Care operations</small>
          </div>
        </div>
        <nav className="side-nav">
          <button
            type="button"
            className={activeSection === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveSection('dashboard')}
          >
            <span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </span>
            <b>Dashboard</b>
          </button>
          <button
            type="button"
            className={activeSection === 'accounts' ? 'active' : ''}
            onClick={() => setActiveSection('accounts')}
          >
            <span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </span>
            <b>PRO Accounts</b>
          </button>
          <button
            type="button"
            className={activeSection === 'analytics' ? 'active' : ''}
            onClick={() => setActiveSection('analytics')}
          >
            <span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
            <b>Analytics</b>
          </button>
          <button
            type="button"
            className={activeSection === 'submissions' ? 'active' : ''}
            onClick={() => setActiveSection('submissions')}
          >
            <span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </span>
            <b>Submitted Leads</b>
          </button>
        </nav>
        <div className="sidebar-footer">
          <strong className="block text-white">System status</strong>
          All services are operational and lead data refreshes automatically.
        </div>
      </aside>

      <header className="admin-header">
        <div className="mx-auto flex max-w-[1600px] flex-row items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{sectionTitles[activeSection].title}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-gray-600 mt-1">{sectionTitles[activeSection].subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('submissions')}
              className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-lg text-slate-700 shadow-sm transition hover:bg-blue-50"
              aria-label={`${unreadCount} new leads`}
              title={unreadCount > 0 ? `${unreadCount} new lead notifications` : 'No new lead notifications'}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </svg>
              {unreadCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unreadCount}</span>}
            </button>
            <button type="button" onClick={() => setPasswordDialog({ mode: 'change' })} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Change password</button>
            <button
              onClick={handleLogout}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100"
            >Logout</button>
          </div>
        </div>
      </header>

      <main className="admin-content space-y-8">
        {dashboardError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {dashboardError}
          </div>
        )}

        <section id="dashboard" className={`${activeSection === 'dashboard' ? '' : 'hidden'} metric-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5`}>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-600 text-sm font-medium">Total Leads</p>
            <p className="text-4xl font-bold text-blue-600 mt-2">{submissions.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-600 text-sm font-medium">Pending</p>
            <p className="text-4xl font-bold text-yellow-600 mt-2">{statusCounts.Pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-600 text-sm font-medium">Approved</p>
            <p className="text-4xl font-bold text-green-600 mt-2">{statusCounts.Approved}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-600 text-sm font-medium">Rejected</p>
            <p className="text-4xl font-bold text-red-600 mt-2">{statusCounts.Rejected}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-600 text-sm font-medium">Files Uploaded</p>
            <p className="text-4xl font-bold text-purple-600 mt-2">{totalDocuments}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5"><p className="text-gray-600 text-sm font-medium">Referral Liability</p><p className="mt-2 text-3xl font-bold text-indigo-600">₹{totalReferralAmount.toLocaleString('en-IN')}</p></div>
          <div className="bg-white rounded-lg shadow p-5"><p className="text-gray-600 text-sm font-medium">Referral Paid</p><p className="mt-2 text-3xl font-bold text-emerald-600">₹{paidReferralAmount.toLocaleString('en-IN')}</p></div>
        </section>

        <section id="pros" className={`${activeSection === 'accounts' ? '' : 'hidden'} max-w-3xl`}>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-white px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">Create PRO Credentials</h2>
              <p className="mt-1 text-sm text-gray-600">
                Only accounts created here can log in to PRO HealthTrack.
              </p>
            </div>

            <form key={userFormResetKey} onSubmit={handleCreateUser} autoComplete="off" className="grid grid-cols-1 gap-5 p-6 xl:grid-cols-2">
              {userCreationMessage && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 xl:col-span-2">
                  {userCreationMessage}
                </div>
              )}

              <div>
                <label htmlFor="newUserName" className="mb-2 block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  id="newUserName"
                  name={`pro-name-${userFormResetKey}`}
                  autoComplete="off"
                  type="text"
                  value={newUser.fullName}
                  onChange={(event) =>
                    setNewUser((current) => ({ ...current, fullName: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Enter PRO's full name"
                />
              </div>

              <div>
                <label htmlFor="newUserEmail" className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="newUserEmail"
                  name={`pro-email-${userFormResetKey}`}
                  autoComplete="off"
                  type="email"
                  value={newUser.email}
                  onChange={(event) =>
                    setNewUser((current) => ({ ...current, email: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="pro@example.com"
                />
              </div>

              <div>
                <label htmlFor="newUserPhone" className="mb-2 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  id="newUserPhone"
                  name={`pro-phone-${userFormResetKey}`}
                  autoComplete="off"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={newUser.phoneNumber}
                  onChange={(event) =>
                    setNewUser((current) => ({
                      ...current,
                      phoneNumber: event.target.value.replace(/\D/g, '').slice(0, 10),
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Enter 10-digit phone number"
                />
              </div>

              <div>
                <label htmlFor="newUserPassword" className="mb-2 block text-sm font-medium text-gray-700">
                  Temporary Password
                </label>
                <input
                  id="newUserPassword"
                  name={`pro-password-${userFormResetKey}`}
                  autoComplete="new-password"
                  type="password"
                  value={newUser.password}
                  onChange={(event) =>
                    setNewUser((current) => ({ ...current, password: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="flex justify-end border-t border-gray-100 pt-5 xl:col-span-2">
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:bg-gray-400 sm:w-auto"
                >
                  {isCreatingUser ? 'Creating...' : 'Create PRO'}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className={`${activeSection === 'accounts' ? '' : 'hidden'} bg-white rounded-lg shadow overflow-hidden`}>
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">PRO & Doctor Accounts</h2>
            <p className="text-sm text-gray-600 mt-1">Account directory with assigned roles.</p>
          </div>

          {registeredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No team accounts found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-leads-table w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Security</th>
                  </tr>
                </thead>
                <tbody>
                  {registeredUsers.map((registeredUser) => (
                    <tr key={registeredUser.id} className="border-b border-gray-100">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {registeredUser.fullName || 'Not provided'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{registeredUser.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {registeredUser.phoneNumber || 'Not provided'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 capitalize">{registeredUser.role === 'pro' ? 'PRO' : registeredUser.role}</td>
                      <td className="px-6 py-4">{registeredUser.role === 'admin' ? <span className="text-xs text-slate-400">Current password required</span> : <button type="button" onClick={() => setPasswordDialog({ mode: 'reset', target: registeredUser })} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100">Reset password</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={`${activeSection === 'submissions' ? '' : 'hidden'} bg-white rounded-lg shadow p-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Filters</h2>
              <p className="text-sm text-gray-600 mt-1">
                Search by date, patient, doctor, PRO, location, status, or document name.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
            {unreadCount > 0 && <button type="button" onClick={() => void markAllSeen()} className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Mark {unreadCount} new as read</button>}
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setDateFilter('');
                setSubmissionPeriodFilter('All');
                setSubmissionPeriodDate(new Date().toISOString().slice(0, 10));
                setStatusFilter('All');
              }}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={() => void loadSubmissions()}
              className="border border-blue-300 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 transition"
            >
              Refresh
            </button>
          </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-5">
            <div>
              <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                id="searchTerm"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Patient, doctor, location, document..."
              />
            </div>
            <div>
              <label htmlFor="dateFilter" className="block text-sm font-medium text-gray-700 mb-2">
                Submission Date
              </label>
              <input
                id="dateFilter"
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>
            <div>
              <label htmlFor="submissionPeriodFilter" className="block text-sm font-medium text-gray-700 mb-2">
                Period
              </label>
              <select
                id="submissionPeriodFilter"
                value={submissionPeriodFilter}
                onChange={(event) =>
                  setSubmissionPeriodFilter(event.target.value as 'All' | 'weekly' | 'monthly')
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              >
                <option value="All">All Time</option>
                <option value="weekly">Selected Week</option>
                <option value="monthly">Selected Month</option>
              </select>
            </div>
            <div>
              <label htmlFor="submissionPeriodDate" className="block text-sm font-medium text-gray-700 mb-2">
                Period Date
              </label>
              <input
                id="submissionPeriodDate"
                type="date"
                value={submissionPeriodDate}
                disabled={submissionPeriodFilter === 'All'}
                onChange={(event) => setSubmissionPeriodDate(event.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
            <div>
              <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-2">
                Review Status
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'All' | SubmissionStatus)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              >
                <option value="All">All</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
        </section>

        <section id="analytics" className={`${activeSection === 'analytics' ? '' : 'hidden'} bg-white rounded-2xl shadow-xl p-6 border border-slate-100`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
                </svg>
                Lead Performance Analytics
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {analyticsGroupBy === 'pro'
                  ? 'Patients submitted directly or through doctors linked to each PRO.'
                  : 'Patients submitted grouped by the submitting doctor.'}
              </p>
            </div>
            
            <div className="flex items-center bg-slate-100 p-1.5 rounded-xl self-start lg:self-auto border border-slate-200/50">
              <button
                type="button"
                onClick={() => setAnalyticsGroupBy('pro')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                  analyticsGroupBy === 'pro'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PRO-wise Leads
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsGroupBy('doctor')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                  analyticsGroupBy === 'doctor'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Doctor-wise Leads
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/60 shadow-sm">
            <div>
              <label htmlFor="analyticsPeriod" className="mb-1.5 block text-xs font-bold text-slate-700">Period</label>
              <select
                id="analyticsPeriod"
                value={analyticsPeriod}
                onChange={(event) => setAnalyticsPeriod(event.target.value as 'weekly' | 'monthly')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition shadow-sm font-medium"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label htmlFor="analyticsDate" className="mb-1.5 block text-xs font-bold text-slate-700">Selected date</label>
              <input
                id="analyticsDate"
                type="date"
                value={analyticsDate}
                onChange={(event) => setAnalyticsDate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition shadow-sm font-medium"
              />
            </div>
            <div>
              <label htmlFor="analyticsPatientName" className="mb-1.5 block text-xs font-bold text-slate-700">Patient Name</label>
              <input
                id="analyticsPatientName"
                type="text"
                placeholder="Search patient name..."
                value={analyticsPatientName}
                onChange={(event) => setAnalyticsPatientName(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition shadow-sm font-medium"
              />
            </div>
            <div>
              <label htmlFor="analyticsMinAmount" className="mb-1.5 block text-xs font-bold text-slate-700">Min Referral Amount (₹)</label>
              <input
                id="analyticsMinAmount"
                type="number"
                min="0"
                placeholder="Min ₹"
                value={analyticsMinAmount}
                onChange={(event) => setAnalyticsMinAmount(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition shadow-sm font-medium"
              />
            </div>
            <div>
              <label htmlFor="analyticsMaxAmount" className="mb-1.5 block text-xs font-bold text-slate-700">Max Referral Amount (₹)</label>
              <input
                id="analyticsMaxAmount"
                type="number"
                min="0"
                placeholder="Max ₹"
                value={analyticsMaxAmount}
                onChange={(event) => setAnalyticsMaxAmount(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition shadow-sm font-medium"
              />
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
            {userAnalyticsRows.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50/20">
                <p className="text-sm font-medium">No leads match the selected filters and period.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Total Leads</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Pending</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Approved</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Rejected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {userAnalyticsRows.map((row) => {
                    const rowKey = row.userId ?? row.email;
                    const isExpanded = !!expandedAnalyticsRows[rowKey];

                    return (
                      <React.Fragment key={rowKey}>
                        <tr
                          onClick={() => setExpandedAnalyticsRows(prev => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                          className="hover:bg-slate-50/50 transition duration-150 cursor-pointer"
                        >
                          <td className="px-6 py-4 text-sm text-slate-900 font-medium flex items-center gap-2">
                            <span className="text-slate-400 font-mono text-xs w-4">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                            {row.email}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900">
                            {row.fullName || '—'}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.count}</td>
                          <td className="px-6 py-4 text-sm font-bold text-amber-600">{row.pendingCount}</td>
                          <td className="px-6 py-4 text-sm font-bold text-emerald-600">{row.approvedCount}</td>
                          <td className="px-6 py-4 text-sm font-bold text-rose-600">{row.rejectedCount}</td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="bg-slate-50/50 px-6 py-4 border-t border-b border-slate-200/50">
                              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                  </svg>
                                  Leads Contribution Breakdown
                                </h4>
                                {row.leadsDetail.length === 0 ? (
                                  <p className="text-xs text-slate-500">No individual patient details found.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {row.leadsDetail.map((lead, idx) => (
                                      <div key={idx} className="flex flex-col p-3 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition duration-150">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-semibold text-xs text-slate-800">{lead.patientName}</span>
                                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                            lead.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                            lead.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                            'bg-amber-100 text-amber-700'
                                          }`}>
                                            {lead.status}
                                          </span>
                                        </div>
                                        <div className="mt-1.5 text-[11px] text-slate-500 space-y-0.5">
                                          {lead.doctorName ? (
                                            <div>
                                              Doctor: <strong className="text-slate-700">Dr. {lead.doctorName}</strong>
                                            </div>
                                          ) : (
                                            <div className="text-indigo-600 font-medium">
                                              Direct PRO Lead
                                            </div>
                                          )}
                                          {analyticsGroupBy === 'doctor' && lead.proName && (
                                            <div>
                                              Linked PRO: <strong className="text-slate-700">{lead.proName}</strong>
                                            </div>
                                          )}
                                          {analyticsGroupBy === 'pro' && lead.proName && (
                                            <div>
                                              PRO: <strong className="text-slate-700">{lead.proName}</strong>
                                            </div>
                                          )}
                                        </div>
                                        {lead.referralAmount !== null && (
                                          <div className="mt-2 text-xs font-bold text-emerald-600">
                                            Referral: ₹{lead.referralAmount.toLocaleString('en-IN')}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section id="submissions" className={`${activeSection === 'submissions' ? '' : 'hidden'} bg-white rounded-lg shadow overflow-hidden`}>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Submitted Leads</h2>
              <p className="text-sm text-gray-600">
                Showing {filteredSubmissions.length} of {submissions.length}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
            {unreadCount > 0 && <button type="button" onClick={() => void markAllSeen()} className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Mark {unreadCount} new as read</button>}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isExporting ? 'Downloading...' : 'Download Excel'}
            </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <p>Loading leads...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No leads match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-leads-table w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Patient Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Referral Source</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Contact</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Files</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Submitted</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Approval</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Treatment & Referral</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((submission) => {
                    const status = submission.status ?? 'Pending';

                    return (
                      <tr key={submission.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          <div className="flex items-center gap-2">{submission.fullName}{!submission.adminSeenAt && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span>}</div>
                        </td>
                        {/* 2. Referral Source */}
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {submission.submittedByRole === 'doctor' ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 border border-teal-200 uppercase tracking-wider">
                                Doctor Referral
                              </span>
                              <div className="font-semibold text-slate-800">
                                Dr. {submission.submittedByName}
                              </div>
                              <div className="text-xs text-slate-400 break-all">
                                {submission.submittedByEmail}
                              </div>
                              <div className="mt-1">
                                <span className="text-[11px] font-medium text-blue-600 bg-blue-50/70 border border-blue-100 px-1.5 py-0.5 rounded inline-block">
                                  PRO: {submission.parentProName}
                                </span>
                              </div>
                            </div>
                          ) : submission.submittedByRole === 'pro' ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                                Direct PRO
                              </span>
                              <div className="font-semibold text-slate-800">
                                {submission.submittedByName}
                              </div>
                              <div className="text-xs text-slate-400 break-all">
                                {submission.submittedByEmail}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200 uppercase tracking-wider">
                                Admin Entry
                              </span>
                              <div className="font-semibold text-slate-800">
                                {submission.submittedByName}
                              </div>
                              <div className="text-xs text-slate-400 break-all">
                                {submission.submittedByEmail}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 3. Contact */}
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {submission.contactNumber || 'Not provided'}
                        </td>

                        {/* 4. Files */}
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {submission.documents.length} file(s)
                        </td>

                        {/* 5. Submitted */}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(submission.submittedAt).toLocaleString()}
                        </td>

                        {/* 6. Approval */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}>
                            {status}
                          </span>
                        </td>

                        {/* 7. Treatment & Referral */}
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {status === 'Approved' ? (
                            <div className="space-y-1">
                              <div>
                                <span className="text-xs text-slate-500">Treatment: </span>
                                <span className="font-semibold text-slate-800">{submission.treatmentStatus}</span>
                              </div>
                              {submission.referralAmount !== null && (
                                <div>
                                  <span className="text-xs text-slate-500">Amount: </span>
                                  <span className="font-bold text-emerald-600">₹{submission.referralAmount.toLocaleString('en-IN')}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-xs text-slate-500">Payment: </span>
                                <span className={`font-semibold ${
                                  submission.paymentStatus === 'Paid' ? 'text-green-600' :
                                  submission.paymentStatus === 'Processing' ? 'text-blue-600' :
                                  'text-amber-600'
                                }`}>
                                  {submission.paymentStatus}
                                </span>
                                {submission.paymentMethod && (
                                  <span className="text-xs text-slate-500"> ({submission.paymentMethod})</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs font-medium">—</span>
                          )}
                        </td>

                        {/* 8. Actions */}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setReviewLead(submission);
                              if (!submission.adminSeenAt) void markSeen(submission.id);
                            }}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 w-full sm:w-auto"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Review Lead Modal */}
      {activeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <section className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 bg-slate-50">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-950">Review Patient Lead</h2>
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    activeLead.status === 'Approved' ? 'bg-green-100 text-green-800 border-green-200' :
                    activeLead.status === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-yellow-100 text-yellow-800 border-yellow-200'
                  }`}>
                    {activeLead.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">ID: {activeLead.id} • Submitted: {new Date(activeLead.submittedAt).toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => setReviewLead(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition text-xl font-bold"
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-y-auto min-h-0">
              {/* Left Column - Lead Details & Files */}
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide">Patient Information</h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Patient Name</dt>
                      <dd className="text-gray-900 font-semibold">{activeLead.fullName}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Father's Name</dt>
                      <dd className="text-gray-900 font-semibold">{activeLead.fatherName || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Gender</dt>
                      <dd className="text-gray-900 font-semibold">{activeLead.gender}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Age</dt>
                      <dd className="text-gray-900 font-semibold">{activeLead.age}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Contact Number</dt>
                      <dd className="text-gray-900 font-semibold">{activeLead.contactNumber || 'Not provided'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Disease / Diagnosis</dt>
                      <dd className="text-gray-900 font-semibold whitespace-pre-line">{activeLead.disease || 'Not provided'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500">Permanent Address</dt>
                      <dd className="text-gray-900 font-semibold whitespace-pre-wrap">{activeLead.address}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500">Current Location</dt>
                      <dd className="text-gray-900 font-semibold whitespace-pre-wrap">{activeLead.currentLocation}</dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide">Referral Source</h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Submitted By</dt>
                      <dd className="text-gray-900 font-semibold">{activeLead.submittedByName} ({activeLead.submittedByRole.toUpperCase()})</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Email Address</dt>
                      <dd className="text-gray-900 font-semibold break-all">{activeLead.submittedByEmail}</dd>
                    </div>
                    {activeLead.submittedByRole === 'doctor' && (
                      <div className="sm:col-span-2">
                        <dt className="text-gray-500">Linked PRO Account</dt>
                        <dd className="text-gray-900 font-semibold">{activeLead.parentProName}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide">Uploaded Files</h3>
                  {activeLead.documents.length === 0 ? (
                    <p className="text-sm text-gray-500">No files were uploaded with this lead.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {activeLead.documents.map((document, index) => {
                        const file =
                          typeof document === 'string'
                            ? { name: document, isImage: false }
                            : document;

                        return (
                          <div key={`${file.name}-${index}`} className="border border-slate-200 bg-white rounded-lg p-3">
                            {file.isImage && file.dataUrl ? (
                              <Image
                                src={file.dataUrl}
                                alt={file.name}
                                width={320}
                                height={192}
                                unoptimized
                                className="w-full h-32 object-cover rounded-md border border-gray-200 mb-2"
                              />
                            ) : (
                              <div className="h-24 rounded-md border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-500 mb-2">
                                File preview unavailable
                              </div>
                            )}
                            <p className="text-xs font-semibold text-gray-900 truncate">{file.name}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {[file.type, formatFileSize(file.size)].filter(Boolean).join(' - ')}
                            </p>
                            {file.dataUrl && (
                              <button
                                type="button"
                                onClick={() => downloadFile(file.dataUrl!, file.name)}
                                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 transition hover:bg-blue-100"
                              >
                                Download
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Status updates, Care management, History */}
              <div className="space-y-6">
                {/* 1. Approval Decisions (If Status is Pending) */}
                {activeLead.status === 'Pending' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h3 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wide">Approval Decision</h3>
                    <p className="text-xs text-slate-500 mb-4">Please review the details and files. Approve or Reject this referral.</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setStatusReason('');
                          setStatusAction({ submission: activeLead, status: 'Approved' });
                        }}
                        className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 shadow-sm"
                      >
                        Approve Lead
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusReason('');
                          setStatusAction({ submission: activeLead, status: 'Rejected' });
                        }}
                        className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 shadow-sm"
                      >
                        Reject Lead
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Rejection Info Banner (If Status is Rejected) */}
                {activeLead.status === 'Rejected' && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <h4 className="font-bold text-red-800 text-sm">Lead Rejected</h4>
                    <p className="mt-1 text-xs text-red-900 whitespace-pre-wrap leading-relaxed">
                      <strong>Reason: </strong>{activeLead.rejectionReason || 'No reason provided.'}
                    </p>
                  </div>
                )}

                {/* 3. Care & Referral Management (If Status is Approved) */}
                {activeLead.status === 'Approved' && (
                  <CareManagement
                    submission={activeLead}
                    onUpdated={(updated) =>
                      setSubmissions((current) =>
                        current.map((item) => (item.id === updated.id ? updated : item))
                      )
                    }
                  />
                )}

                {/* 4. Status History Timeline */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide">Status History</h3>
                  {activeLead.statusHistory.length === 0 ? (
                    <p className="text-xs text-slate-500">No status updates recorded yet.</p>
                  ) : (
                    <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4">
                      {activeLead.statusHistory.map((event) => (
                        <div key={event.id} className="relative">
                          <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-4 ring-white" />
                          <div className="text-xs">
                            <div className="font-bold text-slate-800">
                              {event.fromStatus} &rarr; {event.toStatus}
                            </div>
                            {event.reason && (
                              <p className="mt-1 text-[11px] text-slate-600 leading-normal bg-white p-2 rounded border border-slate-100">
                                {event.reason}
                              </p>
                            )}
                            <time className="block text-[10px] text-slate-400 mt-1">
                              {new Date(event.createdAt).toLocaleString()}
                            </time>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-200 px-6 py-4 bg-slate-50">
              <button
                type="button"
                onClick={() => setReviewLead(null)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Close Review
              </button>
            </div>
          </section>
        </div>
      )}

      {statusAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusAction.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : statusAction.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {`${statusAction.status} lead`}
            </span>
            <h2 className="mt-4 text-xl font-bold text-slate-950">{statusAction.submission.fullName}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {statusAction.status === 'Approved' ? 'Confirm that this lead is ready to be approved. The decision cannot be reopened.' : 'Explain clearly why this lead is being rejected. This message will be visible to the PRO and doctor.'}
            </p>
            {statusAction.status === 'Rejected' && <div className="mt-5">
              <label htmlFor="statusReason" className="mb-2 block text-sm font-bold text-slate-700">Reason <span className="text-red-500">*</span></label>
              <textarea id="statusReason" value={statusReason} onChange={(event) => setStatusReason(event.target.value)} rows={4} maxLength={500} placeholder="Example: Required medical document is missing…" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
              <p className="mt-1 text-right text-xs text-slate-400">{statusReason.length}/500</p>
            </div>}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setStatusAction(null); setStatusReason(''); }} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={isUpdatingStatus || (statusAction.status === 'Rejected' && statusReason.trim().length < 5)} onClick={() => void updateStatus(statusAction.submission.id, statusAction.status, statusReason.trim())} className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 ${statusAction.status === 'Rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{isUpdatingStatus ? 'Updating…' : 'Confirm update'}</button>
            </div>
          </section>
        </div>
      )}
      {passwordDialog && <PasswordDialog mode={passwordDialog.mode} targetId={passwordDialog.target?.id} targetName={passwordDialog.target?.fullName || user?.fullName || user?.email || 'Admin'} onClose={() => setPasswordDialog(null)} />}
      {newLeadNotice > 0 && <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-lg text-white">+</span>
        <button type="button" onClick={() => { setNewLeadNotice(0); document.getElementById('submissions')?.scrollIntoView(); }} className="text-left">
          <strong className="block text-sm text-slate-950">{newLeadNotice} new lead{newLeadNotice > 1 ? 's' : ''} received</strong>
          <span className="mt-1 block text-xs text-slate-500">Tap to review the latest submission.</span>
        </button>
        <button type="button" onClick={() => setNewLeadNotice(0)} className="text-slate-400 hover:text-slate-700" aria-label="Dismiss notification">×</button>
      </div>}
    </div>
  );
};
