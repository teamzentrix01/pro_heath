'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ReferenceAnalyticsRow,
  SubmissionStatus,
  UserAnalyticsRow,
  UserSubmission,
} from '@/types/submissions';
import { AppUser } from '@/types/users';
import { apiFetch } from '@/lib/api';

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

export const AdminDashboard = () => {
  const { logout } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [submissionPeriodFilter, setSubmissionPeriodFilter] = useState<'All' | 'weekly' | 'monthly'>('All');
  const [submissionPeriodDate, setSubmissionPeriodDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState<'All' | SubmissionStatus>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [analyticsDate, setAnalyticsDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [analyticsRows, setAnalyticsRows] = useState<ReferenceAnalyticsRow[]>([]);
  const [userAnalyticsRows, setUserAnalyticsRows] = useState<UserAnalyticsRow[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<AppUser[]>([]);
  const [userSummary, setUserSummary] = useState({
    registeredUsers: 0,
    usersWhoLoggedIn: 0,
    totalLogins: 0,
  });
  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
  });
  const [userCreationMessage, setUserCreationMessage] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setDashboardError('');

    try {
      const response = await apiFetch('/api/submissions');

      if (!response.ok) {
        throw new Error('Unable to load submissions');
      }

      const data = await response.json();
      setSubmissions(data.submissions);
    } catch {
      setDashboardError('Unable to load submissions from the database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSubmissions();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSubmissions]);

  const loadUsers = useCallback(async () => {
    try {
      const response = await apiFetch('/api/users');
      if (!response.ok) {
        throw new Error('Unable to load users');
      }

      const data = await response.json();
      setRegisteredUsers(data.users);
      setUserSummary(data.summary);
    } catch {
      setDashboardError('Unable to load registered users from the database.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const params = new URLSearchParams({
          period: analyticsPeriod,
          date: analyticsDate,
        });
        const response = await apiFetch(`/api/analytics/reference?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Unable to load analytics');
        }

        const data = await response.json();
        setAnalyticsRows(data.rows);
      } catch {
        setAnalyticsRows([]);
      }
    };

    void loadAnalytics();
  }, [analyticsDate, analyticsPeriod]);

  useEffect(() => {
    const loadUserAnalytics = async () => {
      try {
        const params = new URLSearchParams({
          period: analyticsPeriod,
          date: analyticsDate,
        });
        const response = await apiFetch(`/api/analytics/users?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Unable to load user analytics');
        }

        const data = await response.json();
        setUserAnalyticsRows(data.rows);
      } catch {
        setUserAnalyticsRows([]);
      }
    };

    void loadUserAnalytics();
  }, [analyticsDate, analyticsPeriod]);

  const updateStatus = async (submissionId: string, status: SubmissionStatus) => {
    setDashboardError('');

    try {
      const response = await apiFetch(`/api/submissions/${submissionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Unable to update status');
      }

      const data = await response.json();
      setSubmissions((currentSubmissions) =>
        currentSubmissions.map((submission) =>
          submission.id === submissionId ? data.submission : submission
        )
      );
    } catch {
      setDashboardError('Unable to update this submission status.');
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
        submission.reference,
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
  const calendarTitle = calendarDate.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPreviousMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const cells: Array<{ day: number; currentMonth: boolean; isToday: boolean }> = [];

    for (let index = firstDayOfMonth - 1; index >= 0; index -= 1) {
      cells.push({
        day: daysInPreviousMonth - index,
        currentMonth: false,
        isToday: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        day,
        currentMonth: true,
        isToday:
          day === today.getDate() &&
          month === today.getMonth() &&
          year === today.getFullYear(),
      });
    }

    const remainingCells = 42 - cells.length;
    for (let day = 1; day <= remainingCells; day += 1) {
      cells.push({
        day,
        currentMonth: false,
        isToday: false,
      });
    }

    return cells;
  }, [calendarDate]);

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
        throw new Error(data.error || 'Unable to create user');
      }

      setNewUser({ fullName: '', email: '', phoneNumber: '', password: '' });
      setUserCreationMessage('User credentials created successfully.');
      await loadUsers();
    } catch (error) {
      setUserCreationMessage(
        error instanceof Error ? error.message : 'Unable to create user.'
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900"> Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome to the admin panel</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          > 
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {dashboardError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {dashboardError}
          </div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-600 text-sm font-medium">Total Submissions</p>
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
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-white px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">Create User Credentials</h2>
              <p className="mt-1 text-sm text-gray-600">
                Only accounts created here can log in to Health track.
              </p>
            </div>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 gap-5 p-6 xl:grid-cols-2">
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
                  type="text"
                  value={newUser.fullName}
                  onChange={(event) =>
                    setNewUser((current) => ({ ...current, fullName: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Enter user's full name"
                />
              </div>

              <div>
                <label htmlFor="newUserEmail" className="mb-2 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="newUserEmail"
                  type="email"
                  value={newUser.email}
                  onChange={(event) =>
                    setNewUser((current) => ({ ...current, email: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label htmlFor="newUserPhone" className="mb-2 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  id="newUserPhone"
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
                  {isCreatingUser ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-white px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Calendar</h2>
                  <p className="mt-1 text-sm text-gray-600">Quick monthly view for admin planning.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date())}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg text-gray-700 transition hover:bg-gray-50"
                >
                  ‹
                </button>
                <p className="text-base font-bold text-gray-900">{calendarTitle}</p>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-lg text-gray-700 transition hover:bg-gray-50"
                >
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="py-1 text-xs font-bold uppercase text-gray-500">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, index) => (
                  <div
                    key={`${day.day}-${index}`}
                    className={`flex h-10 items-center justify-center rounded-md text-xs font-semibold transition sm:h-11 xl:h-12 ${
                      day.isToday
                        ? 'bg-blue-600 text-white shadow-sm'
                        : day.currentMonth
                          ? 'bg-gray-50 text-gray-900 hover:bg-blue-50'
                          : 'bg-white text-gray-300'
                    }`}
                  >
                    {day.day}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Registered Users</h2>
            <p className="text-sm text-gray-600 mt-1">
              {userSummary.registeredUsers} registered, {userSummary.usersWhoLoggedIn} logged in,
              {' '}{userSummary.totalLogins} total login events
            </p>
          </div>

          {registeredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No registered users found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Forms</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Logins</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Last Login</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Registered</th>
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
                      <td className="px-6 py-4 text-sm text-gray-900 capitalize">{registeredUser.role}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {registeredUser.submissionCount}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {registeredUser.loginCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {registeredUser.lastLoginAt
                          ? new Date(registeredUser.lastLoginAt).toLocaleString()
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(registeredUser.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Filters</h2>
              <p className="text-sm text-gray-600 mt-1">
                Search by date, name, contact, reference, status, document name, or any saved form detail.
              </p>
            </div>
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
              onClick={loadSubmissions}
              className="border border-blue-300 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 transition"
            >
              Refresh
            </button>
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
                placeholder="Name, reference, contact, document..."
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

        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Reference Analytics</h2>
              <p className="text-sm text-gray-600 mt-1">
                Track how many forms came through each reference or source.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="analyticsPeriod" className="block text-sm font-medium text-gray-700 mb-2">
                  Period
                </label>
                <select
                  id="analyticsPeriod"
                  value={analyticsPeriod}
                  onChange={(event) => setAnalyticsPeriod(event.target.value as 'weekly' | 'monthly')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label htmlFor="analyticsDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  id="analyticsDate"
                  type="date"
                  value={analyticsDate}
                  onChange={(event) => setAnalyticsDate(event.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            {analyticsRows.length === 0 ? (
              <p className="text-gray-500 text-sm">No submissions found for this selected period.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reference / Source</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Forms Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsRows.map((row) => (
                    <tr key={row.source} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-900">{row.source}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">User Submission Analytics</h2>
            <p className="text-sm text-gray-600 mt-1">
              Forms submitted by each logged-in email for the selected analytics period.
            </p>
          </div>
          <div className="mt-5 overflow-x-auto">
            {userAnalyticsRows.length === 0 ? (
              <p className="text-gray-500 text-sm">No user submissions found for this selected period.</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Forms Submitted</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pending</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Approved</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  {userAnalyticsRows.map((row) => (
                    <tr key={row.userId ?? row.email} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-900">{row.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {row.fullName || 'Not provided'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.count}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-yellow-700">{row.pendingCount}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-700">{row.approvedCount}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-red-700">{row.rejectedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-gray-900">Submitted Forms</h2>
            <p className="text-sm text-gray-600">
              Showing {filteredSubmissions.length} of {submissions.length}
            </p>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <p>Loading submissions...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No submissions match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Submitted By</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Contact</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Reference</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Files</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Submitted</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((submission) => {
                    const status = submission.status ?? 'Pending';
                    const isExpanded = expandedId === submission.id;

                    return (
                      <React.Fragment key={submission.id}>
                        <tr className="border-b border-gray-100">
                          <td className="px-6 py-4 text-sm text-gray-900">{submission.fullName}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{submission.submittedByEmail}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {submission.contactNumber || 'Not provided'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {submission.reference}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {submission.documents.length} file(s)
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(submission.submittedAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {(['Pending', 'Approved', 'Rejected'] as SubmissionStatus[]).map((nextStatus) => (
                                <button
                                  key={nextStatus}
                                  type="button"
                                  onClick={() => updateStatus(submission.id, nextStatus)}
                                  className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition"
                                >
                                  {nextStatus}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : submission.id)}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition"
                              >
                                {isExpanded ? 'Hide Details' : 'Review'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan={8} className="px-6 py-6">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white border border-gray-200 rounded-lg p-5">
                                  <h3 className="font-bold text-gray-900 mb-4">Full Submission Details</h3>
                                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <dt className="text-gray-500">Submission ID</dt>
                                      <dd className="text-gray-900 font-medium break-all">{submission.id}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500">Status</dt>
                                      <dd className="text-gray-900 font-medium">{status}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500">Full Name</dt>
                                      <dd className="text-gray-900 font-medium">{submission.fullName}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500">Submitted By</dt>
                                      <dd className="text-gray-900 font-medium break-all">
                                        {submission.submittedByEmail}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500">Gender</dt>
                                      <dd className="text-gray-900 font-medium">{submission.gender}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500">Age</dt>
                                      <dd className="text-gray-900 font-medium">{submission.age}</dd>
                                    </div>
                                    <div>
                                      <dt className="text-gray-500">Contact Number</dt>
                                      <dd className="text-gray-900 font-medium">
                                        {submission.contactNumber || 'Not provided'}
                                      </dd>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <dt className="text-gray-500">Reference / Source</dt>
                                      <dd className="text-gray-900 font-medium whitespace-pre-wrap">
                                        {submission.reference}
                                      </dd>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <dt className="text-gray-500">Submitted At</dt>
                                      <dd className="text-gray-900 font-medium">
                                        {new Date(submission.submittedAt).toLocaleString()}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>

                                <div className="bg-white border border-gray-200 rounded-lg p-5">
                                  <h3 className="font-bold text-gray-900 mb-4">Uploaded Files</h3>
                                  {submission.documents.length === 0 ? (
                                    <p className="text-sm text-gray-500">No files were uploaded with this form.</p>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {submission.documents.map((document, index) => {
                                        const file =
                                          typeof document === 'string'
                                            ? { name: document, isImage: false }
                                            : document;

                                        return (
                                          <div key={`${file.name}-${index}`} className="border border-gray-200 rounded-lg p-3">
                                            {file.isImage && file.dataUrl ? (
                                              <Image
                                                src={file.dataUrl}
                                                alt={file.name}
                                                width={320}
                                                height={192}
                                                unoptimized
                                                className="w-full h-48 object-cover rounded-md border border-gray-200 mb-3"
                                              />
                                            ) : (
                                              <div className="h-28 rounded-md border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-500 mb-3">
                                                File preview unavailable
                                              </div>
                                            )}
                                            <p className="text-sm font-medium text-gray-900 break-all">{file.name}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                              {[file.type, formatFileSize(file.size)].filter(Boolean).join(' - ')}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
