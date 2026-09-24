// Server-side mirror of js/data.js pricing constants. Amounts must be
// recomputed here rather than trusted from the client, so this file has to
// be kept in sync by hand whenever js/data.js's EXTRA_OPTIONS changes.
export const EXTRA_OPTIONS = [
  { key: 'fullData', label: '全データ納品', price: 3200 },
  { key: 'retouch', label: 'スキンレタッチ（美肌補正）', price: 3200 },
  { key: 'speed', label: 'スピード納品', price: 3200 },
  { key: 'reschedule', label: 'あんしん振替プラン', price: 2200 },
];

// カメラマンが受け取る割合（残りがPhotoMatchのプラットフォーム手数料）。
// js/data.js にも表示用のコピーがあるので、変更する場合は合わせて更新すること。
export const PHOTOGRAPHER_PAYOUT_RATE = 0.5;

export function optionsTotalFor(keys) {
  const selected = new Set(keys || []);
  return EXTRA_OPTIONS.filter((o) => selected.has(o.key)).reduce((sum, o) => sum + o.price, 0);
}
