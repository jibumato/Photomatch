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

-- お客様の性別（登録時に選ぶ。「異性スタッフ写真セレクト」の判定に使う）。
-- ブラウザからは書き込めない（サインアップ時のメタデータ経由と、決済作成 Function のみ）。
alter table profiles add column if not exists gender text;
alter table profiles drop constraint if exists profiles_gender_check;
alter table profiles add constraint profiles_gender_check check (gender is null or gender in ('male', 'female', 'other'));

alter table profiles enable row level security;

drop policy if exists "profiles: read own" on profiles;
create policy "profiles: read own" on profiles
  for select using (auth.uid() = id);

-- 運営は全員の名前・メールを見られる（モニター応募者・予約者への連絡のため）。
-- profiles 自身のポリシーから profiles を参照すると無限再帰になるので、
-- RLS を通らない security definer 関数で判定する。
create or replace function is_ops()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'ops');
$$;

drop policy if exists "profiles: ops read" on profiles;
create policy "profiles: ops read" on profiles
  for select using (is_ops());

-- 以前はここに「自分の行なら更新できる」ポリシーがあったが、列の制限が無く、
-- ログイン済みなら誰でもブラウザから自分の role を 'ops' に書き換えられた。
-- サイト側に profiles を更新する処理は無いため、ポリシーごと外す。権限(role)の
-- 変更は SQL Editor（または service_role）からのみ行う。
drop policy if exists "profiles: update own" on profiles;
revoke insert, update, delete on profiles from anon, authenticated;

-- Auto-create a profile row (and a stub photographers row for pros) on sign-up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- The role comes from sign-up metadata the *browser* sends, so it is
  -- untrusted: only 'client' and 'photographer' can be chosen that way. An
  -- 'ops' value (or anything else) becomes 'client' — ops accounts are made
  -- only from the SQL Editor (see "ops account" at the bottom of this file).
  insert into public.profiles (id, role, name, email, gender)
  values (
    new.id,
    case when new.raw_user_meta_data->>'role' = 'photographer' then 'photographer' else 'client' end,
    new.raw_user_meta_data->>'name',
    new.email,
    case when new.raw_user_meta_data->>'gender' in ('male', 'female', 'other') then new.raw_user_meta_data->>'gender' end
  );

  -- The stub starts hidden: area/photo/bio/plans are still empty, so it
  -- shouldn't show up in search until ops fills it in and flips is_visible.
  if new.raw_user_meta_data->>'role' = 'photographer' then
    insert into public.photographers (id, profile_id, name, area, availability_label, is_visible)
    values (new.id::text, new.id, coalesce(new.raw_user_meta_data->>'name', '新規カメラマン'), '未設定', '', false);
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
  gender text check (gender in ('male', 'female')),
  instant_booking boolean not null default true,
  created_at timestamptz not null default now()
);

-- gender drives the "女性カメラマンのみ" search filter. Added after the
-- initial release, so bring existing installs up to date too (create table
-- if not exists above is a no-op for them).
alter table photographers add column if not exists gender text;
alter table photographers drop constraint if exists photographers_gender_check;
alter table photographers add constraint photographers_gender_check check (gender in ('male', 'female'));

-- カメラマンの参加状況が未定などで一時的に検索・新規予約から外したい場合に
-- false にする（データは消さず、公開範囲だけ絞る）。デフォルトは表示。
alter table photographers add column if not exists is_visible boolean not null default true;

-- 公開は2つのフラグの組み合わせ。is_visible は運営の承認（運営のみ変更可。
-- ops.html「カメラマンの掲載管理」、/api/photographers/visibility 経由）、
-- is_paused は本人による一時休止（admin.html から本人が切り替え）。
-- 検索・予約に出るのは is_visible = true かつ is_paused = false のときだけ。
alter table photographers add column if not exists is_paused boolean not null default false;

-- 本人確認・接客研修を終えて運営が承認した日時。サイトの「審査済」バッジはこれが入っている
-- カメラマンだけに表示する。運営だけが書き込む（/api/photographers/visibility）。
alter table photographers add column if not exists verified_at timestamptz;
-- すでに公開されている実在のカメラマンは、確認済みとして印を付ける（デモ用の p3〜p6 は除く）。
update photographers set verified_at = now()
  where verified_at is null and is_visible is not false and id not in ('p3', 'p4', 'p5', 'p6');

-- Instagramのユーザー名（@なし）。設定されているカメラマンのみプロフィールにリンクを表示。
alter table photographers add column if not exists instagram text;

-- 英語対応可否（検索の「英語対応カメラマンのみ」絞り込みで使用）。デフォルトは
-- 非対応。bio_en/price_comment_en は英語サイト表示用の任意の翻訳文で、
-- 未設定の場合はクライアント側で日本語の bio/price_comment にフォールバックする。
alter table photographers add column if not exists speaks_english boolean not null default false;
alter table photographers add column if not exists bio_en text;
alter table photographers add column if not exists price_comment_en text;

-- Note: the gender/is_visible backfills for the seeded listings (p1〜p6) run
-- further down, after `insert into photographers` — on a genuinely fresh
-- database these rows don't exist yet at this point in the file, so an
-- update here would silently match zero rows.

alter table photographers enable row level security;

drop policy if exists "photographers: public read" on photographers;
create policy "photographers: public read" on photographers
  for select using (true);

-- The old blanket "owner update" policy let a photographer rewrite their own
-- rating, reviews_count, or flip is_visible back on after ops hid them. It's
-- replaced by a narrow one: a photographer can update only their own row
-- (profile_id = auth.uid()) and only the profile columns granted below
-- (admin.html「プロフィール設定」). rating / reviews_count / is_visible /
-- price_from / availability_label / instant_booking stay ops-only.
drop policy if exists "photographers: owner update" on photographers;

-- Supabase grants API roles full table privileges by default; a table-level
-- revoke also removes any column-level grants left by earlier runs, so the
-- column grant below must stay after it.
revoke insert, update, delete on photographers from anon, authenticated;

create policy "photographers: owner update" on photographers
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant update (name, area, gender, bio, price_comment, instagram, speaks_english, bio_en, price_comment_en, photo_url, is_paused)
  on photographers to authenticated;

-- These columns are now written by the photographers themselves and rendered
-- on public pages, so pin their shape in the DB too (the pages escape output
-- as well). `not valid` keeps the file re-runnable on data that predates the
-- constraint; rows are checked whenever they're inserted or updated.
alter table photographers drop constraint if exists photographers_area_check;
alter table photographers add constraint photographers_area_check
  check (area is null or area in ('名古屋エリア', '岐阜エリア', '一宮エリア', '未設定')) not valid;

alter table photographers drop constraint if exists photographers_instagram_check;
alter table photographers add constraint photographers_instagram_check
  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$') not valid;

-- photo_url is either a file shipped under assets/ or an object in the public
-- photographer-photos bucket below — nothing else, so it can't carry markup
-- or an arbitrary external URL into the pages.
alter table photographers drop constraint if exists photographers_photo_url_check;
alter table photographers add constraint photographers_photo_url_check
  check (photo_url is null or photo_url ~ '^(assets/[A-Za-z0-9._-]+|https://hnknxfejotertwdvkhvk\.supabase\.co/storage/v1/object/public/photographer-photos/[A-Za-z0-9._/-]+)$') not valid;

alter table photographers drop constraint if exists photographers_text_length_check;
alter table photographers add constraint photographers_text_length_check
  check (char_length(name) <= 40 and char_length(coalesce(bio, '')) <= 600 and char_length(coalesce(bio_en, '')) <= 1200
    and char_length(coalesce(price_comment, '')) <= 120 and char_length(coalesce(price_comment_en, '')) <= 240) not valid;

-- ============================================================
-- photographer-photos (プロフィール写真。公開バケット)
-- ============================================================
-- Public read (the profile/search pages show them). Only a photographer can
-- write, and only under their own <uid>/ folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photographer-photos', 'photographer-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photographer photos: public read" on storage.objects;
create policy "photographer photos: public read" on storage.objects
  for select using (bucket_id = 'photographer-photos');

drop policy if exists "photographer photos: owner insert" on storage.objects;
create policy "photographer photos: owner insert" on storage.objects
  for insert with check (
    bucket_id = 'photographer-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'photographer')
  );

drop policy if exists "photographer photos: owner delete" on storage.objects;
create policy "photographer photos: owner delete" on storage.objects
  for delete using (
    bucket_id = 'photographer-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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

drop policy if exists "plans: public read" on plans;
create policy "plans: public read" on plans
  for select using (true);

-- プランの価格・内容は運営だけが決める。以前は「カメラマンが自分のプランを編集できる」
-- ポリシーがあり、ブラウザから価格を書き換えられた（決済額はこのテーブルの price）。
-- プランの追加・変更は SQL Editor か service_role（掲載の承認時の標準プラン登録）から行う。
drop policy if exists "plans: owner write" on plans;
revoke insert, update, delete on plans from anon, authenticated;

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

-- 運営が不適切な口コミを非表示にするためのフラグ（運営のみ変更可。
-- /api/reviews/moderate 経由）。非表示の口コミは公開されず、評価の集計にも入らない。
alter table reviews add column if not exists is_hidden boolean not null default false;

-- 撮影後レビュー: 投稿したお客様（本人だけが編集・削除できる）。アカウントを
-- 削除したら口コミも消える。booking_id は bookings の作成後（このファイルの末尾）に追加。
alter table reviews add column if not exists client_id uuid references profiles(id) on delete cascade;

alter table reviews enable row level security;

-- 公開されるのは非表示でない口コミだけ。投稿者本人と運営には、非表示の口コミも見える。
drop policy if exists "reviews: public read" on reviews;
drop policy if exists "reviews: read" on reviews;
create policy "reviews: read" on reviews
  for select using (
    not is_hidden
    or client_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'ops')
  );

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

drop policy if exists "bookings: client read own" on bookings;
create policy "bookings: client read own" on bookings
  for select using (
    client_id = auth.uid()
    or photographer_id in (select id from photographers where profile_id = auth.uid())
  );

-- Every write to bookings happens server-side (Pages Functions with the
-- service_role key, which bypasses RLS): /api/checkout/create-session,
-- the Stripe webhook, /api/bookings/cancel and /api/payouts/release.
-- Browsers get no write access at all: otherwise a client could create a
-- 'paid' booking without paying, rewrite total_price / payout_status, or
-- cancel directly and skip the cancellation emails.
drop policy if exists "bookings: client insert own" on bookings;
drop policy if exists "bookings: update own (cancel / status)" on bookings;
drop policy if exists "bookings: client cancel own" on bookings;

-- Supabase grants API roles full table privileges by default; a table-level
-- revoke also removes any column-level grants left by earlier versions.
revoke insert, update, delete on bookings from anon, authenticated;

-- ops needs to browse all bookings to review Stripe payouts (js/pages/ops.js).
-- Added after the initial release; policies are additive (OR'd) so this only
-- widens visibility, it never narrows the policies above.
drop policy if exists "bookings: ops read" on bookings;
create policy "bookings: ops read" on bookings
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ops')
  );

-- Public view of taken slots only (no customer PII) — used to render the
-- booking calendar for anonymous/other visitors without leaking bookings.
create or replace view booking_slots as
  select photographer_id, booking_date, start_time, end_time
  from bookings
  where status <> 'canceled';

grant select on booking_slots to anon, authenticated;

-- ============================================================
-- shifts（カメラマンが「受付中」にした30分枠。初期状態はすべて休み）
-- ============================================================
-- お客様が予約できるのは、ここに is_open = true の行がある枠だけ。行がない枠は休み。
-- （以前は「休みにした枠だけ行を作る」方式で、初期状態がすべて受付中だったため、
--  カメラマンが開けていない日時にも予約が入った。）
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  photographer_id text not null references photographers(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  is_open boolean not null default true,
  unique (photographer_id, shift_date, start_time)
);

-- 旧方式の「休み」の行（is_open = false）は、いまは行がない＝休みと同じ意味なので消す。
-- 方式を切り替えた時点では、どのカメラマンも受付中の枠がなくなる（管理画面で開け直す）。
alter table shifts alter column is_open set default true;
delete from shifts where is_open = false;

alter table shifts enable row level security;

drop policy if exists "shifts: public read" on shifts;
create policy "shifts: public read" on shifts
  for select using (true);

drop policy if exists "shifts: owner write" on shifts;
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

drop policy if exists "messages: participants read" on messages;
create policy "messages: participants read" on messages
  for select using (
    booking_id in (
      select id from bookings
      where client_id = auth.uid()
         or photographer_id in (select id from photographers where profile_id = auth.uid())
    )
  );

drop policy if exists "messages: participants insert" on messages;
-- sender_role は本人の立場と一致しなければならない（お客様が 'pro' として投稿できないように）。
create policy "messages: participants insert" on messages
  for insert with check (
    sender_id = auth.uid()
    and (
      (sender_role = 'client' and booking_id in (select id from bookings where client_id = auth.uid()))
      or (sender_role = 'pro' and booking_id in (
        select id from bookings
        where photographer_id in (select id from photographers where profile_id = auth.uid())
      ))
    )
  );

-- alter publication ... add table has no IF NOT EXISTS form, so guard it to
-- keep this file safe to re-run in full.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

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

drop policy if exists "message_reads: participants read" on message_reads;
create policy "message_reads: participants read" on message_reads
  for select using (
    booking_id in (
      select id from bookings
      where client_id = auth.uid()
         or photographer_id in (select id from photographers where profile_id = auth.uid())
    )
  );

drop policy if exists "message_reads: participants upsert" on message_reads;
-- 既読は自分の立場の行だけ書ける（相手側の未読バッジを消せないように）。
create policy "message_reads: participants upsert" on message_reads
  for insert with check (
    (role = 'client' and booking_id in (select id from bookings where client_id = auth.uid()))
    or (role = 'pro' and booking_id in (
      select id from bookings
      where photographer_id in (select id from photographers where profile_id = auth.uid())
    ))
  );

drop policy if exists "message_reads: participants update" on message_reads;
create policy "message_reads: participants update" on message_reads
  for update using (
    (role = 'client' and booking_id in (select id from bookings where client_id = auth.uid()))
    or (role = 'pro' and booking_id in (
      select id from bookings
      where photographer_id in (select id from photographers where profile_id = auth.uid())
    ))
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

drop policy if exists "counseling_sheets: participants read" on counseling_sheets;
create policy "counseling_sheets: participants read" on counseling_sheets
  for select using (
    booking_id in (
      select id from bookings
      where client_id = auth.uid()
         or photographer_id in (select id from photographers where profile_id = auth.uid())
    )
  );

drop policy if exists "counseling_sheets: client upsert" on counseling_sheets;
create policy "counseling_sheets: client upsert" on counseling_sheets
  for insert with check (
    booking_id in (select id from bookings where client_id = auth.uid())
  );

drop policy if exists "counseling_sheets: client update" on counseling_sheets;
create policy "counseling_sheets: client update" on counseling_sheets
  for update using (
    booking_id in (select id from bookings where client_id = auth.uid())
  );

-- ============================================================
-- seed data — photographers, plans, reviews
-- (ported from design_handoff_photomatch/PhotoMatch.dc.html)
-- ============================================================
-- price_from は「最も安いプランの税込価格」。全カメラマンが同じプラン構成
-- なので全員同額。現在どの画面にも表示していないが、実価格と食い違ったまま
-- 残すと将来表示したときに誤表示になるため実額に揃える（最安値はスマホプラン）。
insert into photographers (id, name, area, price_from, rating, reviews_count, availability_label, photo_url, price_comment, bio, gender, instant_booking) values
  ('p1', 'Takumi', '名古屋エリア', '6,800', null, 0, '今週末 空きあり', 'assets/photographer-p1.jpg', '緊張しやすい方こそ、まずは気軽にご相談ください！', 'マッチングアプリ用の写真に特化。自然な会話をしながら緊張をほぐし、表情が硬くならない一枚に仕上げます。名古屋中心部での撮影が中心です。', 'male', true),
  ('p2', '夏目むぎ', '岐阜エリア', '6,800', null, 0, '来週 空きあり', 'assets/cameraman-asano.jpg', 'アプリやSNSアイコン、結婚相談所のお写真まで。魅力が伝わる、自然な瞬間をお写真に残します。', '岐阜の路地やレトロな街並みを活かしたカジュアルな一枚が得意です。私服の相談やポーズが苦手な方にも丁寧にディレクションします。', 'female', true),
  ('p3', '伊藤 啓志', '名古屋エリア', '6,800', null, 0, '今週末 空きあり', null, '「量産型」にならない一枚、一緒に探しましょう。', '岐阜の自然や街並みを背景に、趣味やアクティブな雰囲気を伝える写真を撮影します。よくある構図を避けた「量産型にならない」一枚が得意です。', 'male', true),
  ('p4', '早川 ゆかり', '一宮エリア', '6,800', null, 0, '来週 空きあり', null, '短時間でもしっかり結果にこだわります！', '短時間・低価格のライトプランを中心に、自然光を活かしたメイン写真を撮影しています。かしこまらないカジュアルな撮影が得意です。', 'female', true),
  ('p5', '伊藤 大輔（仮名）', '岐阜エリア', '6,800', null, 0, '今月 空きあり', null, '季節ごとのおすすめロケーションもご提案します。', '街歩き風の自然なスナップが得意です。季節ごとのロケーションを提案し、撮影後の納品スピードにも定評があります。', 'male', true),
  ('p6', '渡辺 さくら（仮名）', '一宮エリア', '6,800', null, 0, '来週 空きあり', null, 'プロフィール文の相談も一緒に受け付けています。', 'メイン写真から趣味系の写真まで幅広く対応。事前の料金説明とプロフィール文へのアドバイスにも定評があります。', 'female', true)
on conflict (id) do nothing;

-- 上の insert は既存インストールでは何もしないため、同じ修正を既存行にも当てる。
-- エリア表記は AREAS 定数（名古屋／岐阜／一宮）に統一する。「尾張エリア」は
-- p4 だけで使われていた表記で、検索の絞り込みが分断されていた。
update photographers set area = '一宮エリア' where area = '尾張エリア';
update photographers set price_from = '6,800' where id in ('p1','p2','p3','p4','p5','p6');

-- gender/is_visible: the insert above already sets these for a fresh
-- install; these backfills only matter for installs that ran an earlier
-- version of this file before those columns existed. `gender is null`
-- keeps this safe to re-run and never overwrites a value set by hand.
update photographers set gender = 'male'   where id in ('p1', 'p3', 'p5') and gender is null;
update photographers set gender = 'female' where id in ('p2', 'p4', 'p6') and gender is null;

-- 伊藤 啓志（p3）・早川 ゆかり（p4）は参加未定のため一時的に非表示。
-- 参加が決まったら update photographers set is_visible = true where id in ('p3','p4'); で戻す。
update photographers set is_visible = false where id in ('p3', 'p4');

-- セルフ登録で作られたまま未整備のカメラマン（エリア「未設定」）を非表示に。
-- トリガーが非表示で作るようになる前に登録された分の後始末。
update photographers set is_visible = false where area = '未設定' and profile_id is not null;

-- `instagram is null` so a value later changed in the dashboard isn't overwritten on re-run.
update photographers set instagram = 'ooo.neige' where id = 'p2' and instagram is null;

-- 同様に、photo_url が追加される前に作成された既存行を埋める
-- （`photo_url is null` なので、後からダッシュボードで変更した値は上書きしない）。
update photographers set photo_url = 'assets/cameraman-asano.jpg' where id = 'p2' and photo_url is null;

-- TAKUMI（p1）のみ英語対応。bio_en/price_comment_en は `is null` の場合だけ
-- 埋めるので、後からダッシュボードで手を入れた文面は上書きしない。
update photographers set speaks_english = true where id = 'p1';
update photographers set bio_en = 'Specializing in photos for dating apps. I keep the conversation relaxed and natural throughout the shoot, so your expression never looks stiff. Most sessions take place in central Nagoya.'
  where id = 'p1' and bio_en is null;
update photographers set price_comment_en = 'If you tend to get nervous in front of the camera, that''s exactly why I''d love to hear from you — feel free to reach out!'
  where id = 'p1' and price_comment_en is null;

-- 上の insert は既存インストールでは何もしないため、ひとこと（price_comment）
-- の変更を既存行にも当てる。
update photographers set price_comment = 'アプリやSNSアイコン、結婚相談所のお写真まで。魅力が伝わる、自然な瞬間をお写真に残します。' where id = 'p2';

-- 前回、この文言を誤って紹介文（bio）に設定してしまったため元に戻す
-- （ひとこと・紹介文の両方に同じ文が表示されてしまっていた）。
update photographers set bio = '岐阜の路地やレトロな街並みを活かしたカジュアルな一枚が得意です。私服の相談やポーズが苦手な方にも丁寧にディレクションします。' where id = 'p2';

insert into plans (photographer_id, name, price, original_price, discount_label, description, duration_min, sort_order)
select p.id, v.name, v.price, v.original_price, v.discount_label, v.description, v.duration_min, v.sort_order
from photographers p
cross join (values
  ('スマホプラン', 6800, 7800, '1,000円OFF', '45分・20枚納品・スマホ撮影', 45, 0),
  ('スタンダード', 8800, 9800, '1,000円OFF', '45分・20枚納品', 45, 1),
  ('スタンダードプラス', 10800, 11800, '1,000円OFF', '45分・20枚納品＋スマホ用5枚', 45, 2),
  ('結婚相談所', 8800, 9800, '1,000円OFF', '45分・10枚納品', 45, 3)
) as v(name, price, original_price, discount_label, description, duration_min, sort_order)
where p.id in ('p1','p2','p3','p4','p5','p6')
  -- plans has no unique key besides id, so on conflict can't dedupe; check
  -- by (photographer, plan name) instead to keep re-runs from duplicating.
  and not exists (
    select 1 from plans x where x.photographer_id = p.id and x.name = v.name
  );

-- 上の insert は既存の行には触れないため、価格改定を既存インストールにも当てる。
update plans set price = 6800, original_price = 7800, discount_label = '1,000円OFF', duration_min = 45
  where name = 'スマホプラン' and photographer_id in ('p1','p2','p3','p4','p5','p6');
-- 納品枚数を10枚→20枚に変更したため、既存インストールの description も揃える。
update plans set description = '45分・20枚納品・スマホ撮影'
  where name = 'スマホプラン' and photographer_id in ('p1','p2','p3','p4','p5','p6');
update plans set price = 8800, original_price = 9800, discount_label = '1,000円OFF'
  where name in ('スタンダード', '結婚相談所') and photographer_id in ('p1','p2','p3','p4','p5','p6');
update plans set price = 10800, original_price = 11800, discount_label = '1,000円OFF'
  where name = 'スタンダードプラス' and photographer_id in ('p1','p2','p3','p4','p5','p6');

-- 以前はここに、ダミーの口コミ8件と、ダミーの評価・レビュー数を種まきしていた。
-- 実在のお客様のものではないため廃止した（口コミ・評価は実際のレビューが集まるまで
-- 出さない）。既存のDBに残っている分は、種まきと同じ内容の行だけを消すので、
-- 実際の口コミには触れず、何度実行しても安全。
delete from reviews
where (photographer_id, reviewer_name, comment) in (
  ('p1', 'K.T様', '緊張していましたが自然な表情を引き出してもらえました。マッチング数も明らかに増えました。'),
  ('p1', 'M.S様', '料金が事前に明確だったので安心して依頼できました。'),
  ('p2', 'A.N様', '普段の自分らしい写真が撮れて、プロフィールの反応が良くなりました。'),
  ('p2', 'Y.H様', '納品も期日通りで安心でした。'),
  ('p3', 'R.I様', '事前チャットでイメージをすり合わせられたので、他の人と被らない写真になりました。'),
  ('p4', 'K.M様', '短時間でも希望のカットをたくさん撮ってもらえました。'),
  ('p5', 'T.O様', '安心して任せられる進行でした。'),
  ('p6', 'H.S様', '事前の料金説明が丁寧でわかりやすかったです。')
);

-- 評価・レビュー数は reviews の実データから求める（レビューが無ければ評価も無し・0件）。
-- 以降の更新は、ファイル末尾のトリガー（reviews_refresh_rating）が行う。
update photographers p set
  rating = (select round(avg(r.stars), 1) from reviews r where r.photographer_id = p.id and not r.is_hidden),
  reviews_count = (select count(*) from reviews r where r.photographer_id = p.id and not r.is_hidden)
where p.rating is distinct from (select round(avg(r.stars), 1) from reviews r where r.photographer_id = p.id and not r.is_hidden)
   or p.reviews_count is distinct from (select count(*) from reviews r where r.photographer_id = p.id and not r.is_hidden);

-- ============================================================
-- ============================================================
-- guarantee_claims (マッチング数保証・再撮影補償)
-- ============================================================
-- Add the 'ops' role for internal staff who review guarantee claims.
-- Postgres names an unnamed inline check constraint "<table>_<column>_check".
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('client', 'photographer', 'ops'));

-- 運営アカウントの作り方: 先に通常どおりログイン用アカウントを作り（login.html などで
-- 新規登録してメール確認を済ませる）、SQL Editor で次を実行する。
--   update profiles set role = 'ops' where email = '運営メンバーのメールアドレス';

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

drop policy if exists "guarantee_claims: read own or ops" on guarantee_claims;
create policy "guarantee_claims: read own or ops" on guarantee_claims
  for select using (
    client_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'ops')
  );

drop policy if exists "guarantee_claims: client apply" on guarantee_claims;
create policy "guarantee_claims: client apply" on guarantee_claims
  for insert with check (
    client_id = auth.uid()
    and booking_id in (select id from bookings where client_id = auth.uid() and status <> 'canceled')
  );

-- Clients may only move applied -> claimed (with check blocks setting
-- status to approved/rejected directly); ops can update any field.
drop policy if exists "guarantee_claims: client submit claim" on guarantee_claims;
create policy "guarantee_claims: client submit claim" on guarantee_claims
  for update using (client_id = auth.uid())
  with check (client_id = auth.uid() and status in ('applied', 'claimed'));

drop policy if exists "guarantee_claims: ops review" on guarantee_claims;
create policy "guarantee_claims: ops review" on guarantee_claims
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ops')
  );

-- RLS は「どの列を書くか」を制限できないため、お客様（ops・service_role 以外）の書き込みを
-- トリガーで絞る。以前は eligible_at を画面から送れ、日付を早めたり、承認・却下済みの
-- 申請を「申請中」に戻したり、審査コメントを書き換えたりできた。
--   insert: 状態は 'applied' 固定、eligible_at は予約日 + 30日をDB側で計算
--   update: 'applied' → 'claimed' だけ（eligible_at 以降の日付、日本時間）。それ以外の列は変えられない
create or replace function guarantee_claims_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_ops boolean;
begin
  if auth.uid() is null then
    return new; -- SQL Editor / service_role
  end if;
  select exists (select 1 from profiles where id = auth.uid() and role = 'ops') into is_ops;
  if is_ops then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'applied';
    new.eligible_at := (select booking_date from bookings where id = new.booking_id) + 30;
    new.claim_note := null;
    new.claim_submitted_at := null;
    new.review_note := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    return new;
  end if;

  -- UPDATE by the customer
  if old.status <> 'applied' or new.status <> 'claimed' then
    raise exception 'この申請は変更できません。';
  end if;
  if old.eligible_at > (now() at time zone 'Asia/Tokyo')::date then
    raise exception 'まだ申請できる日になっていません。';
  end if;
  -- 申請できるのは、申請可能日から14日間（js/data.js の GUARANTEE_CLAIM_DAYS）。
  if old.eligible_at + 14 < (now() at time zone 'Asia/Tokyo')::date then
    raise exception '申請期限を過ぎています。';
  end if;
  new.id := old.id;
  new.booking_id := old.booking_id;
  new.client_id := old.client_id;
  new.eligible_at := old.eligible_at;
  new.applied_at := old.applied_at;
  new.review_note := old.review_note;
  new.reviewed_at := old.reviewed_at;
  new.reviewed_by := old.reviewed_by;
  return new;
end;
$$;

-- 承認後の無料再撮影（/api/guarantee/reshoot）。お客様が日時を選ぶと、¥0 の予約を作る。
-- ops_notified_at: 申請を運営にメールで知らせた日時（/api/notify/ops。1回だけ送る）。
alter table guarantee_claims add column if not exists reshoot_booking_id uuid references bookings(id) on delete set null;
alter table guarantee_claims add column if not exists ops_notified_at timestamptz;
alter table bookings add column if not exists reshoot_of uuid references bookings(id) on delete set null;

drop trigger if exists guarantee_claims_guard_trg on guarantee_claims;
create trigger guarantee_claims_guard_trg
  before insert or update on guarantee_claims
  for each row execute function guarantee_claims_guard();

-- ============================================================
-- monitor_applications (モニター価格プログラムへの応募)
-- ============================================================
-- 先着10名・スタンダード半額(¥4,400)でのモニター撮影に応募するテーブル。
-- 効果測定（施策前後のマッチング数比較）のため、既存アカウントに紐づけて
-- 申し込む必要がある。当選後は本人が通常の予約ページから予約し、対象プランの
-- 決済時にモニター価格が自動で適用される（bookings.monitor_application_id）。
-- 審査結果は /api/monitor/review で記録し、応募者へメールで通知する。
create table if not exists monitor_applications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  -- applied: 応募直後。accepted/rejected: 定員審査の結果。completed: 撮影・追跡調査まで完了。
  status text not null default 'applied' check (status in ('applied', 'accepted', 'rejected', 'completed')),
  has_existing_photos boolean not null default false, -- 施策前後比較のため既存写真が必須の要件
  current_apps text, -- 使用中のマッチングアプリ（任意記入）
  motivation text, -- 応募理由・自由記述
  follow_up_opt_in boolean not null default false, -- 1ヶ月後の任意アンケートに協力するか
  applied_at timestamptz not null default now(),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);

alter table monitor_applications enable row level security;

drop policy if exists "monitor_applications: read own or ops" on monitor_applications;
create policy "monitor_applications: read own or ops" on monitor_applications
  for select using (
    client_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'ops')
  );

-- with check only constrained client_id, not status — an applicant could
-- insert their own application already status='accepted' (or 'completed'),
-- skipping ops review entirely.
drop policy if exists "monitor_applications: client apply" on monitor_applications;
create policy "monitor_applications: client apply" on monitor_applications
  for insert with check (client_id = auth.uid() and status = 'applied');

drop policy if exists "monitor_applications: ops review" on monitor_applications;
create policy "monitor_applications: ops review" on monitor_applications
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ops')
  );

alter table monitor_applications add column if not exists ops_notified_at timestamptz;

-- 先着10名（js/data.js の MONITOR_CAPACITY）。当選（と撮影完了）の数から残り枠を返す。
-- 応募者は他人の応募を読めないため、security definer で数だけを公開する。
create or replace function monitor_slots_left()
returns int
language sql
stable
security definer set search_path = public
as $$
  select greatest(0, 10 - count(*))::int from monitor_applications where status in ('accepted', 'completed');
$$;
grant execute on function monitor_slots_left() to anon, authenticated;

-- RLS can't restrict *which columns* an insert sets, so also narrow the
-- table grant: an applicant can only ever supply these columns (status is
-- covered by its default + the with check above, not by the client).
revoke insert, update, delete on monitor_applications from anon, authenticated;
grant insert (client_id, has_existing_photos, current_apps, motivation, follow_up_opt_in) on monitor_applications to authenticated;
grant update on monitor_applications to authenticated; -- rows filtered by "ops review" above

-- ============================================================
-- Stripe連携（Payments / Connect / Tax）
-- ============================================================
-- カメラマンへのStripe Express Connectアカウント情報。
-- ※カメラマン報酬はStripe Connect送金ではなく運営による銀行振込方式に変更
-- したため（下記 photographer_bank_accounts 参照）、このカラム群はアプリ
-- コードからは参照しなくなった。データ削除は行わずカラムのみ残している。
alter table photographers add column if not exists stripe_account_id text;
alter table photographers add column if not exists stripe_charges_enabled boolean not null default false;
alter table photographers add column if not exists stripe_payouts_enabled boolean not null default false;

-- 予約ごとの決済・送金情報。予約は決済前は status='pending_payment' で作成され、
-- Stripe Webhookが checkout.session.completed を受け取った時点で 'paid' に更新する。
-- payout_status は「プラットフォームが一旦全額を預かり、保証期間（30日）経過後に
-- opsが銀行振込でカメラマンへ報酬（プラン料金の50%＋オプション1件につき¥1,100、
-- js/data.js の photographerPayoutFor）を送金する」運用のための状態（released 前は pending）。
alter table bookings add column if not exists stripe_checkout_session_id text;
alter table bookings add column if not exists stripe_payment_intent_id text;
alter table bookings add column if not exists stripe_charge_id text;
alter table bookings add column if not exists payout_status text not null default 'pending';
alter table bookings drop constraint if exists bookings_payout_status_check;
alter table bookings add constraint bookings_payout_status_check check (payout_status in ('pending', 'released'));
alter table bookings add column if not exists stripe_transfer_id text; -- 未使用（銀行振込方式に変更したため）。データ保持のため残置。
alter table bookings add column if not exists payout_released_at timestamptz;
alter table bookings add column if not exists payout_note text; -- opsが銀行振込を記録する際の任意メモ

-- お客様都合のキャンセル（/api/bookings/cancel）。キャンセル料・返金額の計算は
-- js/data.js の cancellationQuote()：3日前まで無料／2日前 プラン料金の50%／
-- 前日・当日 プラン料金の100%（オプション料金は全額返金）。返金は Stripe で自動。
-- photographer_cancel_comp は当日キャンセルのときだけカメラマンへ払う補償（¥2,000）で、
-- 通常の報酬と同じく payout_status で送金を管理する。
-- 納品（/api/bookings/deliver）。カメラマンが撮影後にアルバムのリンク（https）を登録すると、
-- お客様にメールで届き、マイページにも表示される。送金は納品済みの予約だけ確定できる。
alter table bookings add column if not exists delivered_at timestamptz;
alter table bookings add column if not exists delivery_url text;
alter table bookings drop constraint if exists bookings_delivery_url_check;
alter table bookings add constraint bookings_delivery_url_check
  check (delivery_url is null or (delivery_url ~ '^https://' and length(delivery_url) <= 500)) not valid;

-- 異性スタッフ写真セレクト（オプション）。納品後、お客様と異なる性別のスタッフが一枚を選び、
-- 運営画面から送る（/api/bookings/staff-pick）。お客様にメールが届き、マイページに表示される。
alter table bookings add column if not exists staff_pick_note text;
alter table bookings add column if not exists staff_pick_at timestamptz;

-- チャットの新着メール通知の送信記録（同じ相手に10分に1通まで）。サーバー（service_role）専用。
create table if not exists message_notifications (
  booking_id uuid not null references bookings(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('client', 'pro')),
  last_sent_at timestamptz not null default now(),
  primary key (booking_id, recipient_role)
);
alter table message_notifications enable row level security;
revoke all on message_notifications from anon, authenticated;

-- 運営による対応（/api/bookings/ops-cancel・/api/bookings/payout-hold・Stripe Webhook）。
--   ops: カメラマン都合・悪天候などで運営がキャンセルした（cancel_reason）
--   payout_hold: チャージバック（不審請求の申し立て）や、Stripe 管理画面での返金があったため、
--                カメラマンへの送金を止めている。理由は payout_hold_reason。運営が確認して解除する
--   stripe_refunded_total: Stripe 上で返金済みの合計（charge.refunded で更新）
alter table bookings add column if not exists payout_hold boolean not null default false;
alter table bookings add column if not exists payout_hold_reason text;
alter table bookings add column if not exists stripe_refunded_total int not null default 0;
alter table bookings add column if not exists cancel_note text;

-- 日程変更（/api/bookings/reschedule。ルールは js/data.js の rescheduleQuote）。
-- 動かす前の日時は previous_* に残す（直前の1回分）。reschedule_plan_used は
-- 「あんしん振替プラン」の無料の1回を使ったかどうか。
alter table bookings add column if not exists rescheduled_count int not null default 0;
alter table bookings add column if not exists reschedule_plan_used boolean not null default false;
alter table bookings add column if not exists previous_booking_date date;
alter table bookings add column if not exists previous_start_time time;
alter table bookings add column if not exists rescheduled_at timestamptz;

-- 予約時のお客様の性別（「異性スタッフ写真セレクト」を担当するスタッフ用）。
alter table bookings add column if not exists customer_gender text;
alter table bookings drop constraint if exists bookings_customer_gender_check;
alter table bookings add constraint bookings_customer_gender_check check (customer_gender is null or customer_gender in ('male', 'female', 'other'));

alter table bookings add column if not exists canceled_at timestamptz;
alter table bookings add column if not exists cancel_fee int;
alter table bookings add column if not exists refund_amount int;
alter table bookings add column if not exists refund_status text;
alter table bookings drop constraint if exists bookings_refund_status_check;
alter table bookings add constraint bookings_refund_status_check
  check (refund_status is null or refund_status in ('none', 'pending', 'succeeded', 'failed'));
alter table bookings add column if not exists stripe_refund_id text;
alter table bookings add column if not exists photographer_cancel_comp int not null default 0;
-- customer: お客様がマイページからキャンセル／no_show: 15分以上の遅刻で運営が当日キャンセル扱いにした
-- （/api/bookings/no-show。規約第5条）／system: 決済が遅れて同じ枠が先に埋まっていた等で、
-- Webhook が自動で取り消して全額返金した（/api/stripe/webhook）。
alter table bookings add column if not exists cancel_reason text;
alter table bookings drop constraint if exists bookings_cancel_reason_check;
alter table bookings add constraint bookings_cancel_reason_check
  check (cancel_reason is null or cancel_reason in ('customer', 'no_show', 'system', 'ops'));

-- モニター価格（当選者1回限りの半額）を使った予約。どの応募の権利を使ったかを残し、
-- 2回目以降は定価になるようにする（/api/checkout/create-session が判定）。
alter table bookings add column if not exists monitor_application_id uuid references monitor_applications(id) on delete set null;

-- Postgres names an unnamed inline check constraint "<table>_<column>_check".
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
  check (status in ('pending_payment', 'paid', 'requested', 'confirmed', 'completed', 'canceled'));

-- 決済待ち（pending_payment）の予約もカレンダー上は「予約済み」として枠を塞ぐが、
-- 35分を過ぎても決済が完了しない（Stripe Checkoutを離脱した等）場合は自動的に
-- 空き枠へ戻す。クリーンアップ用のバッチ処理は不要。
-- Stripe Checkout の有効期限は31分（create-session.js の expires_at）。期限が切れた
-- ページでは支払えないので、その後の4分の余裕を見て枠を戻す（js/data.js の
-- PENDING_PAYMENT_HOLD_MIN と同じ値にすること）。以前は20分で枠を戻していたが、
-- 決済ページは24時間有効だったため、同じ枠に2人が支払えた。
create or replace view booking_slots as
  select photographer_id, booking_date, start_time, end_time
  from bookings
  where status <> 'canceled'
    and (status <> 'pending_payment' or created_at > now() - interval '35 minutes');

-- ============================================================
-- photographer_bank_accounts（カメラマンへの報酬振込先）
-- ============================================================
-- 報酬はStripe Connectではなく運営による銀行振込（月末締め・翌月25日払い）
-- で行うため、カメラマン本人が振込先口座を登録できるようにする。
-- photographersテーブルは誰でも閲覧できる公開テーブル（"photographers: public
-- read"）なので、口座番号のような機微情報は混ぜず別テーブルに分離する。
create table if not exists photographer_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  photographer_id text not null unique references photographers(id) on delete cascade,
  bank_name text not null,
  branch_name text not null,
  account_type text not null check (account_type in ('ordinary', 'checking')), -- 普通/当座
  account_number text not null,
  account_holder_name text not null, -- 口座名義（カタカナ）
  updated_at timestamptz not null default now()
);

alter table photographer_bank_accounts enable row level security;

drop policy if exists "bank accounts: owner manage" on photographer_bank_accounts;
create policy "bank accounts: owner manage" on photographer_bank_accounts
  for all using (
    photographer_id in (select id from photographers where profile_id = auth.uid())
  );

drop policy if exists "bank accounts: ops read" on photographer_bank_accounts;
create policy "bank accounts: ops read" on photographer_bank_accounts
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ops')
  );

-- ============================================================
-- demo accounts (manual step)
-- ============================================================
-- Supabase Auth users can't be created from plain SQL with a known password.
-- To reproduce the design's demo logins:
--   1. In the Supabase dashboard, Authentication > Users > Add user, create:
--        guest@example.com / guest1       (user metadata: {"role":"client","name":"ゲスト ユーザー"})
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

-- ============================================================
-- reviews: 撮影後レビュー（お客様が予約ごとに1件、撮影終了後に投稿）
-- ============================================================
alter table reviews add column if not exists booking_id uuid references bookings(id) on delete cascade;

-- 1予約につき1件。booking_id が無い行（以前のデータ）は対象外。
create unique index if not exists reviews_booking_id_key on reviews (booking_id) where booking_id is not null;

-- 公開ページに出る文章なので、長さをDBでも縛る（既存の行は検証せず、追加・更新時に確認）。
alter table reviews drop constraint if exists reviews_length_check;
alter table reviews add constraint reviews_length_check
  check (char_length(reviewer_name) between 1 and 20 and char_length(coalesce(comment, '')) <= 1000) not valid;

-- 書き込めるのは、投稿者本人が、自分の予約について、撮影終了後に行う場合だけ。
-- 編集できるのは表示名・星・本文のみ（予約・カメラマン・投稿者・非表示フラグは変更不可）。
-- Supabase は API ロールに全権限を付けるため、先に外してから必要な列だけ付ける。
revoke insert, update, delete on reviews from anon, authenticated;
grant insert (photographer_id, booking_id, client_id, reviewer_name, stars, comment) on reviews to authenticated;
grant update (reviewer_name, stars, comment) on reviews to authenticated;
grant delete on reviews to authenticated;

drop policy if exists "reviews: client insert after shoot" on reviews;
create policy "reviews: client insert after shoot" on reviews
  for insert to authenticated
  with check (
    client_id = auth.uid()
    and booking_id is not null
    and exists (
      select 1 from public.bookings b
      where b.id = reviews.booking_id
        and b.client_id = auth.uid()
        and b.photographer_id = reviews.photographer_id
        and b.status in ('paid', 'confirmed', 'completed')
        and ((b.booking_date + b.end_time) at time zone 'Asia/Tokyo') <= now()
    )
  );

drop policy if exists "reviews: client update own" on reviews;
create policy "reviews: client update own" on reviews
  for update to authenticated using (client_id = auth.uid()) with check (client_id = auth.uid());

drop policy if exists "reviews: client delete own" on reviews;
create policy "reviews: client delete own" on reviews
  for delete to authenticated using (client_id = auth.uid());

-- 評価・レビュー数は reviews から自動で求める（投稿・編集・削除・運営の非表示のたびに更新）。
-- photographers の rating / reviews_count は運営のみ書き込み可なので、定義者権限で更新する。
create or replace function refresh_photographer_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  pid text := coalesce(new.photographer_id, old.photographer_id);
begin
  update public.photographers set
    rating = (select round(avg(stars), 1) from public.reviews where photographer_id = pid and not is_hidden),
    reviews_count = (select count(*) from public.reviews where photographer_id = pid and not is_hidden)
  where id = pid;
  return null;
end;
$$;

drop trigger if exists reviews_refresh_rating on reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on reviews
  for each row execute function refresh_photographer_rating();
