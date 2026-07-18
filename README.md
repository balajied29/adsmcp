# AdPilot Workspace

AI media buyer for Meta Ads — two projects in one repo:

| Folder | What it is |
|---|---|
| [`meta-ads-mcp/`](meta-ads-mcp/) | MCP server exposing the Meta Marketing API to Claude (11 tools, safety rails). Works standalone in Claude Code / Claude Desktop — see its README. |
| [`adpilot/`](adpilot/) | The SaaS: Next.js chat dashboard with a live Claude agent, campaign launcher, projections, pixel/CAPI tooling, approval queue with guarded execution, daily audit worker, Stripe scaffold. See [`adpilot/README.md`](adpilot/README.md) for setup and [`adpilot/APP_REVIEW.md`](adpilot/APP_REVIEW.md) for the Meta App Review playbook. |

## Quick start (zero keys — dummy data)

```bash
cd adpilot
npm install
npm run dev:web   # http://localhost:3000 → login → "Continue as dev"
```

## Guardrails (apply everywhere)

1. Guardrails are code, not prompts — deterministic checks the AI cannot override
2. Nothing launches live without an explicit opt-in
3. Budget increases >5x require explicit confirmation
4. Every write against Meta lands in an append-only audit log
5. Tokens are AES-256-GCM encrypted at rest; decryption is server-side only
