-- Run once in Supabase SQL Editor for existing RunTracker projects.
alter table public.profiles add column if not exists height_cm double precision not null default 170;
alter table public.profiles add column if not exists age integer not null default 30;
alter table public.profiles add column if not exists sex text not null default 'unspecified';
alter table public.profiles add column if not exists avatar_data text;

alter table public.activities enable row level security;
alter table public.location_points enable row level security;
alter table public.splits enable row level security;
alter table public.goals enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "activities owner access" on public.activities;
drop policy if exists "points owner access" on public.location_points;
drop policy if exists "splits owner access" on public.splits;
drop policy if exists "goals owner access" on public.goals;
drop policy if exists "profiles owner access" on public.profiles;

create policy "activities owner access" on public.activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "points owner access" on public.location_points for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "splits owner access" on public.splits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals owner access" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles owner access" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.location_points to authenticated;
grant select, insert, update, delete on public.splits to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

notify pgrst, 'reload schema';
