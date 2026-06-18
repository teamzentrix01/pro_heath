'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DocumentUpload } from './DocumentUpload';
import { apiFetch } from '@/lib/api';

const MAX_DOCUMENTS = 5;
const MAX_DOCUMENT_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_DOCUMENT_SIZE_BYTES = 6 * 1024 * 1024;

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
  const [profile, setProfile] = useState({
    fullName: user?.fullName ?? '',
    phoneNumber: user?.phoneNumber ?? '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [formData, setFormData] = useState({
    fullName: '',
    gender: '',
    age: '',
    contactNumber: '',
    reference: '',
  });

  const [documents, setDocuments] = useState<File[]>([]);
  const [documentError, setDocumentError] = useState('');
  const [uploadResetKey, setUploadResetKey] = useState(0);

  const initials = useMemo(() => {
    const label = user?.fullName || user?.email || 'U';
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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'contactNumber' ? value.replace(/\D/g, '').slice(0, 10) : value,
    }));
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');

    if (
      !formData.fullName.trim() ||
      !formData.gender ||
      !formData.age ||
      (formData.contactNumber && !/^\d{10}$/.test(formData.contactNumber)) ||
      !formData.reference.trim()
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
          gender: formData.gender,
          age: parseInt(formData.age),
          contactNumber: formData.contactNumber,
          reference: formData.reference,
          documents: uploadedFiles,
        }),
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      setSuccessMessage('Form submitted successfully. Your documents have been received.');
      setFormData({
        fullName: '',
        gender: '',
        age: '',
        contactNumber: '',
        reference: '',
      });
      setDocuments([]);
      setDocumentError('');
      setUploadResetKey((key) => key + 1);
    } catch {
      alert('Error submitting form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Health track
            </h1>
            <p className="mt-1 text-sm text-slate-500">Healthcare Management System</p>
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
        {/* <section className="mb-6 rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-blue-700">Patient submission</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Submit health details</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Complete the form below and upload any supporting documents for review.
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Signed in as <span className="font-semibold text-slate-900">{user?.email}</span>
            </div>
          </div>
        </section> */}

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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
                  placeholder="Enter your full name"
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
                  placeholder="Enter your age"
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

            <div>
              <label htmlFor="reference" className="mb-2 block text-sm font-semibold text-slate-700">
                Reference <span className="text-red-500">*</span>
              </label>
              <textarea
                id="reference"
                name="reference"
                value={formData.reference}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Enter reference details"
                rows={4}
              />
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
                {isSubmitting ? 'Submitting...' : 'Submit Form'}
              </button>
            </div>
          </form>
        </section>
      </main>

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
    </div>
  );
};
