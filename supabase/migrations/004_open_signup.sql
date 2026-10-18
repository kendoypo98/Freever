-- Open sign-up: anyone can create an account, whether or not their name is in the schedule.
-- Run once in Supabase > SQL editor, after 003_hardening.sql. Safe to run twice.
-- A Student ID or S.A name can still only be used by one account. If the name matches the schedule
-- (ignoring upper/lower case) it is saved with the schedule's spelling so the student's duty days are found.

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
  return 'ok';
end;
$$;
grant execute on function public.check_registration(text, text, text) to anon, authenticated;

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
  else
    select sa_name into canon from public.schedule_entries where lower(sa_name) = lower(nm) limit 1;
    if canon is not null then nm := canon; end if;
  end if;

  insert into public.profiles (id, student_id, sa_name, login_email, role)
  values (new.id, sid, nm, new.email, case when first_user then 'admin' else 'sa' end);
  return new;
end;
$$;
