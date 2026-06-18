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

export const updateSubmissionStatus = async (id: string, status: SubmissionStatus) => {
  const result = await pool.query(
    `UPDATE form_submissions
     SET status = $1, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $2
     RETURNING id`,
    [status, id]
  );

  if (result.rowCount === 0) return null;
  return getSubmissionById(id);
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
