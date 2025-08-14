# Notifications: Setup & SQL (Single Source of Truth)

This file contains complete SQL, cron jobs, and key notes so you can bootstrap the full notifications system quickly or hand it to a new developer.

## 0) Prerequisites
- Supabase project ready
- Expo app configured with expo-notifications
- Edge Functions deployed: `notify`, `schedule-reminders`
- Environment variables set for Edge: `EDGE_FUNCTION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## 1) Core Schema & Functions (run all below in SQL Editor)

```sql
-- Enable extensions (idempotent)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Device registry
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  expo_push_token text,
  platform text check (platform in ('ios','android','web')),
  app_version text,
  locale text,
  timezone text,
  enabled boolean default true,
  last_seen timestamptz default now(),
  unique (user_id, device_id)
);

-- Expand notifications (ensure new columns exist)
alter table public.notifications
  add column if not exists category text,
  add column if not exists read_at timestamptz,
  add column if not exists deeplink text;

-- Preferences
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  booking boolean default true,
  booking_reminders boolean default true,
  waitlist boolean default true,
  offers boolean default true,
  reviews boolean default true,
  loyalty boolean default true,
  marketing boolean default false,
  system boolean default true,
  security boolean default true,
  quiet_hours jsonb default '{"enabled":false,"start":"22:00","end":"07:00"}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger trg_notification_prefs_updated
before update on public.notification_preferences
for each row execute function trigger_set_timestamp();

-- Outbox
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null,
  user_id uuid not null,
  channel text not null check (channel in ('inapp','push','email','sms')),
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  attempts int not null default 0,
  error text,
  created_at timestamptz default now(),
  sent_at timestamptz
);

-- Delivery logs
create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null,
  notification_id uuid not null,
  user_id uuid not null,
  channel text not null,
  provider_id text,
  provider_response jsonb,
  success boolean default false,
  created_at timestamptz default now()
);

-- Preferences sync from privacy (optional; aligns with existing privacy schema if present)
create or replace function public.sync_notification_prefs_from_privacy()
returns trigger language plpgsql as $$
begin
  insert into public.notification_preferences (user_id, booking, booking_reminders, waitlist, offers, reviews, loyalty, marketing, system, security)
  values (new.user_id, true, coalesce(new.push_notifications, true), true, coalesce(new.marketing_emails, true), true, true, coalesce(new.marketing_emails, false), true, true)
  on conflict (user_id) do update set
    booking_reminders = excluded.booking_reminders,
    offers = excluded.offers,
    marketing = excluded.marketing,
    updated_at = now();
  return new;
end;$$;

-- Enqueue function (SECURITY DEFINER)
create or replace function public.enqueue_notification(
  p_user_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_message text,
  p_data jsonb default '{}'::jsonb,
  p_deeplink text default null,
  p_channels text[] default array['inapp','push']
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_notification_id uuid;
  v_pref public.notification_preferences;
  v_channel text;
  v_allowed boolean := true;
begin
  select * into v_pref from public.notification_preferences where user_id = p_user_id;
  if v_pref is null then
    insert into public.notification_preferences(user_id) values (p_user_id)
    on conflict (user_id) do nothing;
    select * into v_pref from public.notification_preferences where user_id = p_user_id;
  end if;

  -- Respect top-level category flags
  v_allowed := case p_category
    when 'booking' then coalesce(v_pref.booking, true)
    when 'waitlist' then coalesce(v_pref.waitlist, true)
    when 'offers' then coalesce(v_pref.offers, true)
    when 'reviews' then coalesce(v_pref.reviews, true)
    when 'loyalty' then coalesce(v_pref.loyalty, true)
    when 'system' then coalesce(v_pref.system, true)
    else true end;
  if not v_allowed then
    return null;
  end if;

  insert into public.notifications(user_id, category, type, title, message, data, deeplink)
  values (p_user_id, p_category, p_type, p_title, p_message, p_data, p_deeplink)
  returning id into v_notification_id;

  foreach v_channel in array p_channels loop
    insert into public.notification_outbox(notification_id, user_id, channel, payload)
    values (v_notification_id, p_user_id, v_channel, jsonb_build_object(
      'title', p_title,
      'message', p_message,
      'data', p_data,
      'deeplink', p_deeplink,
      'category', p_category,
      'type', p_type
    ));
  end loop;

  return v_notification_id;
end$$;

-- Booking triggers (INSERT + UPDATE)
create or replace function public.tg_notify_booking_update()
returns trigger language plpgsql as $$
declare
  v_title text; v_msg text; v_type text; v_data jsonb; v_deeplink text;
begin
  v_deeplink := concat('app://booking/', new.id::text);
  if (tg_op = 'INSERT') then
    if (new.status = 'confirmed') then
      v_title := 'Booking Confirmed'; v_msg := 'Your booking has been confirmed.'; v_type := 'booking_confirmed';
    elsif (new.status = 'pending') then
      v_title := 'Booking Request Submitted'; v_msg := 'Your booking request has been submitted. We will notify you when it\'s confirmed.'; v_type := 'booking_request_submitted';
    end if;
    if v_type is not null then
      v_data := jsonb_build_object('bookingId', new.id, 'restaurantId', new.restaurant_id, 'time', new.booking_time);
      perform public.enqueue_notification(new.user_id, 'booking', v_type, v_title, v_msg, v_data, v_deeplink, array['inapp','push']);
    end if;
  elsif (tg_op = 'UPDATE') then
    if (old.status is distinct from new.status) then
      if (new.status = 'confirmed') then
        v_title := 'Booking Confirmed'; v_msg := 'Your booking has been confirmed.'; v_type := 'booking_confirmed';
      elsif (new.status like 'cancelled%') then
        v_title := 'Booking Cancelled'; v_msg := 'Your booking has been cancelled.'; v_type := 'booking_cancelled';
      elsif (new.status in ('declined_by_restaurant','auto_declined')) then
        v_title := 'Booking Declined'; v_msg := 'The restaurant could not accommodate your request.'; v_type := 'booking_declined';
      end if;
      if v_type is not null then
        v_data := jsonb_build_object('bookingId', new.id, 'restaurantId', new.restaurant_id, 'time', new.booking_time);
        perform public.enqueue_notification(new.user_id, 'booking', v_type, v_title, v_msg, v_data, v_deeplink, array['inapp','push']);
      end if;
    end if;
    if (old.booking_time is distinct from new.booking_time or old.party_size is distinct from new.party_size) then
      v_title := 'Booking Updated'; v_msg := 'Your booking details have changed.'; v_type := 'booking_modified';
      v_data := jsonb_build_object('bookingId', new.id, 'restaurantId', new.restaurant_id, 'oldTime', old.booking_time, 'newTime', new.booking_time, 'oldParty', old.party_size, 'newParty', new.party_size);
      perform public.enqueue_notification(new.user_id, 'booking', v_type, v_title, v_msg, v_data, v_deeplink, array['inapp','push']);
    end if;
  end if;
  return coalesce(new, old);
end$$;

drop trigger if exists trg_notify_booking_update on public.bookings;
create trigger trg_notify_booking_update
after insert or update on public.bookings
for each row execute function public.tg_notify_booking_update();

-- Waitlist triggers
create or replace function public.tg_notify_waitlist_update()
returns trigger language plpgsql as $$
declare v_title text; v_msg text; v_type text; v_data jsonb; v_deeplink text;
begin
  v_deeplink := 'app://waiting-list';
  if (tg_op = 'UPDATE') then
    if (old.status is distinct from new.status) then
      if (new.status = 'notified') then
        v_title := 'Table Available!'; v_msg := 'A table is available in your selected time range.'; v_type := 'waiting_list_available';
      elsif (new.status = 'expired') then
        v_title := 'Waitlist Expired'; v_msg := 'Your waitlist entry has expired.'; v_type := 'waiting_list_expired';
      elsif (new.status = 'booked') then
        v_title := 'Waitlist Converted'; v_msg := 'Your waitlist entry has been converted into a booking!'; v_type := 'waiting_list_converted';
      end if;
      if v_type is not null then
        v_data := jsonb_build_object('entryId', new.id, 'restaurantId', new.restaurant_id, 'desiredDate', new.desired_date, 'timeRange', new.desired_time_range);
        perform public.enqueue_notification(new.user_id, 'waitlist', v_type, v_title, v_msg, v_data, v_deeplink, array['inapp','push']);
      end if;
    end if;
  end if;
  return new;
end$$;

drop trigger if exists trg_notify_waitlist_update on public.waitlist;
create trigger trg_notify_waitlist_update
after update on public.waitlist
for each row execute function public.tg_notify_waitlist_update();

-- Offers triggers
create or replace function public.tg_notify_user_offers()
returns trigger language plpgsql as $$
declare v_title text; v_msg text; v_type text; v_data jsonb;
begin
  if (tg_op = 'INSERT') then
    v_title := 'New Offer Available'; v_msg := 'You have a new promotion you can use.'; v_type := 'offer_assigned';
    v_data := jsonb_build_object('userOfferId', new.id, 'offerId', new.offer_id, 'expiresAt', new.expires_at);
    perform public.enqueue_notification(new.user_id, 'offers', v_type, v_title, v_msg, v_data, 'app://profile/my-rewards', array['inapp','push']);
  elsif (tg_op = 'UPDATE') then
    if (old.used_at is null and new.used_at is not null) then
      v_title := 'Offer Redeemed'; v_msg := 'You redeemed an offer.'; v_type := 'offer_redeemed';
      v_data := jsonb_build_object('userOfferId', new.id, 'offerId', new.offer_id, 'bookingId', new.booking_id);
      perform public.enqueue_notification(new.user_id, 'offers', v_type, v_title, v_msg, v_data, 'app://profile/my-rewards', array['inapp','push']);
    elsif (old.status is distinct from new.status and new.status = 'expired') then
      v_title := 'Offer Expired'; v_msg := 'One of your offers has expired.'; v_type := 'offer_expired';
      v_data := jsonb_build_object('userOfferId', new.id, 'offerId', new.offer_id);
      perform public.enqueue_notification(new.user_id, 'offers', v_type, v_title, v_msg, v_data, 'app://profile/my-rewards', array['inapp']);
    end if;
  end if;
  return coalesce(new, old);
end$$;

drop trigger if exists trg_notify_user_offers on public.user_offers;
create trigger trg_notify_user_offers
after insert or update on public.user_offers
for each row execute function public.tg_notify_user_offers();

-- Reviews: restaurant responses
create or replace function public.tg_notify_review_response()
returns trigger language plpgsql as $$
declare v_title text; v_msg text; v_type text; v_data jsonb;
begin
  v_title := 'Restaurant Responded to Your Review'; v_msg := 'A restaurant has replied to your review.'; v_type := 'review_response';
  select jsonb_build_object('reviewId', new.review_id, 'restaurantId', new.restaurant_id) into v_data;
  perform public.enqueue_notification((select user_id from public.reviews where id = new.review_id), 'reviews', v_type, v_title, v_msg, v_data, 'app://profile/reviews', array['inapp','push']);
  return new;
end$$;

drop trigger if exists trg_notify_review_response on public.review_replies;
create trigger trg_notify_review_response
after insert on public.review_replies
for each row execute function public.tg_notify_review_response();

-- Loyalty: activity
create or replace function public.tg_notify_loyalty_activity()
returns trigger language plpgsql as $$
declare v_title text; v_msg text; v_type text := 'loyalty_points'; v_data jsonb;
begin
  v_title := 'Loyalty Points Update'; v_msg := 'Your loyalty balance has changed.';
  v_data := jsonb_build_object('activityId', new.id, 'points', new.points_earned, 'activityType', new.activity_type);
  perform public.enqueue_notification(new.user_id, 'loyalty', v_type, v_title, v_msg, v_data, 'app://profile/loyalty', array['inapp','push']);
  return new;
end$$;

drop trigger if exists trg_notify_loyalty_activity on public.loyalty_activities;
create trigger trg_notify_loyalty_activity
after insert on public.loyalty_activities
for each row execute function public.tg_notify_loyalty_activity();

-- Reminders: 24h, 2h, 1h
create or replace function public.enqueue_booking_reminders()
returns void language plpgsql as $$
declare r record; v_title text; v_msg text; v_data jsonb; v_deeplink text;
begin
  for r in select b.* from public.bookings b where b.status='confirmed'
    and b.booking_time between now() + interval '23 hours' and now() + interval '25 hours' loop
    v_title:='Upcoming Booking (Tomorrow)'; v_msg:='Reminder: You have a booking tomorrow.';
    v_deeplink:=concat('app://booking/', r.id::text); v_data:=jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    perform public.enqueue_notification(r.user_id,'booking','booking_reminder',v_title,v_msg,v_data,v_deeplink,array['inapp','push']);
  end loop;

  for r in select b.* from public.bookings b where b.status='confirmed'
    and b.booking_time between now() + interval '110 minutes' and now() + interval '130 minutes' loop
    v_title:='Upcoming Booking (2 hours)'; v_msg:='Reminder: Your booking is in about 2 hours.';
    v_deeplink:=concat('app://booking/', r.id::text); v_data:=jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    perform public.enqueue_notification(r.user_id,'booking','booking_reminder',v_title,v_msg,v_data,v_deeplink,array['inapp','push']);
  end loop;

  for r in select b.* from public.bookings b where b.status='confirmed'
    and b.booking_time between now() + interval '50 minutes' and now() + interval '70 minutes' loop
    v_title:='Upcoming Booking (1 hour)'; v_msg:='Reminder: Your booking is in about 1 hour.';
    v_deeplink:=concat('app://booking/', r.id::text); v_data:=jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    perform public.enqueue_notification(r.user_id,'booking','booking_reminder',v_title,v_msg,v_data,v_deeplink,array['inapp','push']);
  end loop;
end$$;
```

## 2) Security & Grants

```sql
-- Make enqueue available to authenticated
grant execute on function public.enqueue_notification(uuid, text, text, text, text, jsonb, text, text[]) to authenticated;

-- Optional: restrict internal tables
alter table public.notification_outbox enable row level security;
alter table public.notification_delivery_logs enable row level security;
create policy admin_only_outbox on public.notification_outbox for all to authenticated using (false) with check (false);
create policy admin_only_delivery_logs on public.notification_delivery_logs for all to authenticated using (false) with check (false);
```

## 3) Scheduler (pg_cron + pg_net)

```sql
-- Store EDGE_FUNCTION_SECRET privately
create schema if not exists private;
create table if not exists private.secrets (key text primary key, value text not null);
insert into private.secrets(key, value)
values ('EDGE_FUNCTION_SECRET', 'YOUR_EDGE_FUNCTION_SECRET_HERE')
on conflict (key) do update set value = excluded.value;

-- HTTP helper
create or replace function public._http_post_edge(path text)
returns void language plpgsql security definer as $$
declare v_secret text; v_url text;
begin
  select value into v_secret from private.secrets where key = 'EDGE_FUNCTION_SECRET';
  if v_secret is null then raise exception 'EDGE_FUNCTION_SECRET not set'; end if;
  v_url := 'https://xsovqvbigdettnpeisjs.functions.supabase.co/' || path;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization','Bearer '||v_secret,'Content-Type','application/json'),
    body := '{}'::jsonb
  );
end$$;

-- Wrappers
create or replace function public.run_notify() returns void language sql security definer as $$
  select public._http_post_edge('notify');
$$;
create or replace function public.run_schedule_reminders() returns void language sql security definer as $$
  select public._http_post_edge('schedule-reminders');
$$;

-- Clean old jobs and schedule new
do $$
begin
  if exists (select 1 from cron.job where jobname = 'notify_every_minute') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'notify_every_minute';
  end if;
  if exists (select 1 from cron.job where jobname = 'reminders_hourly') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'reminders_hourly';
  end if;
  if exists (select 1 from cron.job where jobname = 'reminders_every_5_minutes') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'reminders_every_5_minutes';
  end if;
end $$;

select cron.schedule('notify_every_minute', '* * * * *', $$select public.run_notify();$$);
select cron.schedule('reminders_every_5_minutes', '*/5 * * * *', $$select public.run_schedule_reminders();$$);
```

## 4) Edge Functions (Deno) – References

- `supabase/functions/notify/index.ts` – drains outbox, sends push via Expo Push API, writes to delivery logs
- `supabase/functions/schedule-reminders/index.ts` – calls DB reminders RPCs

Ensure both have the Authorization check using EDGE_FUNCTION_SECRET and your environment variables set in project settings.

## 5) Client Integration – References

- lib/notifications/setup.ts – push registration and handlers
- app/_layout.tsx – initialize notifications + device registration
- app/(protected)/profile/notifications.tsx – Notification Center with buttons:
  - Send test notification
  - Process outbox now
- hooks/useNotificationsBadge.ts – real-time unread badge

## 6) Validation Cheatsheet

```sql
-- Outbox activity
select id, channel, status, attempts, error, sent_at
from public.notification_outbox
order by created_at desc
limit 50;

-- Delivery results
select * from public.notification_delivery_logs
order by created_at desc
limit 50;

-- Booking notifications
select * from public.notifications
where category='booking'
order by created_at desc
limit 50;

-- Scheduled jobs
select jobid, jobname, schedule from cron.job order by jobid;
```

## 7) Operational Notes
- Keep notify every 1–5 minutes; schedule-reminders every 5 minutes
- You can extend reminder windows or add a 30-minute reminder easily (copy pattern in enqueue_booking_reminders)
- Email/SMS channels are stubbed; plug in providers inside notify when ready
- Quiet hours can be enforced in either enqueue_notification or at delivery time in notify

This document + SQL is the single source of truth. Share this file with any new developer and they’ll have everything needed to understand and continue the work.

