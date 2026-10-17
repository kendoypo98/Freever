-- Laboratory opening windows (when each lab is in use). Run once in Supabase > SQL editor, after 001_init.sql.
create table if not exists public.lab_windows (
  id        bigint generated always as identity primary key,
  lab       text not null default '',
  day       text not null check (day in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  start_min int  not null check (start_min between 0 and 1560),
  end_min   int  not null check (end_min between 1 and 1560),
  check (end_min > start_min)
);
alter table public.lab_windows enable row level security;
create policy "read labs" on public.lab_windows for select to authenticated using (true);

create or replace function public.replace_labs(entries jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can change the laboratory schedule';
  end if;
  delete from public.lab_windows where true;
  insert into public.lab_windows (lab, day, start_min, end_min)
  select coalesce(e ->> 'lab', ''), e ->> 'day', (e ->> 'start_min')::int, (e ->> 'end_min')::int
  from jsonb_array_elements(entries) e;
end;
$$;
revoke execute on function public.replace_labs(jsonb) from public, anon;
grant execute on function public.replace_labs(jsonb) to authenticated;
