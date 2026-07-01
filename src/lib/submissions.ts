import { dbQuery, getDbClient } from '@/lib/db';
import {
  SubmissionStatus,
  UploadedDocument,
  UserAnalyticsRow,
  UserSubmission,
  PaymentMethod,
  PaymentStatus,
  TreatmentStatus,
  LeadsDetailItem,
} from '@/types/submissions';

type SubmissionRow = {
  id: string;
  user_id: string | null;
  submitted_by_email: string | null;
  submitted_by_name: string | null;
  submitted_by_role: 'admin' | 'pro' | 'doctor';
  parent_pro_id: string | null;
  parent_pro_name: string | null;
  full_name: string;
  father_name: string | null;
  gender: string;
  age: number;
  contact_number: string | null;
  address: string | null;
  current_location: string | null;
  disease: string | null;
  treatment_status: UserSubmission['treatmentStatus'];
  referral_amount: string | null;
  payment_method: UserSubmission['paymentMethod'];
  payment_details: Record<string, string> | null;
  payment_status: UserSubmission['paymentStatus'];
  transaction_reference: string | null;
  paid_at: Date | null;
  status: SubmissionStatus;
  rejection_reason: string | null;
  admin_seen_at: Date | null;
  status_updated_at: Date | null;
  status_history: Array<{
    id: string;
    fromStatus: SubmissionStatus;
    toStatus: SubmissionStatus;
    reason: string | null;
    createdAt: string;
  }> | null;
  submitted_at: Date;
  documents: UploadedDocument[] | null;
  referral_by: string | null;
};

const mapSubmission = (row: SubmissionRow): UserSubmission => ({
  id: row.id,
  userId: row.user_id,
  submittedByEmail: row.submitted_by_email ?? 'Unknown user',
  submittedByName: row.submitted_by_name ?? '',
  submittedByRole: row.submitted_by_role,
  parentProId: row.parent_pro_id,
  parentProName: row.parent_pro_name ?? '',
  fullName: row.full_name,
  fatherName: row.father_name ?? '',
  gender: row.gender,
  age: row.age,
  contactNumber: row.contact_number,
  address: row.address ?? '',
  currentLocation: row.current_location ?? '',
  disease: row.disease ?? '',
  treatmentStatus: row.treatment_status,
  referralAmount: row.referral_amount === null ? null : Number(row.referral_amount),
  paymentMethod: row.payment_method,
  paymentDetails: row.payment_details ?? {},
  paymentStatus: row.payment_status,
  transactionReference: row.transaction_reference,
  paidAt: row.paid_at?.toISOString() ?? null,
  status: row.status,
  rejectionReason: row.rejection_reason,
  adminSeenAt: row.admin_seen_at?.toISOString() ?? null,
  statusUpdatedAt: row.status_updated_at?.toISOString() ?? null,
  statusHistory: row.status_history ?? [],
  documents: row.documents ?? [],
  submittedAt: row.submitted_at.toISOString(),
  referralBy: row.referral_by ?? null,
});

export const createSubmission = async (submission: {
  userId: string;
  fullName: string;
  fatherName?: string | null;
  gender: string;
  age: number;
  contactNumber?: string | null;
  address?: string | null;
  currentLocation?: string | null;
  disease?: string | null;
  referralBy?: string | null;
  documents: UploadedDocument[];
}) => {
  const client = await getDbClient();

  try {
    await client.query('BEGIN');

    const submissionResult = await client.query<SubmissionRow>(
      `INSERT INTO form_submissions (user_id, full_name, father_name, gender, age, contact_number, address, current_location, disease, referral_by, reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '')
       RETURNING
         id,
         user_id,
         NULL::text AS submitted_by_email,
         NULL::text AS submitted_by_name,
         'pro'::text AS submitted_by_role,
         NULL::uuid AS parent_pro_id,
         NULL::text AS parent_pro_name,
         full_name,
         father_name,
         gender,
         age,
         contact_number,
         address,
         current_location,
         disease,
         referral_by,
         treatment_status,
         referral_amount,
         payment_method,
         payment_details,
         payment_status,
         transaction_reference,
         paid_at,
         status,
         NULL::text AS rejection_reason,
         NULL::timestamptz AS admin_seen_at,
         NULL::timestamptz AS status_updated_at,
         '[]'::jsonb AS status_history,
         submitted_at,
         '[]'::jsonb AS documents`,
      [
        submission.userId,
        submission.fullName,
        submission.fatherName ?? null,
        submission.gender,
        submission.age,
        submission.contactNumber ?? null,
        submission.address ?? null,
        submission.currentLocation ?? null,
        submission.disease ?? null,
        submission.referralBy ?? null,
      ]
    );

    const submissionId = submissionResult.rows[0].id;

    for (const document of submission.documents) {
      await client.query(
        `INSERT INTO submission_documents
          (submission_id, file_name, mime_type, file_size, is_image, data_url)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          submissionId,
          document.name,
          document.type ?? null,
          document.size ?? null,
          document.isImage ?? false,
          document.dataUrl ?? null,
        ]
      );
    }

    await client.query('COMMIT');
    return getSubmissionById(submissionId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getSubmissionById = async (id: string) => {
  const result = await dbQuery<SubmissionRow>(
    `SELECT
       fs.id,
       fs.user_id,
       au.email AS submitted_by_email,
       au.full_name AS submitted_by_name,
       au.role AS submitted_by_role,
       COALESCE(au.created_by_user_id, CASE WHEN au.role = 'pro' THEN au.id END) AS parent_pro_id,
       COALESCE(parent_pro.full_name, CASE WHEN au.role = 'pro' THEN au.full_name END) AS parent_pro_name,
       fs.full_name,
       fs.father_name,
       fs.gender,
       fs.age,
       fs.contact_number,
       fs.address,
       fs.current_location,
       fs.disease,
       fs.referral_by,
       fs.treatment_status,
       fs.referral_amount,
       fs.payment_method,
       fs.payment_details,
       fs.payment_status,
       fs.transaction_reference,
       fs.paid_at,
       fs.status,
       fs.rejection_reason,
       fs.admin_seen_at,
       fs.status_updated_at,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'id', sh.id,
           'fromStatus', sh.from_status,
           'toStatus', sh.to_status,
           'reason', sh.reason,
           'createdAt', sh.created_at
         ) ORDER BY sh.created_at DESC)
         FROM submission_status_history sh WHERE sh.submission_id = fs.id
       ), '[]'::jsonb) AS status_history,
       fs.submitted_at,
       COALESCE(
         jsonb_agg(
           jsonb_build_object(
             'id', sd.id,
             'name', sd.file_name,
             'type', sd.mime_type,
             'size', sd.file_size,
             'isImage', sd.is_image,
             'dataUrl', sd.data_url
           )
         ) FILTER (WHERE sd.id IS NOT NULL),
         '[]'::jsonb
       ) AS documents
     FROM form_submissions fs
     LEFT JOIN app_users au ON au.id = fs.user_id
     LEFT JOIN app_users parent_pro ON parent_pro.id = au.created_by_user_id
     LEFT JOIN submission_documents sd ON sd.submission_id = fs.id
     WHERE fs.id = $1
     GROUP BY fs.id, au.id, au.email, au.full_name, au.role, au.created_by_user_id, parent_pro.full_name
     LIMIT 1`,
    [id]
  );

  return result.rows[0] ? mapSubmission(result.rows[0]) : null;
};

export const listSubmissions = async (filters: {
  search?: string;
  date?: string;
  status?: string;
}) => {
  const where: string[] = [];
  const values: string[] = [];

  if (filters.search) {
    values.push(`%${filters.search.toLowerCase()}%`);
    where.push(`(
      LOWER(fs.id::text) LIKE $${values.length}
      OR LOWER(fs.full_name) LIKE $${values.length}
      OR LOWER(fs.gender) LIKE $${values.length}
      OR fs.age::text LIKE $${values.length}
      OR LOWER(COALESCE(fs.contact_number, '')) LIKE $${values.length}
      OR LOWER(COALESCE(fs.father_name, '')) LIKE $${values.length}
      OR LOWER(COALESCE(fs.address, '')) LIKE $${values.length}
      OR LOWER(COALESCE(fs.current_location, '')) LIKE $${values.length}
      OR LOWER(COALESCE(fs.disease, '')) LIKE $${values.length}
      OR LOWER(COALESCE(fs.referral_by, '')) LIKE $${values.length}
      OR LOWER(fs.status) LIKE $${values.length}
      OR LOWER(COALESCE(au.email, '')) LIKE $${values.length}
      OR LOWER(COALESCE(au.full_name, '')) LIKE $${values.length}
      OR EXISTS (
        SELECT 1 FROM submission_documents sd_search
        WHERE sd_search.submission_id = fs.id
        AND LOWER(sd_search.file_name) LIKE $${values.length}
      )
    )`);
  }

  if (filters.date) {
    values.push(filters.date);
    where.push(`fs.submitted_at::date = $${values.length}::date`);
  }

  if (filters.status && filters.status !== 'All') {
    values.push(filters.status);
    where.push(`fs.status = $${values.length}`);
  }

  const result = await dbQuery<SubmissionRow>(
    `SELECT
       fs.id,
       fs.user_id,
       au.email AS submitted_by_email,
       au.full_name AS submitted_by_name,
       au.role AS submitted_by_role,
       COALESCE(au.created_by_user_id, CASE WHEN au.role = 'pro' THEN au.id END) AS parent_pro_id,
       COALESCE(parent_pro.full_name, CASE WHEN au.role = 'pro' THEN au.full_name END) AS parent_pro_name,
       fs.full_name,
       fs.father_name,
       fs.gender,
       fs.age,
       fs.contact_number,
       fs.address,
       fs.current_location,
       fs.disease,
       fs.referral_by,
       fs.treatment_status,
       fs.referral_amount,
       fs.payment_method,
       fs.payment_details,
       fs.payment_status,
       fs.transaction_reference,
       fs.paid_at,
       fs.status,
       fs.rejection_reason,
       fs.admin_seen_at,
       fs.status_updated_at,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'id', sh.id,
           'fromStatus', sh.from_status,
           'toStatus', sh.to_status,
           'reason', sh.reason,
           'createdAt', sh.created_at
         ) ORDER BY sh.created_at DESC)
         FROM submission_status_history sh WHERE sh.submission_id = fs.id
       ), '[]'::jsonb) AS status_history,
       fs.submitted_at,
       COALESCE(
         jsonb_agg(
           jsonb_build_object(
             'id', sd.id,
             'name', sd.file_name,
             'type', sd.mime_type,
             'size', sd.file_size,
             'isImage', sd.is_image,
             'dataUrl', sd.data_url
           )
           ORDER BY sd.created_at
         ) FILTER (WHERE sd.id IS NOT NULL),
         '[]'::jsonb
       ) AS documents
     FROM form_submissions fs
     LEFT JOIN app_users au ON au.id = fs.user_id
     LEFT JOIN app_users parent_pro ON parent_pro.id = au.created_by_user_id
     LEFT JOIN submission_documents sd ON sd.submission_id = fs.id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY fs.id, au.id, au.email, au.full_name, au.role, au.created_by_user_id, parent_pro.full_name
     ORDER BY fs.submitted_at DESC`,
    values
  );

  return result.rows.map(mapSubmission);
};

export const updateSubmissionStatus = async (
  id: string,
  status: SubmissionStatus,
  adminId: string,
  reason: string | null
) => {
  const client = await getDbClient();
  let result;

  try {
    await client.query('BEGIN');
    const current = await client.query<{ status: SubmissionStatus; user_id: string | null }>(
      `SELECT status, user_id FROM form_submissions WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const previousStatus = current.rows[0].status;
    const isInitialDecision = previousStatus === 'Pending' && status !== 'Pending';
    if (!isInitialDecision) {
      await client.query('ROLLBACK');
      return { conflict: true as const, currentStatus: previousStatus };
    }

    result = await client.query(
      `WITH input AS (
         SELECT $1::varchar(20) AS next_status, $2::text AS reason
       )
       UPDATE form_submissions
       SET status = input.next_status,
           rejection_reason = CASE WHEN input.next_status = 'Rejected' THEN input.reason ELSE NULL END,
           reviewed_at = NOW(),
           status_updated_at = NOW(),
           admin_seen_at = COALESCE(admin_seen_at, NOW()),
           updated_at = NOW()
       FROM input
       WHERE id = $3
       RETURNING form_submissions.id, form_submissions.user_id`,
      [status, reason, id]
    );
    await client.query(
      `INSERT INTO submission_status_history
         (submission_id, changed_by, from_status, to_status, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, adminId, previousStatus, status, reason]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (result.rowCount === 0) return null;

  const submission = await getSubmissionById(id);

  // Fetch PRO email for notification
  let proEmail: string | null = null;
  let proName: string | null = null;
  if (result.rows[0].user_id) {
    const userResult = await dbQuery<{ email: string; full_name: string | null }>(
      `SELECT email, full_name FROM app_users WHERE id = $1`,
      [result.rows[0].user_id]
    );
    if (userResult.rows[0]) {
      proEmail = userResult.rows[0].email;
      proName = userResult.rows[0].full_name;
    }
  }

  return { submission, proEmail, proName };
};

export const markSubmissionSeen = async (id: string) => {
  const result = await dbQuery(
    `UPDATE form_submissions SET admin_seen_at = COALESCE(admin_seen_at, NOW())
     WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount !== 0;
};

export const markAllSubmissionsSeen = async () => {
  await dbQuery(`UPDATE form_submissions SET admin_seen_at = NOW() WHERE admin_seen_at IS NULL`);
};

export const canManageSubmission = async (
  submissionId: string,
  userId: string,
  role: 'admin' | 'pro' | 'doctor'
) => {
  if (role === 'admin') return true;
  if (role !== 'pro') return false;
  const result = await dbQuery(
    `SELECT 1
     FROM form_submissions fs
     JOIN app_users submitter ON submitter.id = fs.user_id
     WHERE fs.id = $1 AND (fs.user_id = $2 OR submitter.created_by_user_id = $2)
     LIMIT 1`,
    [submissionId, userId]
  );
  return Boolean(result.rowCount);
};

export const updateSubmissionCare = async (input: {
  id: string;
  changedBy: string;
  treatmentStatus: TreatmentStatus;
  referralAmount: number | null;
  paymentStatus?: PaymentStatus;
  transactionReference?: string | null;
  note?: string | null;
}) => {
  const result = await dbQuery(
    `WITH input AS (
       SELECT
         $1::uuid AS submission_id,
         $2::varchar(40) AS next_treatment_status,
         $3::numeric AS next_referral_amount,
         $4::varchar(40) AS next_payment_status,
         $5::varchar(150) AS next_transaction_reference
     )
     UPDATE form_submissions fs
     SET treatment_status = input.next_treatment_status,
         referral_amount = CASE WHEN submitter.role = 'doctor' THEN input.next_referral_amount ELSE NULL END,
         payment_status = CASE
           WHEN submitter.role <> 'doctor' THEN 'Not Applicable'
           WHEN input.next_payment_status IS NOT NULL THEN input.next_payment_status
           WHEN input.next_referral_amount > 0 AND submitter.role = 'doctor' AND fs.payment_method IS NULL THEN 'Awaiting Method'
           WHEN input.next_referral_amount > 0 AND submitter.role = 'doctor' THEN 'Payment Pending'
           ELSE 'Not Applicable'
         END,
         transaction_reference = CASE WHEN fs.payment_method = 'Cash' THEN NULL ELSE COALESCE(input.next_transaction_reference, transaction_reference) END,
         paid_at = CASE WHEN input.next_payment_status = 'Paid' THEN NOW() ELSE paid_at END,
         payment_updated_at = NOW(),
         updated_at = NOW()
     FROM input,
          app_users submitter
     WHERE fs.id = input.submission_id AND submitter.id = fs.user_id AND fs.status = 'Approved'
     RETURNING fs.id`,
    [input.id, input.treatmentStatus, input.referralAmount, input.paymentStatus ?? null, input.transactionReference ?? null]
  );
  if (!result.rowCount) return null;
  await dbQuery(
    `INSERT INTO submission_payment_history
      (submission_id, changed_by, payment_status, amount, transaction_reference, note)
     SELECT id, $2, payment_status, referral_amount, transaction_reference, $3
     FROM form_submissions WHERE id = $1`,
    [input.id, input.changedBy, input.note ?? null]
  );
  return getSubmissionById(input.id);
};

export const selectSubmissionPaymentMethod = async (input: {
  id: string;
  doctorId: string;
  method: PaymentMethod;
  details: Record<string, string>;
}) => {
  const result = await dbQuery(
    `UPDATE form_submissions fs
     SET payment_method = $3,
         payment_details = $4::jsonb,
         payment_status = 'Payment Pending',
         payment_updated_at = NOW(),
         updated_at = NOW()
     FROM app_users submitter
     WHERE fs.id = $1
       AND fs.user_id = $2
       AND submitter.id = fs.user_id
       AND submitter.role = 'doctor'
       AND COALESCE(fs.referral_amount, 0) > 0
     RETURNING fs.id`,
    [input.id, input.doctorId, input.method, JSON.stringify(input.details)]
  );
  if (!result.rowCount) return null;
  await dbQuery(
    `INSERT INTO submission_payment_history
      (submission_id, changed_by, payment_status, amount, payment_method, note)
     SELECT id, $2, payment_status, referral_amount, payment_method, 'Payment method selected by doctor'
     FROM form_submissions WHERE id = $1`,
    [input.id, input.doctorId]
  );
  return getSubmissionById(input.id);
};

export const listSubmissionsByUserId = async (userId: string, role: 'pro' | 'doctor' | 'admin' = 'doctor') => {
  const result = await dbQuery<SubmissionRow>(
    `SELECT
       fs.id,
       fs.user_id,
       au.email AS submitted_by_email,
       au.full_name AS submitted_by_name,
       au.role AS submitted_by_role,
       COALESCE(au.created_by_user_id, CASE WHEN au.role = 'pro' THEN au.id END) AS parent_pro_id,
       COALESCE(parent_pro.full_name, CASE WHEN au.role = 'pro' THEN au.full_name END) AS parent_pro_name,
       fs.full_name,
       fs.father_name,
       fs.gender,
       fs.age,
       fs.contact_number,
       fs.address,
       fs.current_location,
       fs.disease,
       fs.referral_by,
       fs.treatment_status,
       fs.referral_amount,
       fs.payment_method,
       fs.payment_details,
       fs.payment_status,
       fs.transaction_reference,
       fs.paid_at,
       fs.status,
       fs.rejection_reason,
       fs.admin_seen_at,
       fs.status_updated_at,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'id', sh.id,
           'fromStatus', sh.from_status,
           'toStatus', sh.to_status,
           'reason', sh.reason,
           'createdAt', sh.created_at
         ) ORDER BY sh.created_at DESC)
         FROM submission_status_history sh WHERE sh.submission_id = fs.id
       ), '[]'::jsonb) AS status_history,
       fs.submitted_at,
       COALESCE(
         jsonb_agg(
           jsonb_build_object(
             'id', sd.id,
             'name', sd.file_name,
             'type', sd.mime_type,
             'size', sd.file_size,
             'isImage', sd.is_image,
             'dataUrl', sd.data_url
           )
           ORDER BY sd.created_at
         ) FILTER (WHERE sd.id IS NOT NULL),
         '[]'::jsonb
       ) AS documents
     FROM form_submissions fs
     LEFT JOIN app_users au ON au.id = fs.user_id
     LEFT JOIN app_users parent_pro ON parent_pro.id = au.created_by_user_id
     LEFT JOIN submission_documents sd ON sd.submission_id = fs.id
     WHERE fs.user_id = $1::uuid
        OR (
          $2::text = 'pro'
          AND au.role = 'doctor'
          AND au.created_by_user_id = $1::uuid
        )
     GROUP BY fs.id, au.id, au.email, au.full_name, au.role, au.created_by_user_id, parent_pro.full_name
     ORDER BY fs.submitted_at DESC`,
    [userId, role]
  );

  return result.rows.map(mapSubmission);
};

export const getUserSubmissionAnalytics = async (filters: {
  period: 'weekly' | 'monthly';
  date: string;
  groupBy?: 'pro' | 'doctor';
  minAmount?: number | null;
  maxAmount?: number | null;
  patientName?: string | null;
}) => {
  const truncUnit = filters.period === 'weekly' ? 'week' : 'month';
  const groupBy = filters.groupBy || 'pro';
  
  const whereClauses: string[] = [
    `fs.submitted_at >= date_trunc($1, $2::date)`,
    `fs.submitted_at < date_trunc($1, $2::date) + $3::interval`
  ];
  
  const queryParams: any[] = [
    truncUnit,
    filters.date,
    filters.period === 'weekly' ? '1 week' : '1 month'
  ];

  if (groupBy === 'doctor') {
    whereClauses.push(`au.role = 'doctor'`);
  }

  if (filters.minAmount !== undefined && filters.minAmount !== null) {
    queryParams.push(filters.minAmount);
    whereClauses.push(`fs.referral_amount >= $${queryParams.length}`);
  }

  if (filters.maxAmount !== undefined && filters.maxAmount !== null) {
    queryParams.push(filters.maxAmount);
    whereClauses.push(`fs.referral_amount <= $${queryParams.length}`);
  }

  if (filters.patientName) {
    queryParams.push(`%${filters.patientName.toLowerCase()}%`);
    whereClauses.push(`LOWER(fs.full_name) LIKE $${queryParams.length}`);
  }

  const selectUserExpr = groupBy === 'pro'
    ? `COALESCE(parent_pro.id, au.id)`
    : `au.id`;
    
  const selectEmailExpr = groupBy === 'pro'
    ? `COALESCE(parent_pro.email, au.email, 'Unknown user')`
    : `COALESCE(au.email, 'Unknown user')`;
    
  const selectNameExpr = groupBy === 'pro'
    ? `COALESCE(parent_pro.full_name, au.full_name)`
    : `au.full_name`;

  const sql = `
    SELECT
      ${selectUserExpr} AS user_id,
      ${selectEmailExpr} AS email,
      ${selectNameExpr} AS full_name,
      COUNT(*)::int AS count,
      COUNT(*) FILTER (WHERE fs.status = 'Pending')::int AS pending_count,
      COUNT(*) FILTER (WHERE fs.status = 'Approved')::int AS approved_count,
      COUNT(*) FILTER (WHERE fs.status = 'Rejected')::int AS rejected_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'patientName', fs.full_name,
            'doctorName', CASE WHEN au.role = 'doctor' THEN au.full_name ELSE NULL END,
            'proName', COALESCE(parent_pro.full_name, CASE WHEN au.role = 'pro' THEN au.full_name END),
            'status', fs.status,
            'referralAmount', fs.referral_amount
          )
        ),
        '[]'::jsonb
      ) AS leads_detail
    FROM form_submissions fs
    LEFT JOIN app_users au ON au.id = fs.user_id
    LEFT JOIN app_users parent_pro ON parent_pro.id = au.created_by_user_id
    WHERE ${whereClauses.join(' AND ')}
    GROUP BY ${selectUserExpr}, ${selectEmailExpr}, ${selectNameExpr}
    ORDER BY count DESC, email ASC
  `;

  const result = await dbQuery<{
    user_id: string | null;
    email: string;
    full_name: string | null;
    count: number;
    pending_count: number;
    approved_count: number;
    rejected_count: number;
    leads_detail: LeadsDetailItem[];
  }>(sql, queryParams);

  return result.rows.map<UserAnalyticsRow>((row) => ({
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name ?? '',
    count: row.count,
    pendingCount: row.pending_count,
    approvedCount: row.approved_count,
    rejectedCount: row.rejected_count,
    leadsDetail: row.leads_detail || [],
  }));
};
