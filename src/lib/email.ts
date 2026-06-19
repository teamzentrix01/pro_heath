import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

const FROM_EMAIL = process.env.EMAIL_FROM || 'PRO HealthTrack <onboarding@resend.dev>';

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  Pending: { bg: '#FEF3C7', text: '#92400E', label: 'Pending Review' },
  Approved: { bg: '#D1FAE5', text: '#065F46', label: 'Approved ✓' },
  Rejected: { bg: '#FEE2E2', text: '#991B1B', label: 'Rejected ✗' },
};

export const sendStatusUpdateEmail = async (
  proEmail: string,
  proName: string | null,
  patientName: string,
  newStatus: string,
  submissionId: string
) => {
  if (!resend) {
    console.warn('RESEND_API_KEY not configured. Skipping email notification.');
    return;
  }

  const statusInfo = statusColors[newStatus] || statusColors.Pending;
  const greeting = proName ? `Hi ${proName}` : 'Hi';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#2563EB,#1D4ED8);padding:28px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">PRO HealthTrack</h1>
          <p style="margin:6px 0 0;color:#BFDBFE;font-size:13px;">Lead Status Update</p>
        </div>
        
        <!-- Body -->
        <div style="padding:28px 32px;">
          <p style="margin:0 0 20px;color:#1F2937;font-size:15px;line-height:1.6;">
            ${greeting},<br><br>
            Your referred patient's lead status has been updated:
          </p>
          
          <!-- Status Card -->
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;color:#6B7280;font-size:13px;font-weight:600;">Patient Name</td>
                <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">${patientName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6B7280;font-size:13px;font-weight:600;">Status</td>
                <td style="padding:6px 0;text-align:right;">
                  <span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;background:${statusInfo.bg};color:${statusInfo.text};">
                    ${statusInfo.label}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6B7280;font-size:13px;font-weight:600;">Submission ID</td>
                <td style="padding:6px 0;color:#6B7280;font-size:11px;text-align:right;word-break:break-all;">${submissionId}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#6B7280;font-size:13px;font-weight:600;">Updated At</td>
                <td style="padding:6px 0;color:#111827;font-size:13px;text-align:right;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
              </tr>
            </table>
          </div>
          
          <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.5;">
            Log in to your PRO HealthTrack dashboard to view full details of your leads.
          </p>
        </div>
        
        <!-- Footer -->
        <div style="border-top:1px solid #E5E7EB;padding:20px 32px;background:#F9FAFB;">
          <p style="margin:0;color:#9CA3AF;font-size:11px;text-align:center;">
            This is an automated notification from PRO HealthTrack. Please do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: proEmail,
      subject: `Lead Status Update: ${patientName} — ${statusInfo.label}`,
      html,
    });
    console.log(`Status email sent to ${proEmail} for submission ${submissionId}`);
  } catch (error) {
    console.error('Failed to send status update email:', error);
  }
};
