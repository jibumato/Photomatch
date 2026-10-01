# Photomatch

## アカウント運用

ログインアカウントの権限（`profiles.role`）は1アカウントにつき1つで、`client`（お客様）/ `photographer`（カメラマン）/ `ops`（運営）のいずれか。1つのアカウントを複数の権限で兼ねることはできない。

| 用途 | ログイン画面 | 備考 |
|---|---|---|
| お客様 | `login.html` | 新規登録は誰でも可 |
| カメラマン | `pro-login.html` | 運営画面（`ops.html`）の「カメラマン登録」で作成して渡す。本人のセルフ登録も可 |
| 運営 | `ops-login.html` | 下記の手順で権限を付ける |

### 運営アカウント

- 運営用: `info.photomatch@gmail.com`（`ops`）。審査・送金確定・カメラマン登録に使う
- 動作確認用のカメラマンアカウント（`photographer`）は、運営者の個人メールアドレスで別に作成済み。管理画面（`admin.html`）の時間枠・振込先口座の確認に使う。メールアドレスは、リポジトリには記載しない

運営アカウントの作り方:

1. `login.html` から新規登録し、確認メールのリンクを開く
2. Supabase の SQL Editor で権限を付ける

```sql
update profiles set role = 'ops' where email = 'info.photomatch@gmail.com';
```

`profiles` はブラウザ（anon / authenticated）から更新できない設計。権限の変更は、SQL Editor または service_role からのみ行う。

### カメラマンの登録から公開まで

1. 運営が `ops.html` の「カメラマン登録」でアカウントを作り、メールアドレスと仮パスワードを本人に渡す（作成直後のプロフィールは非公開）
2. 本人が `pro-login.html` からログインし、管理画面（`admin.html`）の「プロフィール設定」で、写真・表示名・エリア・性別・ひとこと・紹介文・Instagram・英語対応を入力する。時間枠と振込先口座もここで設定する
3. 運営が `ops.html` の「カメラマンの掲載管理」で内容を確認し、「承認して公開する」を押す
   - 写真・表示名・エリア・性別・紹介文がそろっていないと公開できない（サーバー側でも確認）
   - 料金プランが未登録なら、公開時に標準の4プラン（`js/data.js` の `PRICING_PLANS`）を登録する。個別の料金にしたい場合は SQL Editor で `plans` を編集する

### 公開・非公開の仕組み

検索・予約に出るのは、次の2つを両方満たすときだけ。

| フラグ | 意味 | 変更できる人 |
|---|---|---|
| `is_visible` | 運営の承認（掲載の許可） | 運営のみ（掲載管理画面。`/api/photographers/visibility` 経由） |
| `is_paused` | 本人による一時休止 | 本人（管理画面の「予約受付を一時休止する」） |

運営が掲載を停止（`is_visible = false`）した場合、本人は再開できない。本人の休止中も、すでに入っている予約はそのまま。

本人が編集できるのは `name / area / gender / bio / price_comment / instagram / speaks_english / bio_en / price_comment_en / photo_url / is_paused` だけ（`supabase/schema.sql` の列単位の grant）。承認・評価・レビュー数などは運営のみ。写真は公開バケット `photographer-photos` の自分のフォルダに置かれる。
