-- Trijay: dados privados por usuário. Execute uma vez no SQL Editor.
begin;
create table if not exists public.timesheet_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  document jsonb not null default '{"schemaVersion":1,"projects":[],"entries":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint valid_timesheet_document check (
    document->>'schemaVersion' = '1' and jsonb_typeof(document->'projects') = 'array'
    and jsonb_typeof(document->'entries') = 'array'
  )
);
alter table public.timesheet_workspaces enable row level security;
revoke all on public.timesheet_workspaces from anon, authenticated;
grant select on public.timesheet_workspaces to authenticated;
drop policy if exists own_workspace on public.timesheet_workspaces;
create policy own_workspace on public.timesheet_workspaces for select to authenticated
using (auth.uid() = owner_id and lower(auth.jwt()->>'email') = 'valdemir.franca@trijay.tech');

create or replace function public.save_timesheet(p_document jsonb, p_revision bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_revision bigint;
begin
  if auth.uid() is null or lower(coalesce(auth.jwt()->>'email','')) <> 'valdemir.franca@trijay.tech'
    then raise exception 'Acesso não autorizado'; end if;
  if p_revision = 0 then
    insert into public.timesheet_workspaces(owner_id,document,revision)
      values(auth.uid(),p_document,1) on conflict do nothing returning revision into new_revision;
  else
    update public.timesheet_workspaces set document=p_document,revision=revision+1,updated_at=now()
      where owner_id=auth.uid() and revision=p_revision returning revision into new_revision;
  end if;
  if new_revision is null then raise exception 'CONFLICT: dados alterados em outra sessão; recarregue antes de salvar'; end if;
  return new_revision;
end $$;
revoke all on function public.save_timesheet(jsonb,bigint) from public;
grant execute on function public.save_timesheet(jsonb,bigint) to authenticated;

create table if not exists public.timesheet_automation_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  fingerprint text not null,
  state text not null check(state in ('prepared','confirmed','uncertain')),
  updated_at timestamptz not null default now(),
  primary key(owner_id,entry_id)
);
alter table public.timesheet_automation_receipts enable row level security;
revoke all on public.timesheet_automation_receipts from anon, authenticated;
grant select,insert,update,delete on public.timesheet_automation_receipts to service_role;
grant select,insert,update on public.timesheet_workspaces to service_role;

drop function if exists public.mark_timesheet_sent(uuid,text,jsonb);
create or replace function public.mark_timesheet_sent(p_owner uuid,p_entry_id text,p_expected jsonb,p_projects jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_doc jsonb; new_entries jsonb; matched boolean;
begin
  select document into current_doc from public.timesheet_workspaces where owner_id=p_owner for update;
  if current_doc is null or current_doc->'projects' <> p_projects then return false; end if;
  select exists(select 1 from jsonb_array_elements(current_doc->'entries') e
    where e->>'id'=p_entry_id and e=p_expected) into matched;
  if not matched then return false; end if;
  select jsonb_agg(case when e->>'id'=p_entry_id then
    e || jsonb_build_object('status','sent','updatedAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) else e end)
    into new_entries from jsonb_array_elements(current_doc->'entries') e;
  update public.timesheet_workspaces set document=jsonb_set(current_doc,'{entries}',new_entries),
    revision=revision+1,updated_at=now() where owner_id=p_owner;
  return true;
end $$;
revoke all on function public.mark_timesheet_sent(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.mark_timesheet_sent(uuid,text,jsonb,jsonb) to service_role;
create or replace function public.get_automation_workspace(p_email text)
returns table(owner_id uuid, revision bigint, document jsonb)
language sql security definer set search_path = public
as $$
  select w.owner_id, w.revision, w.document
  from public.timesheet_workspaces w join auth.users u on u.id=w.owner_id
  where lower(u.email)=lower(p_email)
    and lower(p_email)='valdemir.franca@trijay.tech';
$$;
revoke all on function public.get_automation_workspace(text) from public, anon, authenticated;
grant execute on function public.get_automation_workspace(text) to service_role;

commit;
