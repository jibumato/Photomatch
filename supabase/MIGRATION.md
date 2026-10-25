# Supabase を別アカウントの新しいプロジェクトへ移す手順

今のプロジェクト（`hnknxfejotertwdvkhvk`）のデータを**すべて**（会員アカウントとパスワード・予約・カメラマンのプロフィール・シフト・口コミ・写真など）新しいプロジェクトへ移し、サイトの接続先を切り替える手順です。

- 会員は、切り替え後も**同じメールアドレスとパスワードでログインできます**（ログイン中の人は、一度ログインし直しになります）
- 作業時間の目安：準備 30分、切り替え当日 1〜2時間
- 秘密の値（サービスロールキー・データベースのパスワード）は、チャットやリポジトリに書かないこと

---

## 0. 用意するもの

- 作業用のパソコン（Mac か Windows）
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)（`supabase db dump` に使う。Docker Desktop も必要）
- PostgreSQL のコマンド `psql`（Mac は `brew install libpq`、Windows は PostgreSQL のインストーラー）
- Node.js 18 以上（写真のコピーに使う）
- このリポジトリ一式

## 1. 新しいプロジェクトを作る

1. 新しい Supabase アカウントでログインし、「New project」を作る
   - **Region は今と同じ「Northeast Asia (Tokyo)」**
   - データベースのパスワードは控えておく（秘密の値）
2. 作成後、「Project Settings → API」で次を控える
   - Project URL（例 `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`）… 公開してよい値
   - anon public キー … 公開してよい値
   - service_role キー … **秘密の値**
3. 「Project Settings → Database → Connection string」の **Session pooler**（URI）を、旧・新の両方で控える（秘密の値。`[YOUR-PASSWORD]` の部分は各データベースのパスワード）

## 2. 新しいプロジェクトの認証の設定（旧プロジェクトの画面を見ながら写す）

「Authentication」で、旧プロジェクトと同じにする。

- **URL Configuration**
  - Site URL：`https://photo-match.jp`
  - Redirect URLs：`https://photo-match.jp/**`（旧プロジェクトに他の URL があれば同じものも）
- **Sign In / Providers → Email**：「Confirm email」などの設定を旧プロジェクトと同じに
- **Emails → Templates**：確認メール・パスワード再設定メールの文面を変えていれば、同じ文面を貼る
- **Emails → SMTP Settings**：独自の送信元（Resend など）を設定していれば、同じ内容を入れる
- **Rate Limits** などを変えていれば、同じ値に

## 3. データベースを移す

### 3-1. 予約を一時的に止める（切り替え中の予約が消えないように）

**旧プロジェクト**の SQL Editor で、全カメラマンの予約受付を一時停止する（本人の「休止」と同じ扱い）。元から休止していた人を控えておくため、先に一覧を保存する。

```sql
-- 元から休止中の人（再開しない人）を控える
select id, name from photographers where is_paused = true;

-- 全員を一時停止
update photographers set is_paused = true;
```

### 3-2. 旧プロジェクトからダンプする（作業用パソコンのターミナルで）

```bash
export OLD_DB_URL='postgresql://postgres.<旧ref>:<旧パスワード>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'
export NEW_DB_URL='postgresql://postgres.<新ref>:<新パスワード>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'

supabase db dump --db-url "$OLD_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$OLD_DB_URL" -f schema.sql
supabase db dump --db-url "$OLD_DB_URL" -f data.sql --use-copy --data-only
```

`data.sql` には、会員アカウント（`auth.users`。パスワードは暗号化された形）と、写真の登録情報（`storage.objects`）も含まれる。**このファイルは個人情報なので、作業が終わったら削除する。**

### 3-3. 新しいプロジェクトへ入れる

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$NEW_DB_URL"
```

エラーで止まった場合は、何も入っていない状態に戻る（`--single-transaction`）。エラー文を控えて相談する。

## 4. 写真ファイルをコピーする

データベースの移行では写真ファイルそのものは移らないので、スクリプトでコピーする（何度実行しても大丈夫）。

```bash
OLD_URL=https://hnknxfejotertwdvkhvk.supabase.co OLD_SERVICE_ROLE_KEY='<旧の service_role>' \
NEW_URL=https://<新ref>.supabase.co NEW_SERVICE_ROLE_KEY='<新の service_role>' \
node scripts/copy-storage.mjs
```

最後に「完了：◯件コピー、0件失敗」と出れば成功。

## 5. 新しいプロジェクトで仕上げの SQL を実行する

**新しいプロジェクト**の SQL Editor で、`<新ref>` を新しいプロジェクトの ref（URL の `https://` と `.supabase.co` の間）に置き換えて実行する。

```sql
-- 写真の URL を新しいプロジェクトに向け直す
alter table photographers drop constraint if exists photographers_photo_url_check;
update photographers
  set photo_url = replace(photo_url, 'https://hnknxfejotertwdvkhvk.supabase.co/', 'https://<新ref>.supabase.co/')
  where photo_url like 'https://hnknxfejotertwdvkhvk.supabase.co/%';
alter table photographers add constraint photographers_photo_url_check
  check (photo_url is null or photo_url ~ '^(assets/[A-Za-z0-9._-]+|https://<新ref>\.supabase\.co/storage/v1/object/public/photographer-photos/[A-Za-z0-9._/-]+)$') not valid;

-- 未確認の予約のチェック（10分ごと）を登録し直す（定期実行の設定はダンプに含まれないため）
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.unschedule('photomatch-ack-check') where exists (select 1 from cron.job where jobname = 'photomatch-ack-check');
select cron.schedule(
  'photomatch-ack-check',
  '*/10 * * * *',
  $job$select net.http_post(
    url := 'https://photo-match.jp/api/bookings/ack-check',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )$job$
);
```

Cloudflare に `CRON_SECRET` を設定している場合は、`headers` に `"X-Cron-Secret": "<その値>"` を加える（旧プロジェクトの SQL Editor で `select command from cron.job;` を実行すると、今の設定を確認できる）。

続けて、件数が旧プロジェクトと一致するか確かめる（旧・新の両方で実行して比べる）。

```sql
select
  (select count(*) from auth.users) as users,
  (select count(*) from profiles) as profiles,
  (select count(*) from photographers) as photographers,
  (select count(*) from bookings) as bookings,
  (select count(*) from shifts) as shifts,
  (select count(*) from reviews) as reviews,
  (select count(*) from storage.objects) as photos;
```

## 6. サイトの接続先を切り替える

1. **Cloudflare Pages** → プロジェクト → 「設定 → 環境変数（本番）」で、`SUPABASE_SERVICE_ROLE_KEY` を**新しい service_role キー**に変える（保存しただけでは反映されないので、次の手順のデプロイで反映される）
2. 新しい **Project URL と anon public キー**を Claude に伝える → `js/config.js` と `supabase/schema.sql`（写真 URL のチェック）を書き換えてマージする
3. デプロイが終わったら、次を確認する
   - 運営・カメラマン・お客様のテストアカウントでログインできる
   - カメラマンの写真が表示される
   - 予約画面で空き枠が表示される（3-1 で止めているので、予約はまだできない）

## 7. 予約を再開する

**新しいプロジェクト**の SQL Editor で、3-1 で控えた「元から休止中の人」以外を再開する。

```sql
update photographers set is_paused = false
  where id not in ('（元から休止中だった人の id をカンマ区切りで）');
```

再開後、テスト用のアカウントで予約〜決済の画面まで進み、運営画面に予約が出ることを確認する。

## 8. 後片付け

- 作業用パソコンの `roles.sql` `schema.sql` `data.sql` を削除する（個人情報を含む）
- 旧プロジェクトは、問題がないことを 1〜2 週間確かめてから、一時停止（Pause）または削除する
- 旧プロジェクトのサービスロールキーを使っている場所が残っていないか確認する（Cloudflare の環境変数のみのはず）

## 変わらないもの（作業不要）

- Stripe（Webhook の送り先は `https://photo-match.jp/api/stripe/webhook` のまま）
- Resend（メール送信）、LINE、Google アナリティクス、Search Console
- Cloudflare の `SUPABASE_SERVICE_ROLE_KEY` 以外の環境変数
