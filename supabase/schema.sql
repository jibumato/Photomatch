-- PhotoMatch — Supabase schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- After running, update js/config.js with your project URL + anon key.

-- ============================================================
-- extensions
-- ============================================================
create extension if not exists pgcrypto;

-- ============================================================
-- profiles (1 row per auth.users row; created automatically by trigger)
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('client', 'photographer')) default 'client',
  name text,
  email text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles: read own" on profiles
  for select using (auth.uid() = id);

create policy "profiles: update own" on profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row (and a stub photographers row for pros) on sign-up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    new.raw_user_meta_data->>'name',
    new.email
  );

  if coalesce(new.raw_user_meta_data->>'role', 'client') = 'photographer' then
    insert into public.photographers (id, profile_id, name, area, availability_label)
    values (new.id::text, new.id, coalesce(new.raw_user_meta_data->>'name', '新規カメラマン'), '未設定', '');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- photographers (public directory)
-- ============================================================
create table if not exists photographers (
  id text primary key,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  area text,
  price_from text,
  rating numeric(2,1),
  reviews_count int default 0,
  availability_label text,
  photo_url text,
  price_comment text,
  bio text,
  instant_booking boolean not null default true,
  created_at timestamptz not null default now()
);

alter table photographers enable row level security;

create policy "photographers: public read" on photographers
  for select using (true);

create policy "photographers: owner update" on photographers
  for update using (profile_id = auth.uid());

-- ============================================================
-- plans (per photographer pricing plans)
-- ============================================================
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  photographer_id text not null references photographers(id) on delete cascade,
  name text not null,
  price int not null,
  original_price int,
  discount_label text,
  description text,
  duration_min int not null default 45,
  sort_order int not null default 0
);

alter table plans enable row level security;

create policy "plans: public read" on plans
  for select using (true);

create policy "plans: owner write" on plans
  for all using (
    photographer_id in (select id from photographers where profile_id = auth.uid())
  );

-- ============================================================
-- reviews (per photographer)
-- ============================================================
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  photographer_id text not null references photographers(id) on delete cascade,
  reviewer_name text not null,
  stars int not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table reviews enable row level security;

create policy "reviews: public read" on reviews
  for select using (true);

-- ============================================================
-- bookings
-- ============================================================
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  photographer_id text not null references photographers(id),
  plan_name text not null,
  plan_price int not null,
  duration_min int not null default 45,
  area text,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  customer_name text,
  customer_contact text,
  options jsonb not null default '[]'::jsonb,
  options_total int not null default 0,
  total_price int not null,
  status text not null default 'paid' check (status in ('paid', 'requested', 'confirmed', 'completed', 'canceled')),
  created_at timestamptz not null default now()
);

create index if not exists bookings_photographer_date_idx on bookings (photographer_id, booking_date);

alter table bookings enable row level security;

create policy "bookings: client read own" on bookings
  for select using (
    client_id = auth.uid()
    or photographer_id in (select id from photographers where profile_id = auth.uid())
  );

create policy "bookings: client insert own" on bookings
  for insert with check (client_id = auth.uid());

create policy "bookings: update own (cancel / status)" on bookings
  for update using (
    client_id = auth.uid()
    or photographer_id in (select id from photographers where profile_id = auth.uid())
  );

-- Public view of taken slots only (no customer PII) — used to render the
-- booking calendar for anonymous/other visitors without leaking bookings.
create or replace view booking_slots as
  select photographer_id, booking_date, start_time, end_time
  from bookings
  where status <> 'canceled';

grant select on booking_slots to anon, authenticated;

-- ============================================================
-- shifts (photographer manually closes a slot; default = open)
-- ============================================================
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  photographer_id text not null references photographers(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  is_open boolean not null default false,
  unique (photographer_id, shift_date, start_time)
);

alter table shifts enable row level security;

create policy "shifts: public read" on shifts
  for select using (true);

create policy "shifts: owner write" on shifts
  for all using (
    photographer_id in (select id from photographers where profile_id = auth.uid())
  );

-- ============================================================
-- messages (1:1 chat per booking)
-- ============================================================
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'pro')),
  sender_id uuid not null references profiles(id),
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_booking_idx on messages (booking_id, created_at);

alter table messages enable row level security;

create policy "messages: participants read" on messages
  for select using (
    booking_id in (
      select id from bookings
      where client_id = auth.uid()
         or photographer_id in (select id from photographers where profile_id = auth.uid())
    )
  );

create policy "messages: participants insert" on messages
  for insert with check (
    sender_id = auth.uid()
    and booking_id in (
      select id from bookings
      where client_id = auth.uid()
         or photographer_id in (select id from photographers where profile_id = auth.uid())
    )
  );

alter publication supabase_realtime add table messages;

-- ============================================================
-- message_reads (last-read timestamp per booking+role, drives unread badges)
-- ============================================================
create table if not exists message_reads (
  booking_id uuid not null references bookings(id) on delete cascade,
  role text not null check (role in ('client', 'pro')),
  last_read_at timestamptz not null default now(),
  primary key (booking_id, role)
);

alter table message_reads enable row level security;

create policy "message_reads: participants read" on message_reads
  for select using (
    booking_id in (
      select id from bookings
      where client_id = auth.uid()
         or photographer_id in (select id from photographers where profile_id = auth.uid())
    )
  );

create policy "message_reads: participants upsert" on message_reads
  for insert with check (
    booking_id in (
      select id from bookings
      where client_id = auth.uid()
         or photographer_id in (select id from photographers where profile_id = auth.uid())
    )
  );

create policy "message_reads: participants update" on message_reads
  for update using (
    booking_id in (
      select id from bookings
      where client_id = auth.uid()
         or photographer_id in (select id from photographers where profile_id = auth.uid())
    )
  );

-- ============================================================
-- counseling_sheets (1 row per booking, all fields optional)
-- ============================================================
create table if not exists counseling_sheets (
  booking_id uuid primary key references bookings(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz
);

alter table counseling_sheets enable row level security;

create policy "counseling_sheets: participants read" on counseling_sheets
  for select using (
    booking_id in (
      select id from bookings
      where client_id = auth.uid()
         or photographer_id in (select id from photographers where profile_id = auth.uid())
    )
  );

create policy "counseling_sheets: client upsert" on counseling_sheets
  for insert with check (
    booking_id in (select id from bookings where client_id = auth.uid())
  );

create policy "counseling_sheets: client update" on counseling_sheets
  for update using (
    booking_id in (select id from bookings where client_id = auth.uid())
  );

-- ============================================================
-- seed data — photographers, plans, reviews
-- (ported from design_handoff_photomatch/PhotoMatch.dc.html)
-- ============================================================
insert into photographers (id, name, area, price_from, rating, reviews_count, availability_label, photo_url, price_comment, bio, instant_booking) values
  ('p1', 'Takumi', '名古屋エリア', '9,800', 4.9, 58, '今週末 空きあり', 'assets/photographer-p1.jpg', '緊張しやすい方こそ、まずは気軽にご相談ください！', 'マッチングアプリ用の写真に特化。自然な会話をしながら緊張をほぐし、表情が硬くならない一枚に仕上げます。名古屋中心部での撮影が中心です。', true),
  ('p2', '夏目むぎ', '岐阜エリア', '12,000', 4.8, 46, '来週 空きあり', 'assets/cameraman-asano.jpg', '私服選びの相談も大歓迎、当日一緒に決めましょう。', '岐阜の路地やレトロな街並みを活かしたカジュアルな一枚が得意です。私服の相談やポーズが苦手な方にも丁寧にディレクションします。', true),
  ('p3', '伊藤 啓志', '名古屋エリア', '11,000', 4.9, 39, '今週末 空きあり', null, '「量産型」にならない一枚、一緒に探しましょう。', '岐阜の自然や街並みを背景に、趣味やアクティブな雰囲気を伝える写真を撮影します。よくある構図を避けた「量産型にならない」一枚が得意です。', true),
  ('p4', '早川 ゆかり', '尾張エリア', '9,000', 4.7, 31, '来週 空きあり', null, '短時間でもしっかり結果にこだわります！', '短時間・低価格のライトプランを中心に、自然光を活かしたメイン写真を撮影しています。かしこまらないカジュアルな撮影が得意です。', true),
  ('p5', '伊藤 大輔（仮名）', '岐阜エリア', '13,000', 4.8, 42, '今月 空きあり', null, '季節ごとのおすすめロケーションもご提案します。', '街歩き風の自然なスナップが得意です。季節ごとのロケーションを提案し、撮影後の納品スピードにも定評があります。', true),
  ('p6', '渡辺 さくら（仮名）', '一宮エリア', '10,500', 4.9, 50, '来週 空きあり', null, 'プロフィール文の相談も一緒に受け付けています。', 'メイン写真から趣味系の写真まで幅広く対応。事前の料金説明とプロフィール文へのアドバイスにも定評があります。', true)
on conflict (id) do nothing;

insert into plans (photographer_id, name, price, original_price, discount_label, description, duration_min, sort_order)
select p.id, v.name, v.price, v.original_price, v.discount_label, v.description, v.duration_min, v.sort_order
from photographers p
cross join (values
  ('スタンダード', 8800, 9800, '10%OFF', '45分・20枚納品', 45, 1),
  ('スタンダードプラス', 11800, 13100, '10%OFF', '45分・20枚納品＋スマホ用5枚', 45, 2),
  ('結婚相談所', 8800, 9800, '10%OFF', '45分・10枚納品', 45, 3)
) as v(name, price, original_price, discount_label, description, duration_min, sort_order)
where p.id in ('p1','p2','p3','p4','p5','p6')
on conflict do nothing;

insert into reviews (photographer_id, reviewer_name, stars, comment) values
  ('p1', 'K.T様', 5, '緊張していましたが自然な表情を引き出してもらえました。マッチング数も明らかに増えました。'),
  ('p1', 'M.S様', 5, '料金が事前に明確だったので安心して依頼できました。'),
  ('p2', 'A.N様', 5, '普段の自分らしい写真が撮れて、プロフィールの反応が良くなりました。'),
  ('p2', 'Y.H様', 4, '納品も期日通りで安心でした。'),
  ('p3', 'R.I様', 5, '事前チャットでイメージをすり合わせられたので、他の人と被らない写真になりました。'),
  ('p4', 'K.M様', 5, '短時間でも希望のカットをたくさん撮ってもらえました。'),
  ('p5', 'T.O様', 5, '安心して任せられる進行でした。'),
  ('p6', 'H.S様', 5, '事前の料金説明が丁寧でわかりやすかったです。');

-- ============================================================
-- ============================================================
-- guarantee_claims (マッチング数保証・再撮影補償)
-- ============================================================
-- Add the 'ops' role for internal staff who review guarantee claims.
-- Postgres names an unnamed inline check constraint "<table>_<column>_check".
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('client', 'photographer', 'ops'));

create table if not exists guarantee_claims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  client_id uuid not null references profiles(id) on delete cascade,
  -- applied: opted in after the shoot. claimed: client reported no improvement
  -- once eligible_at has passed. approved/rejected: ops has reviewed the claim.
  status text not null default 'applied' check (status in ('applied', 'claimed', 'approved', 'rejected')),
  eligible_at date not null, -- booking_date + 30 days; claim can be submitted from this date
  applied_at timestamptz not null default now(),
  claim_note text,
  claim_submitted_at timestamptz,
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);

alter table guarantee_claims enable row level security;

create policy "guarantee_claims: read own or ops" on guarantee_claims
  for select using (
    client_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'ops')
  );

create policy "guarantee_claims: client apply" on guarantee_claims
  for insert with check (
    client_id = auth.uid()
    and booking_id in (select id from bookings where client_id = auth.uid() and status <> 'canceled')
  );

-- Clients may only move applied -> claimed (with check blocks setting
-- status to approved/rejected directly); ops can update any field.
create policy "guarantee_claims: client submit claim" on guarantee_claims
  for update using (client_id = auth.uid())
  with check (client_id = auth.uid() and status in ('applied', 'claimed'));

create policy "guarantee_claims: ops review" on guarantee_claims
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ops')
  );

-- ============================================================
-- demo accounts (manual step)
-- ============================================================
-- Supabase Auth users can't be created from plain SQL with a known password.
-- To reproduce the design's demo logins:
--   1. In the Supabase dashboard, Authentication > Users > Add user, create:
--        guest@example.com / guest        (user metadata: {"role":"client","name":"ゲスト ユーザー"})
--        camera@photomatch.jp / camera    (user metadata: {"role":"photographer","name":"Takumi"})
--      (the trigger above will create matching profiles/photographers rows)
--   2. Link the photographer demo account to the seeded "Takumi" listing:
--        update photographers set profile_id = '<camera@photomatch.jp auth uid>' where id = 'p1';
--        delete from photographers where id = '<camera@photomatch.jp auth uid>'::text; -- remove the auto-stub row created by the trigger

-- ============================================================
-- ops account (manual step — マッチング数保証・再撮影補償の審査担当)
-- ============================================================
-- There is no public sign-up for the 'ops' role (see ops-login.html — sign-in
-- only). Create the staff account normally as a 'client' via the site or the
-- dashboard, then promote it:
--   update profiles set role = 'ops' where email = 'ops@photomatch.example.jp';
