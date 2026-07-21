/**
 * Dev-mode-only in-memory store bridging the draft-create and approve steps
 * of the broadcast flow, since dev mode has no real Supabase rows to read
 * back. This lets the guardrail checks in lib/wa-execute.ts run against the
 * actual chosen template/audience in dev mode — not just simulate success —
 * so `POST /approve` is genuinely verifiable via curl, the same way the ads
 * lane's 5x guardrail is. Process-local; irrelevant outside `next dev`.
 */
export const devBroadcastDrafts = new Map<
  string,
  { templateId: string; audienceId: string }
>();
