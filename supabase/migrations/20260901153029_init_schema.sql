-- Gunita initial schema: profiles, albums, album_members, media.
-- See PLANNING.md §2.3 for the design sketch and CLAUDE.md for the
-- locked-in product decisions this encodes (role hierarchy, storage
-- attribution, 30-day soft delete).
--
-- RLS here is a BASELINE (coarse ownership/membership checks), not the
-- full per-role capability matrix from PRD §4 — enforcing exactly who can
-- rename vs. delete vs. invite is Milestone 3 (TASKS.md) and layers on
-- top of these policies rather than replacing them.

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

create type public.album_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.album_type as enum ('private', 'shared');
create type public.media_kind as enum ('photo', 'video');
create type public.plan_tier as enum ('free', 'paid');

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- App-specific user data. auth.users (managed by Supabase Auth) already
-- holds credentials; this is the "users" table from PLANNING.md §2.3,
-- named `profiles` per Supabase convention so it's clearly a companion
-- table to auth.users rather than a duplicate of it.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan public.plan_tier not null default 'free',
  created_at timestamptz not null default now()
);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  type public.album_type not null default 'private',
  cover_media_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  purge_at timestamptz
);

create table public.album_members (
  album_id uuid not null references public.albums (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.album_role not null,
  created_at timestamptz not null default now(),
  primary key (album_id, user_id)
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  kind public.media_kind not null,
  url text not null,
  thumbnail_url text,
  bytes bigint not null,
  width integer,
  height integer,
  duration_seconds numeric,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  purge_at timestamptz
);

alter table public.albums
  add constraint albums_cover_media_id_fkey
  foreign key (cover_media_id) references public.media (id) on delete set null;

create index albums_owner_id_idx on public.albums (owner_id);
create index album_members_user_id_idx on public.album_members (user_id);
create index media_album_id_idx on public.media (album_id);
create index media_uploader_id_idx on public.media (uploader_id);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------

-- Create a profile row automatically when someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Add the creator as the album's `owner` member automatically. Runs as
-- security definer so it isn't blocked by the album_members insert policy
-- below (which otherwise requires already being the album's owner).
create function public.handle_new_album()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.album_members (album_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_album_created
  after insert on public.albums
  for each row execute function public.handle_new_album();

-- ---------------------------------------------------------------------
-- Helper functions (security definer to avoid RLS self-recursion when
-- a policy on album_members needs to query album_members itself)
-- ---------------------------------------------------------------------

create function public.is_album_member(check_album_id uuid, check_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.album_members
    where album_id = check_album_id and user_id = check_user_id
  );
$$;

-- Not consumed by any policy yet — the full role matrix (PRD §4) is
-- Milestone 3, but the same lookup will drive it, so it lives here now.
create function public.album_role(check_album_id uuid, check_user_id uuid)
returns public.album_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.album_members
  where album_id = check_album_id and user_id = check_user_id;
$$;

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.albums enable row level security;
alter table public.album_members enable row level security;
alter table public.media enable row level security;

-- profiles
create policy "profiles are viewable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are viewable by album co-members"
  on public.profiles for select
  using (
    exists (
      select 1 from public.album_members me
      join public.album_members them on them.album_id = me.album_id
      where me.user_id = auth.uid() and them.user_id = profiles.id
    )
  );

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- albums
create policy "members can view their albums"
  on public.albums for select
  using (public.is_album_member(id, auth.uid()));

create policy "authenticated users can create albums"
  on public.albums for insert
  with check (owner_id = auth.uid());

create policy "members can update albums they belong to"
  on public.albums for update
  using (public.is_album_member(id, auth.uid()));

create policy "only the owner can delete an album"
  on public.albums for delete
  using (owner_id = auth.uid());

-- album_members
create policy "members can view their album's membership"
  on public.album_members for select
  using (public.is_album_member(album_id, auth.uid()));

create policy "owner manages membership"
  on public.album_members for insert
  with check (
    exists (
      select 1 from public.albums
      where albums.id = album_id and albums.owner_id = auth.uid()
    )
  );

create policy "owner updates membership"
  on public.album_members for update
  using (
    exists (
      select 1 from public.albums
      where albums.id = album_id and albums.owner_id = auth.uid()
    )
  );

create policy "owner removes membership, or a member removes themself"
  on public.album_members for delete
  using (
    exists (
      select 1 from public.albums
      where albums.id = album_id and albums.owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );

-- media
create policy "members can view album media"
  on public.media for select
  using (public.is_album_member(album_id, auth.uid()));

create policy "members can upload media"
  on public.media for insert
  with check (
    public.is_album_member(album_id, auth.uid())
    and uploader_id = auth.uid()
  );

create policy "members can edit media in their albums"
  on public.media for update
  using (public.is_album_member(album_id, auth.uid()));

create policy "members can delete media in their albums"
  on public.media for delete
  using (public.is_album_member(album_id, auth.uid()));
