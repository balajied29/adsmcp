-- AdPilot schema. Apply in the Supabase SQL editor (or `supabase db push`).
-- Tenancy model: one workspace per user for now (workspace_id = auth.uid()).
-- Tokens are AES-256-GCM encrypted by the app before insert; the service-role
-- key is required to read them (no RLS select on the raw token column path —
-- token access goes through the service client only).

-- ============ meta_connections ============
-- One row per connected Meta identity (a user OAuth grant).
create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users (id) on delete cascade,
  fb_user_id text not null,
  fb_user_name text,
  -- AES-256-GCM ciphertext (base64: iv.ciphertext.tag), never plaintext
  encrypted_token text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, fb_user_id)
);

alter table public.meta_connections enable row level security;

-- Owners can see and delete their connections, but the encrypted token is
-- only ever used server-side; the client app selects safe columns.
create policy "own connections: select" on public.meta_connections
  for select using (auth.uid() = workspace_id);
create policy "own connections: delete" on public.meta_connections
  for delete using (auth.uid() = workspace_id);
-- Inserts/updates happen via the service role (OAuth callback route).

-- ============ ad_accounts ============
-- Ad accounts discovered for a connection; the user picks which to manage.
create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.meta_connections (id) on delete cascade,
  account_id text not null check (account_id ~ '^act_[0-9]+$'),
  name text not null,
  currency text not null,
  status text not null,
  managed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (connection_id, account_id)
);

alter table public.ad_accounts enable row level security;

create policy "own accounts: select" on public.ad_accounts
  for select using (auth.uid() = workspace_id);
create policy "own accounts: update managed flag" on public.ad_accounts
  for update using (auth.uid() = workspace_id);
create policy "own accounts: delete" on public.ad_accounts
  for delete using (auth.uid() = workspace_id);

-- ============ recommendations ============
-- Output of the audit agent (Milestone 2). Status flows:
-- proposed -> approved -> executed | failed, or proposed -> dismissed.
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users (id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  kind text not null check (kind in (
    'pause_object', 'resume_object', 'budget_change', 'creative_refresh', 'observation'
  )),
  title text not null,
  rationale text not null,
  -- Machine-readable action payload, e.g. {"object_id":"...","budget_type":"daily","amount":50}
  action jsonb,
  estimated_impact text,
  status text not null default 'proposed' check (status in (
    'proposed', 'approved', 'dismissed', 'executed', 'failed'
  )),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.recommendations enable row level security;

create policy "own recommendations: select" on public.recommendations
  for select using (auth.uid() = workspace_id);
create policy "own recommendations: update status" on public.recommendations
  for update using (auth.uid() = workspace_id);

-- ============ action_log ============
-- Immutable audit trail of every write the platform performs against Meta.
create table if not exists public.action_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references auth.users (id) on delete cascade,
  ad_account_id uuid references public.ad_accounts (id) on delete set null,
  recommendation_id uuid references public.recommendations (id) on delete set null,
  actor text not null check (actor in ('user', 'agent')),
  action text not null,            -- e.g. 'update_status', 'update_budget'
  target_object_id text not null,  -- Meta object id
  payload jsonb not null,
  result text not null check (result in ('success', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.action_log enable row level security;

create policy "own action log: select" on public.action_log
  for select using (auth.uid() = workspace_id);
-- No update/delete policies: the log is append-only, written by the service role.

-- ============ subscriptions (Stripe) ============
-- One row per workspace; written only by the Stripe webhook (service role).
create table if not exists public.subscriptions (
  workspace_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  plan text not null default 'pro',
  status text not null default 'incomplete',  -- Stripe status: active, trialing, past_due, canceled, ...
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "own subscription: select" on public.subscriptions
  for select using (auth.uid() = workspace_id);
-- No insert/update policies: only the webhook (service role) writes.

-- ============ updated_at trigger ============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists meta_connections_updated_at on public.meta_connections;
create trigger meta_connections_updated_at
  before update on public.meta_connections
  for each row execute function public.set_updated_at();
