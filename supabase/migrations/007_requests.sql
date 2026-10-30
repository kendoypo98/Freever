-- In-app reliever requests. Run once in Supabase > SQL editor, after 006_validation.sql. Safe to run twice.
-- A student sends a request to the reliever FreeVer picked; the reliever accepts or declines in the app.
-- Nobody can read anybody else's requests: you only ever see requests you sent or received.

create table if not exists public.reliever_requests (
  id             bigint generated always as identity primary key,
  requester_id   uuid not null references auth.users(id) on delete cascade,
  requester_name text not null,
  reliever_id    uuid not null references auth.users(id) on delete cascade,
  reliever_name  text not null,
  day            text not null check (day in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
  on_date        date not null,
  lab            text not null default '' check (char_length(lab) <= 60),
  start_min      int  not null check (start_min between 0 and 1560),
  end_min        int  not null check (end_min between 1 and 1560),
  kind           text not null default 'reliever' check (kind in ('reliever', 'break')), -- break = "please take my duty for a while, we are both on duty"
  status         text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  check (end_min > start_min)
);
alter table public.reliever_requests add column if not exists kind text not null default 'reliever' check (kind in ('reliever', 'break')); -- for projects that ran an earlier version of this file
create index if not exists reliever_requests_reliever_idx  on public.reliever_requests (reliever_id, status);
create index if not exists reliever_requests_requester_idx on public.reliever_requests (requester_id);

alter table public.reliever_requests enable row level security;
drop policy if exists "see own requests" on public.reliever_requests;
create policy "see own requests" on public.reliever_requests for select to authenticated
  using (requester_id = auth.uid() or reliever_id = auth.uid());
-- no insert / update / delete policies: everything goes through the functions below

-- entries: [{ reliever_name, day, on_date, lab, start_min, end_min, kind? }]. Names come from the signed-in account, never from the client.
-- Returns { sent: n, no_account: [reliever names that have no FreeVer account yet] }
create or replace function public.send_requests(entries jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me_id   uuid := auth.uid();
  me_name text;
  e       jsonb;
  k       text;
  rid     uuid;
  rname   text;
  sent    int := 0;
  missing text[] := '{}';
begin
  if me_id is null then raise exception 'Please log in.'; end if;
  select sa_name into me_name from public.profiles where id = me_id;
  if me_name is null then raise exception 'Your account has no profile.'; end if;
  if jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) > 60 then raise exception 'Too many requests at once.'; end if;
  if (select count(*) from public.reliever_requests where requester_id = me_id and status = 'pending') > 150 then
    raise exception 'You have too many open requests. Wait for answers or cancel some.';
  end if;

  for e in select * from jsonb_array_elements(entries) loop
    k := coalesce(nullif(e ->> 'kind', ''), 'reliever');
    if k not in ('reliever', 'break') then continue; end if;
    select id, sa_name into rid, rname from public.profiles where lower(sa_name) = lower(trim(e ->> 'reliever_name')) limit 1;
    if rid is null then
      if not (trim(e ->> 'reliever_name') = any (missing)) then missing := missing || trim(e ->> 'reliever_name'); end if;
      continue;
    end if;
    if rid = me_id then continue; end if;
    if exists (select 1 from public.reliever_requests r
                where r.requester_id = me_id and r.reliever_id = rid and r.on_date = (e ->> 'on_date')::date
                  and r.start_min = (e ->> 'start_min')::int and r.end_min = (e ->> 'end_min')::int
                  and coalesce(r.lab, '') = coalesce(e ->> 'lab', '') and r.kind = k and r.status in ('pending', 'accepted')) then
      continue;
    end if;
    insert into public.reliever_requests (requester_id, requester_name, reliever_id, reliever_name, day, on_date, lab, start_min, end_min, kind)
    values (me_id, me_name, rid, rname, e ->> 'day', (e ->> 'on_date')::date, left(coalesce(e ->> 'lab', ''), 60),
            (e ->> 'start_min')::int, (e ->> 'end_min')::int, k);
    sent := sent + 1;
  end loop;
  return jsonb_build_object('sent', sent, 'no_account', to_jsonb(missing));
end;
$$;
revoke execute on function public.send_requests(jsonb) from public, anon;
grant execute on function public.send_requests(jsonb) to authenticated;

-- the reliever answers
create or replace function public.respond_request(request_id bigint, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.reliever_requests
     set status = case when accept then 'accepted' else 'declined' end, responded_at = now()
   where id = request_id and reliever_id = auth.uid() and status = 'pending';
  if not found then raise exception 'That request is no longer open.'; end if;
end;
$$;
revoke execute on function public.respond_request(bigint, boolean) from public, anon;
grant execute on function public.respond_request(bigint, boolean) to authenticated;

-- the requester withdraws
create or replace function public.cancel_request(request_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.reliever_requests set status = 'cancelled', responded_at = now()
   where id = request_id and requester_id = auth.uid() and status in ('pending', 'accepted');
  if not found then raise exception 'That request can no longer be cancelled.'; end if;
end;
$$;
revoke execute on function public.cancel_request(bigint) from public, anon;
grant execute on function public.cancel_request(bigint) to authenticated;
