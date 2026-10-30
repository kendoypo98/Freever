-- Input validation in the database (the website checks the same rules, but the API can be called directly).
-- Run once in Supabase > SQL editor, after 005_user_lab_scan.sql. Safe to run twice.
--   Any name may register; a name that matches the schedule (ignoring upper/lower case) is saved with the schedule's spelling
--   Student ID: YYYY-NNNNN      S.A name: 3-60 letters (spaces . ' - ( ) allowed)      Room name: at most 60 characters
-- Existing accounts are left alone; the rules apply to new accounts and new laboratory rows.

create or replace function public.check_registration(student_id text, sa_name text, admin_code text default '')
returns text language plpgsql security definer stable set search_path = public as $$
declare
  sid text := trim(coalesce(student_id, ''));
  nm  text := trim(coalesce(sa_name, ''));
  cfg text;
begin
  if sid !~ '^(19|20)[0-9]{2}-[0-9]{5}$' then return 'bad_student_id'; end if;
  if nm !~ '^[[:alpha:] .''’()-]{3,60}$' then return 'bad_name'; end if;
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
  if sid !~ '^(19|20)[0-9]{2}-[0-9]{5}$' then
    raise exception 'Student ID must be in the format YYYY-NNNNN';
  end if;
  if nm !~ '^[[:alpha:] .''’()-]{3,60}$' then
    raise exception 'S.A name: 3-60 letters only';
  end if;
  select not exists (select 1 from public.profiles) into first_user;

  if first_user then
    select c.admin_code into cfg from public.app_config c where c.id = 1;
    if cfg is not null and code <> cfg then
      raise exception 'Wrong or missing admin setup code';
    end if;
  else
    select sa_name into canon from public.schedule_entries where lower(sa_name) = lower(nm) limit 1;
    if canon is not null then nm := canon; end if; -- keep the schedule's spelling when there is a match
  end if;

  insert into public.profiles (id, student_id, sa_name, login_email, role)
  values (new.id, sid, nm, new.email, case when first_user then 'admin' else 'sa' end);
  return new;
end;
$$;

-- laboratory room names: bounded length (not valid = only new rows are checked)
alter table public.lab_windows drop constraint if exists lab_windows_lab_len;
alter table public.lab_windows add constraint lab_windows_lab_len check (char_length(lab) <= 60) not valid;
