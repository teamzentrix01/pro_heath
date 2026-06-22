'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { AppUser } from '@/types/users';

export const DoctorManagement = ({ onViewPatients }: { onViewPatients?: (doctorId: string) => void }) => {
  const [doctors, setDoctors] = useState<AppUser[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', password: '' });
  const load = useCallback(async () => {
    const response = await apiFetch('/api/doctors');
    if (response.ok) setDoctors((await response.json()).doctors);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    const response = await apiFetch('/api/doctors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await response.json();
    setSaving(false); setMessage(response.ok ? 'Doctor account created successfully.' : data.error);
    if (response.ok) {
      setForm({ fullName: '', email: '', phoneNumber: '', password: '' });
      setFormResetKey((key) => key + 1);
      void load();
    }
  };

  return <section className="user-form-card mb-6 rounded-2xl border border-white bg-white/80 p-5 shadow-sm sm:p-6">
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><span className="section-kicker">Doctor network</span><h2 className="mt-1 text-xl font-extrabold text-slate-950">Manage doctors</h2><p className="text-sm text-slate-500">Create secure logins for doctors connected to your PRO account.</p></div>
      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{doctors.length} doctors</span>
    </div>
    {message && <p className="mb-4 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700">{message}</p>}
    <form key={formResetKey} onSubmit={submit} autoComplete="off" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <input required autoComplete="off" name={`doctor-name-${formResetKey}`} value={form.fullName} onChange={e => setForm(v => ({ ...v, fullName: e.target.value }))} placeholder="Doctor full name" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
      <input required autoComplete="off" name={`doctor-email-${formResetKey}`} type="email" value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} placeholder="doctor@example.com" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
      <input required autoComplete="off" name={`doctor-phone-${formResetKey}`} inputMode="numeric" maxLength={10} value={form.phoneNumber} onChange={e => setForm(v => ({ ...v, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit phone" className="rounded-xl border border-slate-300 px-4 py-3 text-sm" />
      <div className="flex gap-2"><input required autoComplete="new-password" name={`doctor-password-${formResetKey}`} type="password" minLength={8} value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} placeholder="Temporary password" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm" /><button disabled={saving} className="rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? '…' : 'Add'}</button></div>
    </form>
    {doctors.length > 0 && <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{doctors.map(doctor => <div key={doctor.id} className="rounded-xl border border-slate-200 bg-white p-3"><strong className="block text-sm text-slate-900">Dr. {doctor.fullName}</strong><span className="block truncate text-xs text-slate-500">{doctor.email}</span><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-blue-600">{doctor.submissionCount} patients</span>{doctor.submissionCount > 0 && onViewPatients && <button type="button" onClick={() => onViewPatients(doctor.id)} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100">View patients</button>}</div></div>)}</div>}
  </section>;
};
