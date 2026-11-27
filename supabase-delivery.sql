-- Coffee Break: delivery (customer address + GPS pin, and the rider page)
-- Run this ONCE in Supabase > SQL Editor > New query > Run.
-- It is safe to run again: every step checks first.
--
-- What it does:
--   1. Adds delivery columns to the orders table (address, GPS pin, delivery status).
--   2. Adds a "Delivery available" switch to the settings table.
--   3. Creates set_delivery(), which the order page calls right after place_order().
--      It only works on a brand-new unpaid order and needs the matching reference
--      number AND mobile number, the same way attach_proof() does.
--
-- It does not change place_order(), your row-level-security policies or any
-- existing data. Delivery orders are stored with order_type = 'pickup' and
-- is_delivery = true, so nothing that already reads order_type can break.

alter table public.orders
  add column if not exists is_delivery       boolean not null default false,
  add column if not exists delivery_street   text,
  add column if not exists delivery_barangay text,
  add column if not exists delivery_city     text,
  add column if not exists delivery_postal   text,
  add column if not exists delivery_lat      double precision,
  add column if not exists delivery_lng      double precision,
  add column if not exists delivery_accuracy_m integer,
  add column if not exists delivery_status   text,
  add column if not exists picked_up_at      timestamptz,
  add column if not exists delivered_at      timestamptz;

do $$
begin
  alter table public.orders
    add constraint orders_delivery_status_check
    check (delivery_status is null or delivery_status in ('out_for_delivery', 'delivered'));
exception when duplicate_object then null;
end $$;

alter table public.settings
  add column if not exists delivery_available boolean not null default true;

create or replace function public.set_delivery(
  p_ref        text,
  p_mobile     text,
  p_street     text,
  p_barangay   text,
  p_city       text,
  p_postal     text,
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_accuracy   integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  -- address must be complete (the order page checks this too)
  if coalesce(btrim(p_street), '') = '' or coalesce(btrim(p_barangay), '') = ''
     or coalesce(btrim(p_city), '') = '' or coalesce(p_postal, '') !~ '^[0-9]{4}$' then
    return false;
  end if;

  -- GPS pin is optional, but if it is sent it must be a real coordinate
  if (p_lat is null) <> (p_lng is null) then return false; end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180) then
    return false;
  end if;

  update public.orders
     set is_delivery        = true,
         delivery_street    = left(btrim(p_street), 120),
         delivery_barangay  = left(btrim(p_barangay), 80),
         delivery_city      = left(btrim(p_city), 80),
         delivery_postal    = p_postal,
         delivery_lat       = p_lat,
         delivery_lng       = p_lng,
         delivery_accuracy_m = case when p_lat is null then null else greatest(coalesce(p_accuracy, 0), 0) end
   where ref = p_ref
     and mobile = p_mobile
     and is_delivery = false
     and status = 'awaiting_payment'
     and created_at > now() - interval '15 minutes';

  get diagnostics n = row_count;
  return n = 1;
end;
$$;

revoke all on function public.set_delivery(text, text, text, text, text, text, double precision, double precision, integer) from public;
grant execute on function public.set_delivery(text, text, text, text, text, text, double precision, double precision, integer) to anon, authenticated;

-- make the API see the new function and columns straight away
notify pgrst, 'reload schema';
