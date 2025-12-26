-- Migration script for user_profiles table
-- This script will:
-- 1. Create the table if it doesn't exist (with username column)
-- 2. Add username column if table exists but column doesn't
-- 3. Update triggers and functions

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create User Profiles Table if it doesn't exist
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'usuario' check (role in ('admin', 'gerente', 'usuario')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add username column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'user_profiles' 
    and column_name = 'username'
  ) then
    alter table user_profiles add column username text unique;
  end if;
end $$;

-- Enable Row Level Security
alter table user_profiles enable row level security;

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "Users can view own profile" on user_profiles;
drop policy if exists "Users can update own profile" on user_profiles;
drop policy if exists "Admins can manage all profiles" on user_profiles;
drop policy if exists "Users can insert own profile" on user_profiles;

-- Create helper function to check user role (bypasses RLS to avoid recursion)
create or replace function public.get_user_role(user_id uuid)
returns text
language plpgsql
security definer
stable
as $$
declare
  user_role text;
begin
  select role into user_role
  from user_profiles
  where id = user_id;
  
  return coalesce(user_role, 'usuario');
end;
$$;

-- Create policy: Users can read their own profile
create policy "Users can view own profile" on user_profiles
  for select using (auth.uid() = id);

-- Create policy: Users can insert their own profile
create policy "Users can insert own profile" on user_profiles
  for insert with check (auth.uid() = id);

-- Create policy: Users can update their own profile
-- Note: Role change restriction will be handled by trigger or application
create policy "Users can update own profile" on user_profiles
  for update 
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Create policy: Admins can manage all profiles (using function to avoid recursion)
create policy "Admins can manage all profiles" on user_profiles
  for all 
  using (public.get_user_role(auth.uid()) = 'admin')
  with check (public.get_user_role(auth.uid()) = 'admin');

-- Function to automatically create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, username, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', null),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'usuario'  -- Always default to non-privileged role; admin roles must be assigned separately
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Drop existing trigger if it exists
drop trigger if exists update_user_profiles_updated_at on user_profiles;

-- Trigger to update updated_at on user_profiles
create trigger update_user_profiles_updated_at
  before update on user_profiles
  for each row execute function public.update_updated_at_column();

-- Function to prevent non-admins from changing their role
create or replace function public.prevent_role_change()
returns trigger as $$
declare
  current_user_role text;
begin
  -- Get the current user's role, default to non-admin if not found
  select coalesce(role, 'usuario') into current_user_role
  from user_profiles
  where id = auth.uid();
  
  -- If role is null (user not found), default to 'usuario' to prevent bypass
  current_user_role := coalesce(current_user_role, 'usuario');
  
  -- If the role is being changed and the user is not an admin, prevent it
  if old.role is distinct from new.role and current_user_role != 'admin' then
    raise exception 'Only admins can change user roles';
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to prevent non-admin role changes
drop trigger if exists prevent_role_change_trigger on user_profiles;
create trigger prevent_role_change_trigger
  before update on user_profiles
  for each row execute function public.prevent_role_change();

