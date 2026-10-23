-- ═══════════════════════════════════════════════════════════════════════════
-- CricPoints Arena — Supabase schema
-- Run this whole file in your Supabase project's SQL Editor.
-- Virtual points only: balances here are play money with no cash value.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tables ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  balance numeric not null default 10000,
  last_bonus_date date,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.bets (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  match_id text not null,
  match_label text not null,
  market text not null check (market in ('match', 'session6', 'session10')),
  selection text not null,
  side text not null check (side in ('back', 'lay')),
  odds numeric not null,
  stake numeric not null,
  liability numeric not null,
  status text not null default 'pending'
    check (status in ('pending', 'won', 'lost', 'refunded', 'cancelled')),
  pnl numeric,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists bets_user_idx on public.bets (user_id, created_at desc);
create index if not exists bets_match_idx on public.bets (match_id, status);

create table if not exists public.casino_plays (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('coin', 'wheel', 'dice')),
  stake numeric not null,
  payout numeric not null,
  detail text not null,
  created_at timestamptz not null default now()
);
create index if not exists casino_plays_user_idx on public.casino_plays (user_id, created_at desc);

-- Admin-created matches are stored as full match JSON payloads.
create table if not exists public.matches (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- Platform-wide settings (single global values — never per-user).
-- 'welcome_points' is THE standard welcome grant: every invite redeems for
-- exactly this amount. There is deliberately no per-invite amount column.
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null
);
insert into public.platform_settings (key, value)
values ('welcome_points', '10000'::jsonb)
on conflict (key) do nothing;

-- Single-use registration invites (registration is invite-only).
create table if not exists public.invites (
  id text primary key,
  code text not null unique,
  created_at timestamptz not null default now(),
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  revoked boolean not null default false
);

-- Invite validation / redemption run as security-definer functions so that
-- logged-out visitors can check a code WITHOUT being able to list invites.
create or replace function public.check_invite(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invites
    where code = p_code and used_by is null and not revoked
  );
$$;

create or replace function public.redeem_invite(p_code text, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.invites
     set used_by = p_user, used_at = now()
   where code = p_code and used_by is null and not revoked;
  return found;
end;
$$;

grant execute on function public.check_invite(text) to anon, authenticated;
grant execute on function public.redeem_invite(text, uuid) to anon, authenticated;

-- ── Auto-create a profile on signup (welcome points = the one global ─────
-- ── platform_settings amount, identical for every account) ───────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wp numeric;
begin
  -- The one global welcome-points setting — identical for every signup.
  select (value #>> '{}')::numeric into wp
    from public.platform_settings
   where key = 'welcome_points';
  insert into public.profiles (id, name, email, balance)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(wp, 10000)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Admin helper + self-promotion guard ────────────────────────────────────
-- is_admin can only be granted from the SQL Editor / service role
-- (where auth.uid() is null). API users can never promote themselves.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_admin
  );
$$;

create or replace function public.guard_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new; -- SQL editor / service role: allowed (this is how you grant admin)
  end if;
  if tg_op = 'INSERT' then
    new.is_admin := false;
  elsif new.is_admin is distinct from old.is_admin and not old.is_admin then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_is_admin on public.profiles;
create trigger profiles_guard_is_admin
  before insert or update on public.profiles
  for each row execute function public.guard_is_admin();

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Demo-grade policies: readable leaderboards, users manage their own rows,
-- admins can update bets (settlement) and matches.
-- NOTE: for a production launch, move all balance movements into Postgres
-- RPC functions / Edge Functions with the service role instead of letting
-- clients write balances directly.

alter table public.profiles enable row level security;
alter table public.bets enable row level security;
alter table public.casino_plays enable row level security;
alter table public.matches enable row level security;
alter table public.platform_settings enable row level security;
alter table public.invites enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists bets_select on public.bets;
create policy bets_select on public.bets
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists bets_insert on public.bets;
create policy bets_insert on public.bets
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists bets_update on public.bets;
create policy bets_update on public.bets
  for update to authenticated using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists casino_select on public.casino_plays;
create policy casino_select on public.casino_plays
  for select to authenticated using (auth.uid() = user_id or public.is_admin());

drop policy if exists casino_insert on public.casino_plays;
create policy casino_insert on public.casino_plays
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
  for select to anon, authenticated using (true);

drop policy if exists matches_write on public.matches;
create policy matches_write on public.matches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Settings are public to read (the welcome amount is shown on the signup
-- page); only admins can change them.
drop policy if exists settings_select on public.platform_settings;
create policy settings_select on public.platform_settings
  for select to anon, authenticated using (true);

drop policy if exists settings_write on public.platform_settings;
create policy settings_write on public.platform_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Invites are admin-managed only. Visitors validate/redeem codes exclusively
-- through the check_invite / redeem_invite functions above — the table
-- itself is never listable by non-admins.
drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Grant yourself admin (run separately, as project owner) ────────────────
-- update public.profiles set is_admin = true where email = 'you@example.com';
