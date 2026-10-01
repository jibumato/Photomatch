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
