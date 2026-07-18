import "server-only";
import type { AccountContext } from "@/lib/account";
import type { ExecutableAction } from "@/app/dashboard/chat-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { devMode } from "@/lib/dev";

export type ExecuteResult =
  | { ok: true; message: string }
  | { ok: false; error: string; httpStatus: number };

/**
 * The single execution path for approved actions — chat cards and the
 * approval queue both go through here. Guardrails are enforced at execution
 * time against current Meta state; every attempt lands in the action_log.
 */
export async function executeAction(
  ctx: AccountContext,
  title: string,
  action: ExecutableAction,
  recommendationId?: string | null,
): Promise<ExecuteResult> {
  const log = async (result: "success" | "error", errorMessage?: string) => {
    if (devMode()) return;
    const admin = createAdminClient();
    await admin.from("action_log").insert({
      workspace_id: ctx.userId,
      ad_account_id: ctx.account.id,
      recommendation_id: recommendationId ?? null,
      actor: "user",
      action: action.kind,
      target_object_id: action.objectId,
      payload: { title, ...action } as never,
      result,
      error_message: errorMessage ?? null,
    });
  };

  try {
    if (action.kind === "pause_object" || action.kind === "resume_object") {
      const status = action.kind === "pause_object" ? "PAUSED" : "ACTIVE";
      await ctx.meta.updateStatus(action.objectId, status);
      await log("success");
      return {
        ok: true,
        message:
          status === "PAUSED"
            ? "Paused — it stops spending immediately."
            : "Resumed — delivery restarts after review.",
      };
    }

    // budget_change
    if (!action.budgetType || !action.amount) {
      return { ok: false, error: "budget_change needs budgetType and amount.", httpStatus: 400 };
    }
    const current = await ctx.meta.getBudget(action.objectId);
    const currentAmount = action.budgetType === "daily" ? current.daily : current.lifetime;
    if (currentAmount === undefined) {
      await log("error", `No ${action.budgetType} budget on object`);
      return {
        ok: false,
        error: `"${current.name}" has no ${action.budgetType} budget — it may use the other budget type or a campaign-level budget.`,
        httpStatus: 400,
      };
    }
    // Hard guardrail: approvals never bypass the 5x rule.
    if (action.amount > currentAmount * 5) {
      await log("error", `Guardrail: ${action.amount} > 5x current ${currentAmount}`);
      return {
        ok: false,
        error: `Guardrail: refusing to raise the ${action.budgetType} budget from ${currentAmount} to ${action.amount} (more than 5x). Make changes this large manually in Ads Manager.`,
        httpStatus: 400,
      };
    }
    await ctx.meta.updateBudget(action.objectId, action.budgetType, action.amount);
    await log("success");
    return {
      ok: true,
      message: `Budget updated: ${currentAmount} → ${action.amount} ${ctx.account.currency} (${action.budgetType}).`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed";
    await log("error", message);
    return { ok: false, error: message, httpStatus: 502 };
  }
}
