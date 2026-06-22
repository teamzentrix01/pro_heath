'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PaymentStatus, TreatmentStatus, UserSubmission } from '@/types/submissions';

export const CareManagement = ({
  submission,
  onUpdated,
  compact = false,
}: {
  submission: UserSubmission;
  onUpdated: (submission: UserSubmission) => void;
  compact?: boolean;
}) => {
  const [treatmentStatus, setTreatmentStatus] = useState<TreatmentStatus>(
    submission.treatmentStatus === 'Not Started' ? 'Admitted' : submission.treatmentStatus
  );
  const [amount, setAmount] = useState(submission.referralAmount?.toString() ?? '');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(submission.paymentStatus);
  const [transactionReference, setTransactionReference] = useState(submission.transactionReference ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setTreatmentStatus(
      submission.treatmentStatus === 'Not Started' ? 'Admitted' : submission.treatmentStatus
    );
    setAmount(submission.referralAmount?.toString() ?? '');
    setPaymentStatus(submission.paymentStatus);
    setTransactionReference(submission.transactionReference ?? '');
    setIsEditing(false);
    setMessage('');
  }, [submission]);

  if (submission.status !== 'Approved') return null;

  const upiId = submission.paymentDetails.upiId?.trim();
  const accountNumber = submission.paymentDetails.accountNumber?.trim();
  const ifsc = submission.paymentDetails.ifsc?.trim();
  const upiPaymentUrl = upiId && submission.referralAmount
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(submission.submittedByName)}&am=${submission.referralAmount}&cu=INR&tn=${encodeURIComponent(`Referral ${submission.id}`)}`
    : null;

  const handleCancel = () => {
    setTreatmentStatus(
      submission.treatmentStatus === 'Not Started' ? 'Admitted' : submission.treatmentStatus
    );
    setAmount(submission.referralAmount?.toString() ?? '');
    setPaymentStatus(submission.paymentStatus);
    setTransactionReference(submission.transactionReference ?? '');
    setIsEditing(false);
    setMessage('');
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    
    // Referral amount is only applicable when status is 'Discharged'
    const nextReferralAmount =
      treatmentStatus === 'Discharged' ? (amount === '' ? null : Number(amount)) : null;

    try {
      const response = await apiFetch(`/api/submissions/${submission.id}/care`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treatmentStatus,
          referralAmount: nextReferralAmount,
          paymentStatus:
            paymentStatus === 'Not Applicable' || paymentStatus === 'Awaiting Method'
              ? undefined
              : paymentStatus,
          transactionReference,
        }),
      });
      const data = await response.json();
      setSaving(false);
      if (response.ok) {
        onUpdated(data.submission);
        setMessage('Care and referral updated.');
        setIsEditing(false);
      } else {
        setMessage(data.error);
      }
    } catch {
      setSaving(false);
      setMessage('An error occurred while updating.');
    }
  };

  if (compact) {
    return (
      <div className="w-full min-w-0 space-y-2 overflow-hidden">
        <select
          aria-label={`Treatment status for ${submission.fullName}`}
          disabled={!isEditing}
          value={treatmentStatus}
          onChange={(e) => setTreatmentStatus(e.target.value as TreatmentStatus)}
          className="block w-full min-w-0 rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 text-[11px] font-bold text-blue-800 disabled:cursor-not-allowed disabled:opacity-85 outline-none"
        >
          <option value="Admitted">Admitted</option>
          <option value="Medicine Taken & Patient Left">Medicine given</option>
          <option value="Discharged">Discharged</option>
        </select>

        {treatmentStatus === 'Discharged' && (
          <input
            type="number"
            min="0"
            step="0.01"
            disabled={!isEditing}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Referral amount"
            className="block w-full min-w-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:bg-gray-100 outline-none"
          />
        )}

        {submission.referralAmount !== null && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] leading-5 text-emerald-900">
            <strong className="block">Payment: {submission.paymentStatus}</strong>
            {submission.paymentMethod ? (
              <>
                <span className="block">Method: {submission.paymentMethod}</span>
                {upiId && <span className="block break-all">UPI: {upiId}</span>}
                {accountNumber && <span className="block break-all">A/C: {accountNumber}</span>}
                {ifsc && <span className="block break-all">IFSC: {ifsc}</span>}
                {upiPaymentUrl && submission.paymentStatus !== 'Paid' && (
                  <a href={upiPaymentUrl} className="mt-1 block rounded-md bg-emerald-600 px-2 py-1 text-center font-bold text-white hover:bg-emerald-700">
                    Pay via UPI
                  </a>
                )}
              </>
            ) : (
              <span className="block text-amber-700">Waiting for doctor payment method</span>
            )}
          </div>
        )}

        {isEditing && submission.paymentMethod && submission.referralAmount !== null && (
          <>
            <select
              aria-label={`Payment status for ${submission.fullName}`}
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
              className="block w-full min-w-0 rounded-lg border border-emerald-300 bg-white px-2 py-1.5 text-[11px] font-semibold outline-none"
            >
              <option>Payment Pending</option>
              <option>Processing</option>
              <option>Paid</option>
              <option>Payment Failed</option>
              <option>On Hold</option>
            </select>
            {['Processing', 'Paid', 'Payment Failed'].includes(paymentStatus) && (
              <input
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                placeholder="Transaction / UTR"
                className="block w-full min-w-0 rounded-lg border border-slate-300 px-2 py-1.5 text-[11px] outline-none"
              />
            )}
          </>
        )}

        <div className="grid grid-cols-1 gap-1.5">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="w-full rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="w-full rounded-lg bg-amber-500 px-2 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-600"
            >
              Update
            </button>
          )}
        </div>
        {message && (
          <p
            className={`text-[11px] font-medium ${
              message.includes('updated') ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
      <strong className="text-xs uppercase tracking-wide text-blue-700">Care & referral</strong>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select
          disabled={!isEditing}
          value={treatmentStatus}
          onChange={(e) => setTreatmentStatus(e.target.value as TreatmentStatus)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs disabled:opacity-85 disabled:cursor-not-allowed outline-none"
        >
          <option value="Admitted">1. Admitted</option>
          <option value="Medicine Taken & Patient Left">2. Patient went after medicine</option>
          <option value="Discharged">3. Discharged</option>
        </select>

        {treatmentStatus === 'Discharged' && (
          <input
            type="number"
            min="0"
            step="0.01"
            disabled={!isEditing}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Referral amount ₹"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:bg-gray-100 disabled:cursor-not-allowed outline-none"
          />
        )}

        {submission.referralAmount !== null && (
          <select
            disabled={!isEditing}
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs disabled:opacity-85 disabled:cursor-not-allowed outline-none"
          >
            <option>Awaiting Method</option>
            <option>Payment Pending</option>
            <option>Processing</option>
            <option>Paid</option>
            <option>Payment Failed</option>
            <option>On Hold</option>
          </select>
        )}

        {['Processing', 'Paid', 'Payment Failed'].includes(paymentStatus) && (
          <input
            disabled={!isEditing}
            value={transactionReference}
            onChange={(e) => setTransactionReference(e.target.value)}
            placeholder="Transaction / UTR"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:bg-gray-100 disabled:cursor-not-allowed outline-none"
          />
        )}
      </div>
      {submission.referralAmount !== null && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3 text-xs leading-5 text-slate-700">
          <strong className="block text-emerald-800">Doctor payment method</strong>
          {submission.paymentMethod ? (
            <>
              <span className="block">Method: {submission.paymentMethod}</span>
              {upiId && <span className="block">UPI ID: {upiId}</span>}
              {accountNumber && <span className="block">Account: {accountNumber}</span>}
              {ifsc && <span className="block">IFSC: {ifsc}</span>}
              {upiPaymentUrl && submission.paymentStatus !== 'Paid' && <a href={upiPaymentUrl} className="mt-2 inline-flex rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white hover:bg-emerald-700">Pay via UPI</a>}
            </>
          ) : (
            <span className="text-amber-700">Waiting for the doctor to select a payment method.</span>
          )}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={`text-xs font-medium ${
            message.includes('updated') ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {message}
        </span>
        <div className="flex gap-1.5">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-blue-700"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-sm"
            >
              Update
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
