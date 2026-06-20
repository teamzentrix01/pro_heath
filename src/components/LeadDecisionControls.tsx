'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { SubmissionStatus, UserSubmission } from '@/types/submissions';

export const LeadDecisionControls = ({ submission, onUpdated }: { submission: UserSubmission; onUpdated: (submission: UserSubmission) => void }) => {
  const [action, setAction] = useState<SubmissionStatus | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const update = async (status: SubmissionStatus) => {
    setSaving(true); setMessage('');
    const response = await apiFetch(`/api/submissions/${submission.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, reason }) });
    const data = await response.json(); setSaving(false);
    if (response.ok) { onUpdated(data.submission); setAction(null); setReason(''); } else setMessage(data.error);
  };
  if (submission.status === 'Pending') return <div className="mt-2 min-w-[13rem] rounded-lg border border-slate-200 bg-white p-2">
    {!action ? <div className="flex gap-2"><button type="button" onClick={() => void update('Approved')} className="flex-1 rounded-md bg-emerald-600 py-1.5 text-xs font-bold text-white">Accept</button><button type="button" onClick={() => setAction('Rejected')} className="flex-1 rounded-md bg-red-50 py-1.5 text-xs font-bold text-red-700">Reject</button></div> : <><textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Mandatory rejection reason" rows={2} className="w-full rounded-md border border-red-200 p-2 text-xs"/><div className="mt-1 flex gap-1"><button type="button" onClick={() => setAction(null)} className="flex-1 rounded-md border py-1 text-xs">Cancel</button><button type="button" disabled={saving || reason.trim().length < 5} onClick={() => void update('Rejected')} className="flex-1 rounded-md bg-red-600 py-1 text-xs font-bold text-white disabled:opacity-40">Confirm</button></div></>}{message && <p className="mt-1 text-xs text-red-600">{message}</p>}
  </div>;
  return <div className="mt-2"><button type="button" onClick={() => setAction(action ? null : 'Pending')} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Reopen</button>{action && <div className="mt-1 min-w-[13rem]"><textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for reopening" rows={2} className="w-full rounded-md border border-amber-200 p-2 text-xs"/><button type="button" disabled={saving || reason.trim().length < 5} onClick={() => void update('Pending')} className="mt-1 w-full rounded-md bg-amber-600 py-1.5 text-xs font-bold text-white disabled:opacity-40">Confirm reopen</button></div>}</div>;
};
