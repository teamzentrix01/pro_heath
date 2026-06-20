'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DocumentUpload } from './DocumentUpload';
import { apiFetch, apiUrl } from '@/lib/api';
import { SubmissionStatus, UserSubmission } from '@/types/submissions';
import { DoctorManagement } from './DoctorManagement';
import { PaymentMethodSelector } from './PaymentMethodSelector';

const MAX_DOCUMENTS = 5;
const MAX_DOCUMENT_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_DOCUMENT_SIZE_BYTES = 6 * 1024 * 1024;
const POLL_INTERVAL_MS = 15_000;

const statusStyles: Record<SubmissionStatus, string> = {
  Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Approved: 'bg-green-100 text-green-800 border-green-200',
  Rejected: 'bg-red-100 text-red-800 border-red-200',
};

export const UserForm = () => {
  const { user, updateUser, logout } = useAuth();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLeadsOpen, setIsLeadsOpen] = useState(false);
  const [myLeads, setMyLeads] = useState<UserSubmission[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [leadsError, setLeadsError] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const leadsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [profile, setProfile] = useState({
    fullName: user?.fullName ?? '',
    phoneNumber: user?.phoneNumber ?? '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [formData, setFormData] = useState({
    fullName: '',
    fatherName: '',
    gender: '',
    age: '',
    contactNumber: '',
    address: '',
    currentLocation: '',
  });

  const [documents, setDocuments] = useState<File[]>([]);
  const [documentError, setDocumentError] = useState('');
  const [uploadResetKey, setUploadResetKey] = useState(0);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  const initials = useMemo(() => {
    const label = user?.fullName || user?.email || 'P';
    return label
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load leads
  const loadMyLeads = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingLeads(true);
    setLeadsError('');
    try {
      const response = await apiFetch('/api/submissions/my');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load patient records.');
      setMyLeads(Array.isArray(data.submissions) ? data.submissions : []);
    } catch {
      setLeadsError('Patient records could not be loaded. Please retry.');
    } finally {
      if (!silent) setIsLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMyLeads(true), 0);
    return () => window.clearTimeout(timer);
  }, [loadMyLeads]);

  // Poll leads when leads panel is open
  useEffect(() => {
    if (isLeadsOpen) {
      const timer = window.setTimeout(() => void loadMyLeads(), 0);
      leadsPollRef.current = setInterval(() => {
        void loadMyLeads(true);
      }, POLL_INTERVAL_MS);

      return () => {
        window.clearTimeout(timer);
        if (leadsPollRef.current) {
          clearInterval(leadsPollRef.current);
          leadsPollRef.current = null;
        }
      };
    }

    return () => {
      if (leadsPollRef.current) {
        clearInterval(leadsPollRef.current);
        leadsPollRef.current = null;
      }
    };
  }, [isLeadsOpen, loadMyLeads]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'contactNumber' ? value.replace(/\D/g, '').slice(0, 10) : value,
    }));
  };

  const handleUseCurrentLocation = () => {
    setLocationMessage('');

    if (!navigator.geolocation) {
      setLocationMessage('Location access is not supported by this browser.');
      return;
    }

    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = coords.latitude.toFixed(6);
        const longitude = coords.longitude.toFixed(6);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { Accept: 'application/json' } }
          );

          if (!response.ok) throw new Error('Unable to find address');
          const location = (await response.json()) as { display_name?: string };
          const readableLocation = location.display_name?.trim();
          if (!readableLocation) throw new Error('Readable address not found');

          setFormData((previous) => ({
            ...previous,
            currentLocation: readableLocation,
          }));
          setLocationMessage('Complete available address fetched successfully.');
        } catch {
          setLocationMessage('Readable address could not be fetched. Please enter it manually.');
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Location permission was denied. Please allow location access and try again.',
          2: 'Current location is unavailable. Please turn on GPS and try again.',
          3: 'Location request timed out. Please try again.',
        };
        setLocationMessage(messages[error.code] ?? 'Unable to fetch current location.');
        setIsFetchingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const validateDocuments = (files: File[]) => {
    if (files.length > MAX_DOCUMENTS) {
      return `Upload up to ${MAX_DOCUMENTS} documents.`;
    }

    if (files.some((file) => file.size > MAX_DOCUMENT_SIZE_BYTES)) {
      return 'Each document must be 2 MB or smaller.';
    }

    const totalSize = files.reduce((total, file) => total + file.size, 0);
    if (totalSize > MAX_TOTAL_DOCUMENT_SIZE_BYTES) {
      return 'Total document size must be 6 MB or smaller.';
    }

    return '';
  };

  const handleDocumentsChange = (files: File[]) => {
    const error = validateDocuments(files);
    setDocumentError(error);
    setDocuments(error ? [] : files);
    if (error) {
      setUploadResetKey((key) => key + 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');

    if (
      !formData.fullName.trim() ||
      !formData.fatherName.trim() ||
      !formData.gender ||
      !formData.age ||
      (formData.contactNumber && !/^\d{10}$/.test(formData.contactNumber)) ||
      !formData.address.trim() ||
      !formData.currentLocation.trim()
    ) {
      alert('Please fill in all required fields. If you enter a contact number, use 10 digits.');
      return;
    }

    const validationMessage = validateDocuments(documents);
    if (validationMessage) {
      setDocumentError(validationMessage);
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedFiles = await Promise.all(
        documents.map(async (doc) => ({
          name: doc.name,
          type: doc.type,
          size: doc.size,
          isImage: doc.type.startsWith('image/'),
          dataUrl: await readFileAsDataUrl(doc),
        }))
      );

      const response = await apiFetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          fatherName: formData.fatherName,
          gender: formData.gender,
          age: parseInt(formData.age),
          contactNumber: formData.contactNumber,
          address: formData.address,
          currentLocation: formData.currentLocation,
          documents: uploadedFiles,
        }),
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      setSuccessMessage('Lead submitted successfully. Your documents have been received.');
      setFormData({
        fullName: '',
        fatherName: '',
        gender: '',
        age: '',
        contactNumber: '',
        address: '',
        currentLocation: '',
      });
      setDocuments([]);
      setDocumentError('');
      setUploadResetKey((key) => key + 1);

      // Refresh leads if visible
      if (isLeadsOpen) {
        void loadMyLeads(true);
      }
    } catch {
      alert('Error submitting lead. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleExportMyLeads = async () => {
    setIsExporting(true);
    try {
      const link = document.createElement('a');
      link.href = apiUrl('/api/submissions/my/export');
      link.click();
    } finally {
      setTimeout(() => setIsExporting(false), 2000);
    }
  };

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileMessage('');

    if (!user || !profile.fullName.trim() || !/^\d{10}$/.test(profile.phoneNumber)) {
      setProfileMessage('Enter your name and a valid 10-digit phone number.');
      return;
    }

    if (profile.newPassword || profile.currentPassword || profile.confirmPassword) {
      if (!profile.currentPassword || profile.newPassword.length < 8) {
        setProfileMessage('Enter your current password and a new password of at least 8 characters.');
        return;
      }

      if (profile.newPassword !== profile.confirmPassword) {
        setProfileMessage('New password and confirmation do not match.');
        return;
      }
    }

    setIsSavingProfile(true);

    try {
      const response = await apiFetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: profile.fullName.trim(),
          phoneNumber: profile.phoneNumber,
          currentPassword: profile.currentPassword,
          newPassword: profile.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update profile');
      }

      updateUser(data.user);
      setProfile((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      setProfileMessage('Profile updated successfully.');
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Unable to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const leadStatusCounts = useMemo(() => {
    return myLeads.reduce(
      (acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      },
      { Pending: 0, Approved: 0, Rejected: 0 } as Record<string, number>
    );
  }, [myLeads]);
  const referralSummary = useMemo(() => ({
    earned: myLeads.reduce((sum, lead) => sum + (lead.referralAmount ?? 0), 0),
    paid: myLeads.filter((lead) => lead.paymentStatus === 'Paid').reduce((sum, lead) => sum + (lead.referralAmount ?? 0), 0),
  }), [myLeads]);
  const displayedLeads = useMemo(
    () => selectedDoctorId ? myLeads.filter((lead) => lead.userId === selectedDoctorId) : myLeads,
    [myLeads, selectedDoctorId]
  );
  const displayedLeadCounts = useMemo(() => displayedLeads.reduce(
    (counts, lead) => ({ ...counts, [lead.status]: counts[lead.status] + 1 }),
    { Pending: 0, Approved: 0, Rejected: 0 } as Record<SubmissionStatus, number>
  ), [displayedLeads]);
  const selectedDoctorName = selectedDoctorId
    ? myLeads.find((lead) => lead.userId === selectedDoctorId)?.submittedByName
    : '';

  return (
    <div className="app-surface user-dashboard text-slate-950">
      <header className="user-topbar sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              PRO HealthTrack
            </h1>
            <p className="mt-1 text-sm text-slate-500">Healthcare Lead Management System</p>
          </div>

          <div ref={menuRef} className="relative flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">
                {user?.fullName || 'My Account'}
              </p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm ring-4 ring-blue-100">
              {initials}
            </div>
            <button
              type="button"
              aria-label="Open profile menu"
              onClick={() => setIsMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl leading-none text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              ⋯
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-14 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setProfile((current) => ({
                      ...current,
                      fullName: user?.fullName ?? '',
                      phoneNumber: user?.phoneNumber ?? '',
                    }));
                    setProfileMessage('');
                    setIsProfileOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                    {initials}
                  </span>
                  My Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDoctorId(null);
                    setIsLeadsOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-xs font-bold text-green-700">
                    📋
                  </span>
                  My Leads ({myLeads.length || '...'})
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="user-hero">
          <div className="relative z-[1]">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-blue-50">
              {user?.isDoctor ? 'Doctor workspace' : 'PRO workspace'}
            </span>
            <h2 className="mt-4">Welcome back, {user?.fullName?.split(' ')[0] || (user?.isDoctor ? 'Doctor' : 'PRO')}</h2>
            <p>Submit patient details securely, attach medical reports, and track treatment and referral payments.</p>
          </div>
          <div className="hero-badge" aria-hidden="true">✚</div>
        </section>

        <section className="user-stat-grid" aria-label="Lead summary">
          <div className="user-stat"><strong>{myLeads.length}</strong><span>Total leads</span></div>
          <div className="user-stat"><strong className="!text-amber-600">{leadStatusCounts.Pending}</strong><span>Pending</span></div>
          <div className="user-stat"><strong className="!text-emerald-600">{user?.isDoctor ? `₹${referralSummary.earned.toLocaleString('en-IN')}` : leadStatusCounts.Approved}</strong><span>{user?.isDoctor ? 'Referral earned' : 'Approved'}</span></div>
          <button type="button" onClick={() => { setSelectedDoctorId(null); setIsLeadsOpen(true); }} className="user-stat text-left transition hover:-translate-y-0.5 hover:shadow-lg">
            <strong className="!text-blue-600">{user?.isDoctor ? `₹${referralSummary.paid.toLocaleString('en-IN')}` : 'View'}</strong><span>{user?.isDoctor ? 'Referral paid →' : 'My lead history →'}</span>
          </button>
        </section>

        {user?.isPro && <DoctorManagement onViewPatients={(doctorId) => { setSelectedDoctorId(doctorId); setIsLeadsOpen(true); void loadMyLeads(); }} />}

        <section className="user-form-card rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="form-heading">
            <span className="section-kicker">New referral</span>
            <h2>Patient information</h2>
            <p>Enter the patient details below. Fields marked with an asterisk are required.</p>
          </div>
          {successMessage && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-slate-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Enter patient's full name"
                />
              </div>

              <div>
                <label htmlFor="gender" className="mb-2 block text-sm font-semibold text-slate-700">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="fatherName" className="mb-2 block text-sm font-semibold text-slate-700">Father&apos;s Name <span className="text-red-500">*</span></label>
                <input type="text" id="fatherName" name="fatherName" value={formData.fatherName} onChange={handleInputChange} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Enter father's name" />
              </div>

              <div>
                <label htmlFor="age" className="mb-2 block text-sm font-semibold text-slate-700">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="age"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Enter patient's age"
                  min="1"
                  max="150"
                />
              </div>

              <div>
                <label htmlFor="contactNumber" className="mb-2 block text-sm font-semibold text-slate-700">
                  Contact Number
                </label>
                <input
                  type="tel"
                  id="contactNumber"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleInputChange}
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  minLength={10}
                  maxLength={10}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder=" 10-digit phone number"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div><label htmlFor="address" className="mb-2 block text-sm font-semibold text-slate-700">Permanent Address <span className="text-red-500">*</span></label><textarea id="address" name="address" value={formData.address} onChange={handleInputChange} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Full permanent address" rows={3} /></div>
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="currentLocation" className="text-sm font-semibold text-slate-700">
                    Current Location <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isFetchingLocation}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 ${isFetchingLocation ? 'animate-pulse' : ''}`} aria-hidden="true">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                    {isFetchingLocation ? 'Fetching location...' : 'Use current location'}
                  </button>
                </div>
                <textarea id="currentLocation" name="currentLocation" value={formData.currentLocation} onChange={handleInputChange} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Patient's current location" rows={3} />
                {locationMessage && (
                  <p className={`mt-2 text-xs font-medium ${locationMessage.includes('successfully') || locationMessage.startsWith('GPS') ? 'text-emerald-600' : 'text-amber-700'}`} role="status">
                    {locationMessage}
                  </p>
                )}
              </div>
            </div>

            <DocumentUpload
              key={uploadResetKey}
              onFilesChange={handleDocumentsChange}
              error={documentError}
            />

            <div className="flex justify-end border-t border-slate-100 pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-400 sm:w-auto"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Lead'}
              </button>
            </div>
          </form>
        </section>
      </main>

      {/* Profile Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-4 py-8">
          <section className="max-h-full w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white ring-4 ring-blue-100">
                  {initials}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-950">My Profile</h2>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close profile"
              >
                x
              </button>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-6 px-6 py-6">
              {profileMessage && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
                  {profileMessage}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="profileFullName" className="mb-2 block text-sm font-semibold text-slate-700">
                    Full Name
                  </label>
                  <input
                    id="profileFullName"
                    type="text"
                    value={profile.fullName}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, fullName: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label htmlFor="profilePhoneNumber" className="mb-2 block text-sm font-semibold text-slate-700">
                    Phone Number
                  </label>
                  <input
                    id="profilePhoneNumber"
                    type="tel"
                    value={profile.phoneNumber}
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        phoneNumber: event.target.value.replace(/\D/g, '').slice(0, 10),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="Enter 10-digit phone number"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
                <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-3">
                  <div>
                    <label htmlFor="currentPassword" className="mb-2 block text-sm font-semibold text-slate-700">
                      Current
                    </label>
                    <input
                      id="currentPassword"
                      type="password"
                      value={profile.currentPassword}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, currentPassword: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder="Current password"
                    />
                  </div>
                  <div>
                    <label htmlFor="newPassword" className="mb-2 block text-sm font-semibold text-slate-700">
                      New
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      value={profile.newPassword}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, newPassword: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder="At least 8 characters"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-700">
                      Confirm
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={profile.confirmPassword}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, confirmPassword: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder="Confirm password"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:bg-slate-400"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* My Leads Modal */}
      {isLeadsOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-4 py-8">
          <section className="max-h-full w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-950">{selectedDoctorId ? `Dr. ${selectedDoctorName || 'Doctor'}'s Patients` : user?.isPro ? 'My & Doctor Patients' : 'My Leads'}</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  All patients you have referred — status updates in real-time
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLeadsOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close leads"
              >
                x
              </button>
            </div>

            {/* Lead Stats */}
            <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-slate-100">
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{displayedLeads.length}</p>
                <p className="text-xs font-medium text-blue-600">Total</p>
              </div>
              <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{displayedLeadCounts.Pending}</p>
                <p className="text-xs font-medium text-yellow-600">Pending</p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{displayedLeadCounts.Approved}</p>
                <p className="text-xs font-medium text-green-600">Approved</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{displayedLeadCounts.Rejected}</p>
                <p className="text-xs font-medium text-red-600">Rejected</p>
              </div>
            </div>

            <div className="px-6 py-4">
              {/* Download Button */}
              <div className="flex justify-end mb-4">
                <button
                  type="button"
                  onClick={handleExportMyLeads}
                  disabled={isExporting || myLeads.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {isExporting ? 'Downloading...' : 'Download Excel'}
                </button>
              </div>

              {leadsError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-red-700">
                  <p className="font-semibold">{leadsError}</p>
                  <button type="button" onClick={() => void loadMyLeads()} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white">Retry</button>
                </div>
              ) : isLoadingLeads ? (
                <div className="py-12 text-center text-slate-500">
                  <p>Loading your leads...</p>
                </div>
              ) : displayedLeads.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="text-lg font-medium">No leads yet</p>
                  <p className="text-sm mt-1">Submit a patient form to start tracking your leads.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Patient Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Gender</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Age</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Submitted By</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Files</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Submitted</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLeads.map((lead) => (
                        <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="min-w-48 px-4 py-3 text-sm text-slate-900"><span className="font-semibold">{lead.fullName}</span><span className="mt-1 block text-xs text-slate-500">Father: {lead.fatherName || 'Not provided'}</span><span className="block text-xs text-slate-500">Contact: {lead.contactNumber || 'Not provided'}</span><span className="block max-w-64 whitespace-normal text-xs text-slate-500">Location: {lead.currentLocation || lead.address}</span></td>
                          <td className="px-4 py-3 text-sm text-slate-700">{lead.gender}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{lead.age}</td>
                          <td className="px-4 py-3 text-sm text-slate-700"><span className="font-medium">{lead.submittedByName}</span><span className="block text-xs capitalize text-slate-400">{lead.submittedByRole}</span></td>
                          <td className="px-4 py-3 text-sm text-slate-700">{lead.documents.length}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {new Date(lead.submittedAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[lead.status]}`}>
                              {lead.status}
                            </span>
                            {lead.rejectionReason && <div className="mt-2 max-w-xs rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs leading-5 text-red-800"><strong className="block">Admin message</strong>{lead.rejectionReason}</div>}
                            {lead.status === 'Pending' && lead.statusHistory.length > 0 && <div className="mt-2 max-w-xs rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs leading-5 text-amber-800"><strong className="block">Reopened for review</strong>{lead.statusHistory[0].reason || 'The admin has reopened this lead.'}</div>}
                            <div className="mt-2 text-xs text-slate-500"><strong>Treatment:</strong> {lead.treatmentStatus}<br/><strong>Payment:</strong> {lead.paymentStatus}</div>
                            {user?.isDoctor && <PaymentMethodSelector submission={lead} onUpdated={(updated) => setMyLeads(current => current.map(item => item.id === updated.id ? updated : item))} />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
