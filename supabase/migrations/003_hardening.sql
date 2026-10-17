-- FreeVer hardening. Run once in Supabase > SQL editor, after 001_init.sql and 002_labs.sql. Safe to run twice.

create extension if not exists pgcrypto with schema extensions;

-- ---------- admin setup code ----------
-- Without a code anybody who opens a fresh deploy first becomes the admin. Set one BEFORE you publish the site:
--   insert into public.app_config (id, admin_code) values (1, 'choose-a-long-secret')
--   on conflict (id) do update set admin_code = excluded.admin_code;
-- The first account must then type that code on the Create account tab. (No row = old behaviour: first account wins.)
create table if not exists public.app_config (
  id         int primary key default 1 check (id = 1),
  admin_code text not null
);
alter table public.app_config enable row level security;   -- no policies: nobody can read it from the browser

-- Student IDs are matched without regard to upper/lower case (S.A names already were).
do $$ begin
  create unique index if not exists profiles_student_id_ci_key on public.profiles (lower(student_id));
exception when others then
  raise notice 'Skipped the case-insensitive Student ID index: existing IDs differ only by case. Clean them up, then run this file again.';
end $$;

-- ---------- registration pre-check (explains what a bare "500" from sign-up cannot) ----------
create or replace function public.needs_setup() returns boolean
language sql security definer stable set search_path = public as $$
  select not exists (select 1 from public.profiles);
$$;
grant execute on function public.needs_setup() to anon, authenticated;

-- returns: ok | setup_code_required | bad_setup_code | sid_taken | name_taken | not_in_schedule
create or replace function public.check_registration(student_id text, sa_name text, admin_code text default '')
returns text language plpgsql security definer stable set search_path = public as $$
declare
  sid text := trim(coalesce(student_id, ''));
  nm  text := trim(coalesce(sa_name, ''));
  cfg text;
begin
  if not exists (select 1 from public.profiles) then
    select c.admin_code into cfg from public.app_config c where c.id = 1;
    if cfg is not null and trim(coalesce(check_registration.admin_code, '')) = '' then return 'setup_code_required'; end if;
    if cfg is not null and trim(check_registration.admin_code) <> cfg then return 'bad_setup_code'; end if;
    return 'ok';
  end if;
  if exists (select 1 from public.profiles p where lower(p.student_id) = lower(sid)) then return 'sid_taken'; end if;
  if exists (select 1 from public.profiles p where lower(p.sa_name) = lower(nm)) then return 'name_taken'; end if;
  if exists (select 1 from public.schedule_entries)
     and not exists (select 1 from public.schedule_entries e where lower(e.sa_name) = lower(nm)) then
    return 'not_in_schedule';
  end if;
  return 'ok';
end;
$$;
grant execute on function public.check_registration(text, text, text) to anon, authenticated;

-- ---------- login lookup that does not reveal which accounts exist ----------
create or replace function public.resolve_login(identifier text) returns text
language sql security definer stable set search_path = public as $$
  select coalesce(
    (select login_email from public.profiles
      where lower(student_id) = lower(trim(identifier)) or lower(sa_name) = lower(trim(identifier))
      limit 1),
    -- unknown identifier: a harmless fake address, so the caller just sees the usual "wrong ID or password"
    md5(lower(trim(coalesce(identifier, '')))) || '@freever.app');
$$;
grant execute on function public.resolve_login(text) to anon, authenticated;

-- ---------- sign-up trigger: same rules as check_registration, plus the admin code ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sid   text := trim(coalesce(new.raw_user_meta_data ->> 'student_id', ''));
  nm    text := trim(coalesce(new.raw_user_meta_data ->> 'sa_name', ''));
  code  text := trim(coalesce(new.raw_user_meta_data ->> 'admin_code', ''));
  cfg   text;
  first_user boolean;
  canon text;
begin
  if sid = '' or nm = '' then
    raise exception 'Student ID and S.A name are required';
  end if;
  select not exists (select 1 from public.profiles) into first_user;

  if first_user then
    select c.admin_code into cfg from public.app_config c where c.id = 1;
    if cfg is not null and code <> cfg then
      raise exception 'Wrong or missing admin setup code';
    end if;
  elsif exists (select 1 from public.schedule_entries) then
    select sa_name into canon from public.schedule_entries where lower(sa_name) = lower(nm) limit 1;
    if canon is null then
      raise exception 'That S.A name is not in the schedule';
    end if;
    nm := canon;
  end if;

  insert into public.profiles (id, student_id, sa_name, login_email, role)
  values (new.id, sid, nm, new.email, case when first_user then 'admin' else 'sa' end);
  return new;
end;
$$;

-- ---------- admin helps a student who forgot the password ----------
create or replace function public.admin_reset_password(target text, new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Only an admin can reset a password'; end if;
  if length(coalesce(new_password, '')) < 8 then raise exception 'Password must be at least 8 characters'; end if;
  select id into uid from public.profiles
   where lower(student_id) = lower(trim(target)) or lower(sa_name) = lower(trim(target)) limit 1;
  if uid is null then raise exception 'No account matches that Student ID or S.A name'; end if;
  update auth.users set encrypted_password = crypt(new_password, gen_salt('bf')), updated_at = now() where id = uid;
end;
$$;
revoke execute on function public.admin_reset_password(text, text) from public, anon;
grant execute on function public.admin_reset_password(text, text) to authenticated;

-- ---------- AI gate used by the edge function: admins only, shared (not per-instance) rate limit ----------
create table if not exists public.ai_usage (
  id      bigint generated always as identity primary key,
  user_id uuid not null,
  at      timestamptz not null default now()
);
alter table public.ai_usage enable row level security;      -- no policies: only the function below touches it

create or replace function public.ai_gate(per_minute int default 12) returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then return 'forbidden'; end if;
  delete from public.ai_usage where at < now() - interval '1 hour';
  if (select count(*) from public.ai_usage where user_id = auth.uid() and at > now() - interval '1 minute') >= per_minute then
    return 'limited';
  end if;
  insert into public.ai_usage (user_id) values (auth.uid());
  return 'ok';
end;
$$;
revoke execute on function public.ai_gate(int) from public, anon;
grant execute on function public.ai_gate(int) to authenticated;
