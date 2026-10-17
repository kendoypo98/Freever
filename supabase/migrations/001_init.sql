-- FreeVer database. Paste this whole file into Supabase > SQL editor > Run.

-- ---------- tables ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  student_id  text not null unique,
  sa_name     text not null,
  login_email text not null,
  role        text not null default 'sa' check (role in ('sa', 'admin')),
  created_at  timestamptz not null default now()
);
create unique index if not exists profiles_sa_name_key on public.profiles (lower(sa_name));

-- exactly one row: who uploaded the current schedule and how the columns were read
create table if not exists public.schedule_meta (
  id             int primary key default 1 check (id = 1),
  uploaded_by    uuid references auth.users(id),
  uploaded_at    timestamptz not null default now(),
  first_is_right boolean not null default true
);

create table if not exists public.schedule_entries (
  id        bigint generated always as identity primary key,
  sa_name   text not null,
  team      text not null default '',
  day       text not null check (day in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  start_min int  not null check (start_min between 0 and 1560),
  end_min   int  not null check (end_min between 1 and 1560),
  type      text not null check (type in ('duty', 'class')),
  office    text not null default '',
  check (end_min > start_min)
);
create index if not exists schedule_entries_name_idx on public.schedule_entries (lower(sa_name));

-- ---------- helpers ----------
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Login by Student ID or S.A name: returns only the opaque login e-mail (a random uuid), never the ID.
create or replace function public.resolve_login(identifier text) returns text
language sql security definer stable set search_path = public as $$
  select login_email from public.profiles
  where student_id = trim(identifier) or lower(sa_name) = lower(trim(identifier))
  limit 1;
$$;
grant execute on function public.resolve_login(text) to anon, authenticated;

-- Create the profile when an account is created. The very first account becomes the admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sid   text := trim(coalesce(new.raw_user_meta_data ->> 'student_id', ''));
  nm    text := trim(coalesce(new.raw_user_meta_data ->> 'sa_name', ''));
  first_user boolean;
  canon text;
begin
  if sid = '' or nm = '' then
    raise exception 'Student ID and S.A name are required';
  end if;
  select not exists (select 1 from public.profiles) into first_user;

  -- once a schedule exists, only names that are in it may register (and we keep the schedule's spelling)
  if not first_user and exists (select 1 from public.schedule_entries) then
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
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomic admin-only replace of the whole schedule.
create or replace function public.replace_schedule(entries jsonb, first_is_right boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change the schedule';
  end if;
  delete from public.schedule_entries where true;
  insert into public.schedule_entries (sa_name, team, day, start_min, end_min, type, office)
  select e ->> 'sa_name', coalesce(e ->> 'team', ''), e ->> 'day',
         (e ->> 'start_min')::int, (e ->> 'end_min')::int, e ->> 'type', coalesce(e ->> 'office', '')
  from jsonb_array_elements(entries) e;
  insert into public.schedule_meta (id, uploaded_by, uploaded_at, first_is_right)
  values (1, auth.uid(), now(), first_is_right)
  on conflict (id) do update
    set uploaded_by = excluded.uploaded_by, uploaded_at = excluded.uploaded_at, first_is_right = excluded.first_is_right;
end;
$$;
revoke execute on function public.replace_schedule(jsonb, boolean) from public, anon;
grant execute on function public.replace_schedule(jsonb, boolean) to authenticated;

-- ---------- row level security ----------
alter table public.profiles         enable row level security;
alter table public.schedule_meta    enable row level security;
alter table public.schedule_entries enable row level security;

-- everyone logged in can read the schedule (needed to work out who is free); nobody can write directly
create policy "read schedule"  on public.schedule_entries for select to authenticated using (true);
create policy "read meta"      on public.schedule_meta    for select to authenticated using (true);
-- a user sees only their own profile (admins see all); no direct writes
create policy "read own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
