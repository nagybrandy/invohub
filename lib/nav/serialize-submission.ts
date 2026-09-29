// lib/nav/serialize-submission.ts
// API-facing shape of a nav_submission row (routes + UI). Pure — no DB import.

type SubmissionLike = {
  id: string;
  status: string;
  mode: string;
  transactionId: string | null;
  errorMessage: string | null;
};

export type SerializedNavSubmission = {
  submissionId: string;
  status: string;
  mode: string;
  transactionId: string | null;
  errorMessage: string | null;
};

export function serializeNavSubmission(submission: SubmissionLike | null): SerializedNavSubmission | null {
  if (!submission) return null;
  return {
    submissionId: submission.id,
    status: submission.status,
    mode: submission.mode,
    transactionId: submission.transactionId,
    errorMessage: submission.errorMessage,
  };
}
