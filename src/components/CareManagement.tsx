'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PaymentStatus, TreatmentStatus, UserSubmission } from '@/types/submissions';

export const CareManagement = ({ submission, onUpdated, compact = false }: { submission: UserSubmission; onUpdated: (submission: UserSubmission) => void; compact?: boolean }) => {
  const [treatmentStatus, setTreatmentStatus] = useState<TreatmentStatus>(submission.treatmentStatus === 'Not Started' ? 'Admitted' : submission.treatmentStatus);
  const [amount, setAmount] = useState(submission.referralAmount?.toString() ?? '');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(submission.paymentStatus);
  const [transactionReference, setTransactionReference] = useState(submission.transactionReference ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setTreatmentStatus(submission.treatmentStatus === 'Not Started' ? 'Admitted' : submission.treatmentStatus);
    setAmount(submission.referralAmount?.toString() ?? '');
    setPaymentStatus(submission.paymentStatus);
    setTransactionReference(submission.transactionReference ?? '');
  }, [submission]);
  if (submission.status !== 'Approved') return null;

  const save = async () => {
    setSaving(true); setMessage('');
    const response = await apiFetch(`/api/submissions/${submission.id}/care`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ treatmentStatus, referralAmount: amount, paymentStatus: paymentStatus === 'Not Applicable' || paymentStatus === 'Awaiting Method' ? undefined : paymentStatus, transactionReference }) });
    const data = await response.json(); setSaving(false);
    if (response.ok) { onUpdated(data.submission); setMessage('Care and referral updated.'); } else setMessage(data.error);
  };
  if (compact) return <div className="min-w-[13rem] space-y-2">
    <select aria-label={`Treatment status for ${submission.fullName}`} value={treatmentStatus} onChange={e => setTreatmentStatus(e.target.value as TreatmentStatus)} className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-800">
      <option value="Admitted">1. Admitted</option>
      <option value="Medicine Taken & Patient Left">2. Patient went after medicine</option>
      <option value="Discharged">3. Discharged</option>
    </select>
    <div className="flex gap-1.5">
      <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Referral amount" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
      <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Update'}</button>
    </div>
    {message && <p className={`text-[11px] ${message.includes('updated') ? 'text-emerald-600' : 'text-red-600'}`}>{message}</p>}
  </div>;
  return <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
    <strong className="text-xs uppercase tracking-wide text-blue-700">Care & referral</strong>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <select value={treatmentStatus} onChange={e => setTreatmentStatus(e.target.value as TreatmentStatus)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"><option value="Admitted">1. Admitted</option><option value="Medicine Taken & Patient Left">2. Patient went after medicine</option><option value="Discharged">3. Discharged</option></select>
      <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Referral amount ₹" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
      {submission.referralAmount !== null && <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as PaymentStatus)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"><option>Awaiting Method</option><option>Payment Pending</option><option>Processing</option><option>Paid</option><option>Payment Failed</option><option>On Hold</option></select>}
      {['Processing','Paid','Payment Failed'].includes(paymentStatus) && <input value={transactionReference} onChange={e => setTransactionReference(e.target.value)} placeholder="Transaction / UTR" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />}
    </div>
    <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{message}</span><button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Update'}</button></div>
  </div>;
};
