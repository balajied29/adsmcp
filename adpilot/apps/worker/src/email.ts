/**
 * Digest delivery via Resend (https://resend.com). Enabled when
 * RESEND_API_KEY is set; otherwise the worker prints to stdout only.
 * Raw fetch — no SDK dependency needed for one endpoint.
 */
import type { AuditResult } from "./audit-agent.js";

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function digestHtml(accountName: string, audit: AuditResult, appUrl: string): string {
  const items = audit.recommendations
    .map((r, i) => {
      const tag = r.action
        ? `<span style="color:#2563eb;font-size:11px">approve in dashboard</span>`
        : r.kind === "observation"
          ? `<span style="color:#a1a1aa;font-size:11px">fyi</span>`
          : `<span style="color:#d97706;font-size:11px">manual</span>`;
      return `<tr><td style="padding:10px 0;border-top:1px solid #e4e4e7;vertical-align:top;color:#a1a1aa;font-size:13px;width:20px">${i + 1}.</td>
<td style="padding:10px 0;border-top:1px solid #e4e4e7">
  <strong style="font-size:14px;color:#18181b">${esc(r.title)}</strong> ${tag}<br/>
  <span style="font-size:13px;color:#52525b;line-height:1.5">${esc(r.rationale)}</span><br/>
  <span style="font-size:12px;color:#059669">${esc(r.estimatedImpact)}</span>
</td></tr>`;
    })
    .join("");

  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <p style="font-size:13px;color:#a1a1aa;margin:0">AdPilot daily audit</p>
  <h1 style="font-size:20px;color:#18181b;margin:4px 0 2px">${esc(accountName)}</h1>
  <p style="font-size:14px;color:#52525b;margin:0 0 16px">Health score: <strong>${audit.score}/100</strong></p>
  <p style="font-size:14px;color:#3f3f46;line-height:1.6">${esc(audit.summary)}</p>
  <table style="width:100%;border-collapse:collapse;margin-top:8px">${items}</table>
  <a href="${appUrl}/dashboard/approvals" style="display:inline-block;margin-top:20px;background:#18181b;color:#fff;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none">Review &amp; approve</a>
  <p style="font-size:11px;color:#a1a1aa;margin-top:24px">Nothing executes without your approval. Budget guardrails always apply.</p>
</div>`;
}

export async function sendDigestEmail(
  to: string,
  accountName: string,
  audit: AuditResult,
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const from = process.env.DIGEST_FROM_EMAIL ?? "AdPilot <digest@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `AdPilot audit — ${accountName}: ${audit.score}/100, ${audit.recommendations.length} recommendation(s)`,
      html: digestHtml(accountName, audit, appUrl),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend rejected the digest (${res.status}): ${body}`);
  }
}
