// Supabase の移行用：旧プロジェクトのストレージ（写真ファイル）を新プロジェクトへコピーする。
// 手順は supabase/MIGRATION.md の「4. 写真ファイルをコピーする」。
//
// データベースの移行（pg_dump / supabase db dump）で storage.objects の行は移るが、
// ファイルそのものは移らないため、このスクリプトでコピーする。何度実行しても同じ結果になる
// （上書き）。サービスロールキーは秘密の値なので、環境変数で渡し、ファイルやチャットに書かない。
//
//   OLD_URL=https://<旧>.supabase.co OLD_SERVICE_ROLE_KEY=... \
//   NEW_URL=https://<新>.supabase.co NEW_SERVICE_ROLE_KEY=... \
//   node scripts/copy-storage.mjs

const BUCKETS = ['photographer-photos'];

const env = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`環境変数 ${k} がありません。supabase/MIGRATION.md を見てください。`); process.exit(1); }
  return v.replace(/\/$/, '');
};
const OLD = { url: env('OLD_URL'), key: env('OLD_SERVICE_ROLE_KEY') };
const NEW = { url: env('NEW_URL'), key: env('NEW_SERVICE_ROLE_KEY') };
const headers = (p, extra = {}) => ({ apikey: p.key, Authorization: `Bearer ${p.key}`, ...extra });
const enc = (path) => path.split('/').map(encodeURIComponent).join('/');

// バケット内のファイルを、フォルダをたどってすべて列挙する。
async function listAll(p, bucket, prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${p.url}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: headers(p, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!res.ok) throw new Error(`一覧の取得に失敗（${bucket}/${prefix}）：${res.status} ${await res.text()}`);
    const items = await res.json();
    for (const it of items) {
      const path = prefix ? `${prefix}/${it.name}` : it.name;
      if (it.id) files.push({ path, type: (it.metadata && it.metadata.mimetype) || 'application/octet-stream' });
      else files.push(...await listAll(p, bucket, path)); // フォルダ
    }
    if (items.length < 1000) break;
  }
  return files;
}

async function ensureBucket(bucket) {
  const res = await fetch(`${NEW.url}/storage/v1/bucket/${bucket}`, { headers: headers(NEW) });
  if (res.ok) return;
  const old = await fetch(`${OLD.url}/storage/v1/bucket/${bucket}`, { headers: headers(OLD) }).then((r) => r.json());
  const created = await fetch(`${NEW.url}/storage/v1/bucket`, {
    method: 'POST',
    headers: headers(NEW, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: bucket, name: bucket, public: !!old.public, file_size_limit: old.file_size_limit, allowed_mime_types: old.allowed_mime_types }),
  });
  if (!created.ok) throw new Error(`新しいプロジェクトにバケット ${bucket} を作れません：${created.status} ${await created.text()}`);
}

let copied = 0;
let failed = 0;
for (const bucket of BUCKETS) {
  await ensureBucket(bucket);
  const files = await listAll(OLD, bucket);
  console.log(`${bucket}: ${files.length} ファイル`);
  for (const f of files) {
    try {
      const get = await fetch(`${OLD.url}/storage/v1/object/${bucket}/${enc(f.path)}`, { headers: headers(OLD) });
      if (!get.ok) throw new Error(`ダウンロード ${get.status}`);
      const body = Buffer.from(await get.arrayBuffer());
      const put = await fetch(`${NEW.url}/storage/v1/object/${bucket}/${enc(f.path)}`, {
        method: 'POST',
        headers: headers(NEW, { 'Content-Type': f.type, 'x-upsert': 'true' }),
        body,
      });
      if (!put.ok) throw new Error(`アップロード ${put.status} ${await put.text()}`);
      copied += 1;
      console.log(`  ✓ ${f.path}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${f.path}：${err.message}`);
    }
  }
}
console.log(`完了：${copied} 件コピー、${failed} 件失敗`);
if (failed) process.exit(1);
