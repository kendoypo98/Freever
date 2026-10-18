-- Let every signed-in student scan their own laboratory schedule picture (the "labs" AI action).
-- Run once in Supabase > SQL editor, after 004_open_signup.sql. Safe to run twice.
-- The S.A schedule scan and the schedule check stay admin-only (ai_gate from 003).
-- Students get a smaller shared quota so one account cannot use up the free Gemini allowance.
create or replace function public.ai_gate_user(per_minute int default 4, per_hour int default 30) returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'forbidden'; end if;
  delete from public.ai_usage where at < now() - interval '1 hour';
  if (select count(*) from public.ai_usage where user_id = auth.uid() and at > now() - interval '1 minute') >= per_minute
     or (select count(*) from public.ai_usage where user_id = auth.uid()) >= per_hour then
    return 'limited';
  end if;
  insert into public.ai_usage (user_id) values (auth.uid());
  return 'ok';
end;
$$;
revoke execute on function public.ai_gate_user(int, int) from public, anon;
grant execute on function public.ai_gate_user(int, int) to authenticated;
