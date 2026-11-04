-- Glodire Tech database. Paste all of this into Supabase -> SQL Editor -> New query -> Run.
-- Safe to run again: it recreates the rules but keeps your data.

-- ---------- Tables ----------
create table if not exists public.orders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 100),
  contact    text not null check (char_length(contact) between 1 and 100),
  service    text not null check (char_length(service) between 1 and 60),
  message    text not null check (char_length(message) between 1 and 3000),
  status     text not null default 'new' check (status in ('new', 'in-progress', 'done')),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  category    text not null default '' check (char_length(category) <= 60),
  description text not null default '' check (char_length(description) <= 2000),
  link        text not null default '' check (char_length(link) <= 500),
  image       text not null default '' check (char_length(image) <= 1200000), -- resized photo (data URL)
  created_at  timestamptz not null default now()
);

-- ---------- Who counts as staff ----------
-- Must match STAFF_EMAILS in js/supabase-config.js.
-- Staff = signed in, email confirmed, and email on this list.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and lower(u.email) = any (array[
        'gloria@glodiretech.com',
        'divinenamutaawe@gmail.com',
        'irenenairuba23@gmail.com'
      ])
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to anon, authenticated;

-- ---------- Permissions ----------
alter table public.orders   enable row level security;
alter table public.projects enable row level security;

-- Start from nothing, then grant only what is needed.
revoke all on public.orders, public.projects from anon, authenticated;

-- Orders: anyone can PLACE one (only these four fields; status and date are set by the
-- database). Only staff can see, change the status of, or delete orders.
grant insert (name, contact, service, message) on public.orders to anon, authenticated;
grant select, delete on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

drop policy if exists "anyone can place an order" on public.orders;
drop policy if exists "staff read orders"         on public.orders;
drop policy if exists "staff update orders"       on public.orders;
drop policy if exists "staff delete orders"       on public.orders;
create policy "anyone can place an order" on public.orders for insert to anon, authenticated with check (status = 'new');
create policy "staff read orders"         on public.orders for select to authenticated using (public.is_staff());
create policy "staff update orders"       on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff delete orders"       on public.orders for delete to authenticated using (public.is_staff());

-- Projects: everyone can SEE them; only staff can add or remove them.
grant select on public.projects to anon, authenticated;
grant insert (title, category, description, link, image), delete on public.projects to authenticated;

drop policy if exists "everyone sees projects" on public.projects;
drop policy if exists "staff add projects"     on public.projects;
drop policy if exists "staff remove projects"  on public.projects;
create policy "everyone sees projects" on public.projects for select to anon, authenticated using (true);
create policy "staff add projects"     on public.projects for insert to authenticated with check (public.is_staff());
create policy "staff remove projects"  on public.projects for delete to authenticated using (public.is_staff());

-- ---------- Live updates ----------
-- Lets the staff page and website refresh by themselves when something changes.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'projects') then
    alter publication supabase_realtime add table public.projects;
  end if;
end $$;
