/** Structured blocks the agent can return — the UI renders each as a rich card. */

/** A recommendation the platform can execute directly, through the guardrails. */
export interface ExecutableAction {
  kind: "pause_object" | "resume_object" | "budget_change";
  objectId: string;
  budgetType?: "daily" | "lifetime";
  /** New budget in currency units (budget_change only). */
  amount?: number;
}

export interface AuditAction {
  title: string;
  detail: string;
  /** Absent = manual task (user does it themselves; button just marks it done). */
  action?: ExecutableAction;
}

export interface AuditBlock {
  type: "audit";
  accountName: string;
  /** Row id used to call the execute API. Absent = display-only card. */
  accountRowId?: string;
  channel: string;
  score: number; // 0-100
  fix: string[];
  strong: string[];
  summary: string; // supports **bold**
  biggestProblem: string[]; // paragraphs, support **bold**
  actions: AuditAction[];
}

export interface CampaignBlock {
  type: "campaign";
  intro: string; // supports **bold**
  title: string;
  stats: { label: string; value: string; sub: string }[];
  rows: [string, string][];
  launchHref?: string;
}

export interface TextBlock {
  type: "text";
  text: string; // supports **bold**
}

export type AgentBlock = TextBlock | AuditBlock | CampaignBlock;

export interface ChatMessage {
  role: "user" | "agent";
  blocks: AgentBlock[];
}
