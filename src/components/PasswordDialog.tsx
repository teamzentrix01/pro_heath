'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export const PasswordDialog = ({
  targetId,
  targetName,
  mode,
  onClose,
}: {
  targetId?: string;
  targetName: string;
  mode: 'change' | 'reset';
  onClose: () => void;
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (newPassword.length < 8) return setMessage('Use at least 8 characters.');
    if (newPassword !== confirmPassword) return setMessage('Passwords do not match.');
    setSaving(true);
    const response = await apiFetch(mode === 'change' ? '/api/auth/password' : `/api/users/${targetId}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.error || 'Unable to update password.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage('Password updated successfully.');
  };

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4">
    <section className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-xl font-bold text-slate-950">{mode === 'change' ? 'Change password' : 'Reset password'}</h2><p className="mt-1 text-sm text-slate-500">{targetName}</p></div>
        <button type="button" onClick={onClose} aria-label="Close password dialog" className="grid h-9 w-9 place-items-center rounded-lg text-xl text-slate-500 hover:bg-slate-100">×</button>
      </div>
      <form onSubmit={submit} autoComplete="off" className="mt-5 space-y-4">
        {mode === 'change' && <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">Current password</label><input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></div>}
        <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">New password</label><input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></div>
        <div><label className="mb-1.5 block text-sm font-semibold text-slate-700">Confirm password</label><input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></div>
        {message && <p className={`rounded-lg px-3 py-2 text-sm font-semibold ${message.includes('successfully') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{message}</p>}
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Updating...' : 'Update password'}</button></div>
      </form>
    </section>
  </div>;
};
