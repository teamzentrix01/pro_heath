'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PaymentMethod, UserSubmission } from '@/types/submissions';

export const PaymentMethodSelector = ({ submission, onUpdated }: { submission: UserSubmission; onUpdated: (submission: UserSubmission) => void }) => {
  const [method, setMethod] = useState<PaymentMethod>(submission.paymentMethod ?? 'UPI');
  const [upiId, setUpiId] = useState(submission.paymentDetails.upiId ?? '');
  const [accountNumber, setAccountNumber] = useState(submission.paymentDetails.accountNumber ?? '');
  const [ifsc, setIfsc] = useState(submission.paymentDetails.ifsc ?? '');
  const [saving, setSaving] = useState(false);
  if (!submission.referralAmount || submission.paymentStatus === 'Paid') return null;
  const save = async () => { setSaving(true); const response = await apiFetch(`/api/submissions/${submission.id}/payment-method`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, details: { upiId, accountNumber, ifsc } }) }); const data = await response.json(); setSaving(false); if (response.ok) onUpdated(data.submission); };
  return <div className="mt-2 min-w-[14rem] rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs">
    <strong className="block text-emerald-800">Referral: ₹{submission.referralAmount.toLocaleString('en-IN')}</strong>
    <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} className="mt-2 w-full rounded-md border border-emerald-200 bg-white px-2 py-1.5"><option>UPI</option><option>Cash</option><option>Bank Transfer</option></select>
    {method === 'UPI' && <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="UPI ID" className="mt-2 w-full rounded-md border border-emerald-200 px-2 py-1.5" />}
    {method === 'Bank Transfer' && <div className="mt-2 grid gap-1"><input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Account number" className="rounded-md border border-emerald-200 px-2 py-1.5" /><input value={ifsc} onChange={e => setIfsc(e.target.value)} placeholder="IFSC" className="rounded-md border border-emerald-200 px-2 py-1.5" /></div>}
    <button type="button" disabled={saving} onClick={() => void save()} className="mt-2 w-full rounded-md bg-emerald-600 py-1.5 font-bold text-white">{saving ? 'Saving…' : 'Save payment method'}</button>
  </div>;
};
