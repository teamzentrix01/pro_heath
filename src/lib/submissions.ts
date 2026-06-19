import { pool } from '@/lib/db';
import {
  ReferenceAnalyticsRow,
  SubmissionStatus,
  UploadedDocument,
  UserAnalyticsRow,
  UserSubmission,
} from '@/types/submissions';

type SubmissionRow = {
  id: string;
  user_id: string | null;
  submitted_by_email: string | null;
  submitted_by_name: string | null;
  full_name: string;
  gender: string;
  age: number;
  contact_number: string | null;
  reference: string;
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
};

const mapSubmission = (row: SubmissionRow): UserSubmission => ({
  id: row.id,
  userId: row.user_id,
  submittedByEmail: row.submitted_by_email ?? 'Unknown user',
  submittedByName: row.submitted_by_name ?? '',
  fullName: row.full_name,
  gender: row.gender,
  age: row.age,
  contactNumber: row.contact_number,
  reference: row.reference,
  status: row.status,
  rejectionReason: row.rejection_reason,
  adminSeenAt: row.admin_seen_at?.toISOString() ?? null,
  statusUpdatedAt: row.status_updated_at?.toISOString() ?? null,
  statusHistory: row.status_history ?? [],
  documents: row.documents ?? [],
  submittedAt: row.submitted_at.toISOString(),
});

export const createSubmission = async (submission: {
  userId: string;
  fullName: string;
  gender: string;
  age: number;
  contactNumber: string | null;
  reference: string;
  documents: UploadedDocument[];
}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const submissionResult = await client.query<SubmissionRow>(
      `INSERT INTO form_submissions (user_id, full_name, gender, age, contact_number, reference)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         id,
         user_id,
         NULL::text AS submitted_by_email,
         NULL::text AS submitted_by_name,
         full_name,
         gender,
         age,
         contact_number,
         reference,
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
        submission.gender,
        submission.age,
        submission.contactNumber,
        submission.reference,
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
  const result = await pool.query<SubmissionRow>(
    `SELECT
       fs.id,
       fs.user_id,
       au.email AS submitted_by_email,
       au.full_name AS submitted_by_name,
       fs.full_name,
       fs.gender,
       fs.age,
       fs.contact_number,
       fs.reference,
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
     LEFT JOIN submission_documents sd ON sd.submission_id = fs.id
     WHERE fs.id = $1
     GROUP BY fs.id, au.email, au.full_name
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
      OR LOWER(fs.reference) LIKE $${values.length}
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

  const result = await pool.query<SubmissionRow>(
    `SELECT
       fs.id,
       fs.user_id,
       au.email AS submitted_by_email,
       au.full_name AS submitted_by_name,
       fs.full_name,
       fs.gender,
       fs.age,
       fs.contact_number,
       fs.reference,
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
     LEFT JOIN submission_documents sd ON sd.submission_id = fs.id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY fs.id, au.email, au.full_name
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
  const client = await pool.connect();
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
    const isReopen = status === 'Pending' && previousStatus !== 'Pending';
    const isInitialDecision = previousStatus === 'Pending' && status !== 'Pending';
    if (!isReopen && !isInitialDecision) {
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
           reviewed_at = CASE WHEN input.next_status = 'Pending' THEN NULL ELSE NOW() END,
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
    const userResult = await pool.query<{ email: string; full_name: string | null }>(
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
  const result = await pool.query(
    `UPDATE form_submissions SET admin_seen_at = COALESCE(admin_seen_at, NOW())
     WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount !== 0;
};

export const markAllSubmissionsSeen = async () => {
  await pool.query(`UPDATE form_submissions SET admin_seen_at = NOW() WHERE admin_seen_at IS NULL`);
};

export const listSubmissionsByUserId = async (userId: string) => {
  const result = await pool.query<SubmissionRow>(
    `SELECT
       fs.id,
       fs.user_id,
       au.email AS submitted_by_email,
       au.full_name AS submitted_by_name,
       fs.full_name,
       fs.gender,
       fs.age,
       fs.contact_number,
       fs.reference,
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
     LEFT JOIN submission_documents sd ON sd.submission_id = fs.id
     WHERE fs.user_id = $1
     GROUP BY fs.id, au.email, au.full_name
     ORDER BY fs.submitted_at DESC`,
    [userId]
  );

  return result.rows.map(mapSubmission);
};

export const getReferenceAnalytics = async (period: 'weekly' | 'monthly', date: string) => {
  const truncUnit = period === 'weekly' ? 'week' : 'month';
  const result = await pool.query<ReferenceAnalyticsRow>(
    `SELECT
       COALESCE(NULLIF(TRIM(reference), ''), 'Unspecified') AS source,
       COUNT(*)::int AS count
     FROM form_submissions
     WHERE submitted_at >= date_trunc($1, $2::date)
       AND submitted_at < date_trunc($1, $2::date) + $3::interval
     GROUP BY source
     ORDER BY count DESC, source ASC`,
    [truncUnit, date, period === 'weekly' ? '1 week' : '1 month']
  );

  return result.rows;
};

export const getUserSubmissionAnalytics = async (period: 'weekly' | 'monthly', date: string) => {
  const truncUnit = period === 'weekly' ? 'week' : 'month';
  const result = await pool.query<{
    user_id: string | null;
    email: string;
    full_name: string | null;
    count: number;
    pending_count: number;
    approved_count: number;
    rejected_count: number;
  }>(
    `SELECT
       fs.user_id,
       COALESCE(au.email, 'Unknown user') AS email,
       au.full_name,
       COUNT(*)::int AS count,
       COUNT(*) FILTER (WHERE fs.status = 'Pending')::int AS pending_count,
       COUNT(*) FILTER (WHERE fs.status = 'Approved')::int AS approved_count,
       COUNT(*) FILTER (WHERE fs.status = 'Rejected')::int AS rejected_count
     FROM form_submissions fs
     LEFT JOIN app_users au ON au.id = fs.user_id
     WHERE fs.submitted_at >= date_trunc($1, $2::date)
       AND fs.submitted_at < date_trunc($1, $2::date) + $3::interval
     GROUP BY fs.user_id, au.email, au.full_name
     ORDER BY count DESC, email ASC`,
    [truncUnit, date, period === 'weekly' ? '1 week' : '1 month']
  );

  return result.rows.map<UserAnalyticsRow>((row) => ({
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name ?? '',
    count: row.count,
    pendingCount: row.pending_count,
    approvedCount: row.approved_count,
    rejectedCount: row.rejected_count,
  }));
};
