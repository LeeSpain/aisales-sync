-- Invitations table for admin client invites
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  mobile text,
  channels jsonb not null default '["email"]',
  status text not null default 'pending',
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.invitations enable row level security;

-- Admins can manage invitations
create policy "admins_manage_invitations" on public.invitations
  for all using (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
  );
