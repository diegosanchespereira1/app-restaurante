-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Menu Items Table
create table menu_items (
  id serial primary key,
  name text not null,
  price numeric not null,
  description text,
  category text not null,
  status text default 'Available',
  image text
);

-- Create Tables Table
create table restaurant_tables (
  id serial primary key,
  number text unique not null,
  status text default 'Available'
);

-- Create Orders Table
create table orders (
  id text primary key,
  customer text,
  table_number text, -- Nullable for Takeout/Delivery
  order_type text default 'dine_in', -- 'dine_in', 'takeout', 'delivery'
  total numeric not null,
  status text default 'Pending',
  created_at timestamptz default now(),
  closed_at timestamptz,
  notes text,
  payment_method text
);

-- Create Order Items Table
create table order_items (
  id serial primary key,
  order_id text references orders(id) on delete cascade,
  menu_item_id int references menu_items(id),
  name text not null,
  price numeric not null,
  quantity int not null
);

-- Insert Initial Menu Items
insert into menu_items (name, price, description, category, status, image) values
('Classic Burger', 12.00, 'Beef patty, lettuce, tomato, cheese', 'Burgers', 'Available', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60'),
('Bacon Burger', 14.00, 'Beef patty, bacon, cheese, BBQ sauce', 'Burgers', 'Available', 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=800&auto=format&fit=crop&q=60'),
('Margherita', 15.00, 'Tomato sauce, mozzarella, basil', 'Pizza', 'Available', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&auto=format&fit=crop&q=60'),
('Pepperoni', 17.00, 'Tomato sauce, mozzarella, pepperoni', 'Pizza', 'Available', 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&auto=format&fit=crop&q=60');

-- Insert Initial Tables
insert into restaurant_tables (number, status) values
('T1', 'Available'),
('T2', 'Occupied'),
('T3', 'Available'),
('T4', 'Available'),
('T5', 'Reserved');

-- Create Expenses Table
create table expenses (
  id serial primary key,
  description text not null,
  amount numeric not null,
  category text not null, -- 'Inventory', 'Utilities', 'Salaries', 'Rent', 'Other'
  date date not null,
  created_at timestamptz default now()
);

-- Create User Profiles Table
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text unique,
  full_name text,
  role text not null default 'usuario' check (role in ('admin', 'gerente', 'usuario')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table user_profiles enable row level security;

-- Create policy: Users can read their own profile
create policy "Users can view own profile" on user_profiles
  for select using (auth.uid() = id);

-- Create policy: Users can update their own profile (except role)
-- This policy prevents users from changing their own role
create policy "Users can update own profile" on user_profiles
  for update 
  using (auth.uid() = id)
  with check (
    auth.uid() = id AND 
    role = (select role from user_profiles where id = auth.uid())
  );

-- Create policy: Only admins can insert/update roles
create policy "Admins can manage all profiles" on user_profiles
  for all using (
    exists (
      select 1 from user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Function to prevent non-admins from changing their role
create or replace function public.prevent_role_change()
returns trigger as $$
declare
  current_user_role text;
begin
  -- Get the current user's role
  select role into current_user_role
  from user_profiles
  where id = auth.uid();
  
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
  for each row execute procedure public.prevent_role_change();

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
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to update updated_at on user_profiles
create trigger update_user_profiles_updated_at
  before update on user_profiles
  for each row execute procedure public.update_updated_at_column();
