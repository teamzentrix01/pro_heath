'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PaymentStatus, TreatmentStatus, UserSubmission } from '@/types/submissions';

export const CareManagement = ({ submission, onUpdated }: { submission: UserSubmission; onUpdated: (submission: UserSubmission) => void }) => {
  const [treatmentStatus, setTreatmentStatus] = useState<TreatmentStatus>(submission.treatmentStatus === 'Not Started' ? 'Admitted' : submission.treatmentStatus);
  const [amount, setAmount] = useState(submission.referralAmount?.toString() ?? '');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(submission.paymentStatus);
  const [transactionReference, setTransactionReference] = useState(submission.transactionReference ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  if (submission.status !== 'Approved') return null;

  const save = async () => {
    setSaving(true); setMessage('');
    const response = await apiFetch(`/api/submissions/${submission.id}/care`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ treatmentStatus, referralAmount: amount, paymentStatus: paymentStatus === 'Not Applicable' || paymentStatus === 'Awaiting Method' ? undefined : paymentStatus, transactionReference }) });
    const data = await response.json(); setSaving(false);
    if (response.ok) { onUpdated(data.submission); setMessage('Care and referral updated.'); } else setMessage(data.error);
  };
  return <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
    <strong className="text-xs uppercase tracking-wide text-blue-700">Care & referral</strong>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <select value={treatmentStatus} onChange={e => setTreatmentStatus(e.target.value as TreatmentStatus)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"><option>Admitted</option><option>Medicine Taken & Patient Left</option><option>Discharged</option></select>
      <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Referral amount ₹" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
      {submission.referralAmount !== null && <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as PaymentStatus)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"><option>Awaiting Method</option><option>Payment Pending</option><option>Processing</option><option>Paid</option><option>Payment Failed</option><option>On Hold</option></select>}
      {['Processing','Paid','Payment Failed'].includes(paymentStatus) && <input value={transactionReference} onChange={e => setTransactionReference(e.target.value)} placeholder="Transaction / UTR" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />}
    </div>
    <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{message}</span><button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Update'}</button></div>
  </div>;
};
