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
