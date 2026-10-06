// English strings for the customer-facing static pages: monitor.html,
// meeting-points.html, terms.html (legal pages), plus the leftovers on
// email-confirmed.html / reset-password.html. Registered into the main
// dictionary at import time (see registerDict in ../i18n.js) — import this
// file BEFORE the page's first t()/applyI18n(). `ja` values equal the
// Japanese text baked into the HTML / JS, byte for byte.
import { registerDict, t, getLang } from '../i18n.js';

registerDict({
  // -- shared by the static pages --
  'static.back': { ja: '← トップに戻る', en: '← Back to Top' },

  // -- page <title> (applied via data-i18n on the <title> element) --
  'monitor.pageTitle': { ja: 'モニター価格プラン募集 | PhotoMatch', en: 'Monitor Pricing Plan | PhotoMatch' },
  'meeting.pageTitle': { ja: '集合場所 | PhotoMatch', en: 'Meeting Points | PhotoMatch' },
  'confirm.pageTitle': { ja: 'メールアドレスの確認 | PhotoMatch', en: 'Confirm Your Email | PhotoMatch' },
  'reset.pageTitle': { ja: 'パスワード再設定 | PhotoMatch', en: 'Reset Password | PhotoMatch' },
  // -- meta descriptions (applied by setMetaDescription) --
  'monitor.metaDesc': {
    ja: 'PhotoMatchのモニター価格プランのご案内。先着10名限定、スタンダードプランが半額¥4,400（税込）、スマホプランが半額¥3,400（税込）でご利用いただけます。',
    en: 'Monitor pricing for PhotoMatch. Limited to the first 10 applicants: the Standard Plan at half price, ¥4,400 (tax incl.), and the Smartphone Plan at half price, ¥3,400 (tax incl.).',
  },
  'meeting.metaDesc': {
    ja: '名古屋・岐阜の集合場所と、撮影当日の流れ・持ち物・服装のご案内です。予約後の詳細はサイト内チャットでもご案内します。',
    en: 'Meeting points in Nagoya and Gifu, plus what to expect, bring, and wear on your shoot day. After you book, we also share details through in-site chat.',
  },

  'legal.metaDesc': {
    ja: 'PhotoMatchの利用規約、プライバシーポリシー、特定商取引法に基づく表記、運営会社情報です。',
    en: "PhotoMatch's Terms of Service, Privacy Policy, notation based on the Act on Specified Commercial Transactions, and company information.",
  },

  // -- reset-password.html leftovers --
  'reset.update.password2Placeholder': { ja: 'もう一度入力', en: 'Re-enter password' },

  // -- monitor.html --
  'monitor.badge': { ja: '先着10名限定', en: 'First 10 applicants only' },
  'monitor.title': { ja: 'モニター価格プラン募集', en: 'Monitor Pricing Plan: Now Recruiting' },
  'monitor.lead': {
    ja: 'スタンダードプラン（45分・20枚納品）を<b style="color:oklch(0.35 0.02 235)">半額の¥4,400（税込）</b>、スマホプラン（45分・20枚納品・スマホ撮影）を<b style="color:oklch(0.35 0.02 235)">半額の¥3,400（税込）</b>でご利用いただけます。マッチングアプリの写真を変えた前後の変化を教えていただく、モニター企画です。',
    en: 'Get the Standard Plan (45 min · 20 photos delivered) at <b style="color:oklch(0.35 0.02 235)">half price: ¥4,400 (tax incl.)</b>, or the Smartphone Plan (45 min · 20 photos delivered · shot on smartphone) at <b style="color:oklch(0.35 0.02 235)">half price: ¥3,400 (tax incl.)</b>. In return, we ask you to tell us how things change before and after you update your dating-app photos.',
  },
  'monitor.eligible.title': { ja: 'ご応募いただける方', en: 'Who Can Apply' },
  'monitor.note.title': { ja: 'モニター企画についての注意事項', en: 'Please Note About This Program' },
  'monitor.note.body': {
    ja: '定員（先着10名）に達し次第、募集を締め切らせていただきます。審査（ご応募内容の確認）があり、必ずしもご利用いただけるとは限りません。撮影から約1ヶ月後、任意でマッチング数の変化についてアンケートへのご協力をお願いする場合があります（ご協力いただいた方には特典をご用意予定です）。',
    en: 'Applications close as soon as the limit (first 10 applicants) is reached. Applications are screened (we review what you submit), so we cannot guarantee that everyone will be accepted. About one month after your shoot, we may ask you to take an optional survey about how your match numbers changed (we plan to offer a perk to those who take part).',
  },
  'monitor.form.title': { ja: '応募フォーム', en: 'Application Form' },
  'monitor.form.apps.label': { ja: '現在使用中のマッチングアプリ（任意）', en: 'Dating apps you currently use (optional)' },
  'monitor.form.apps.placeholder': { ja: '例）Pairs、with など', en: 'e.g. Pairs, with' },
  'monitor.form.motivation.label': { ja: '応募理由・ひとこと（任意）', en: 'Why you are applying / a few words (optional)' },
  'monitor.form.motivation.placeholder': { ja: 'モニター企画に応募した理由などをご自由にご記入ください', en: 'Tell us anything you like, such as why you are applying' },
  'monitor.form.hasPhotos.a': { ja: '現在マッチングアプリで使用中の写真がある', en: 'I have photos I am currently using on a dating app' },
  'monitor.form.hasPhotos.b': { ja: '（施策前後の比較にご協力いただきます）', en: ' (you will help us compare before and after)' },
  'monitor.form.followUp': { ja: '撮影から約1ヶ月後の任意アンケートに協力できる', en: 'I can take the optional survey about one month after my shoot' },
  'monitor.form.submit': { ja: '応募する', en: 'Apply' },
  'monitor.form.photosRequired': { ja: '現在使用中の写真がある方のみご応募いただけます。', en: 'Only people who currently have photos in use on a dating app can apply.' },
  'monitor.form.failed': { ja: '応募に失敗しました。時間をおいて再度お試しください。', en: 'Your application could not be sent. Please try again shortly.' },
  'monitor.slotsLeft': { ja: '残り {left}名（先着{cap}名）', en: '{left} spots left (first {cap} applicants)' },
  'monitor.login.title': { ja: '応募にはログインが必要です', en: 'Log in to apply' },
  'monitor.login.body': { ja: '施策前後のマッチング数を比較するため、アカウントに紐づけてご応募いただいています。', en: 'To compare your match numbers before and after, applications are linked to your account.' },
  'monitor.login.cta': { ja: 'ログイン / 新規登録して応募する', en: 'Log in / sign up to apply' },
  'monitor.closed.title': { ja: '定員に達したため、募集を締め切りました', en: 'Applications are closed: the limit has been reached' },
  'monitor.closed.body': { ja: '先着{cap}名の募集は終了しました。たくさんのご応募ありがとうございました。通常のプランは引き続きご予約いただけます。', en: 'Applications for the first {cap} applicants have ended. Thank you for the many applications. Our regular plans are still open for booking.' },
  'monitor.status.applied': { ja: '審査中', en: 'Under review' },
  'monitor.status.accepted': { ja: '当選', en: 'Accepted' },
  'monitor.status.rejected': { ja: '落選', en: 'Not selected' },
  'monitor.status.completed': { ja: '撮影完了', en: 'Shoot completed' },
  'monitor.status.appliedOn': { ja: '応募日: {date}', en: 'Applied: {date}' },
  'monitor.status.acceptedBody': {
    ja: '当選おめでとうございます。{link}から、スタンダードまたはスマホプランをご予約ください。お支払い画面でモニター価格（半額）が自動で適用されます（1回限り）。',
    en: "Congratulations, you've been selected! Please book the Standard or Smartphone Plan via {link}. The monitor price (half price) is applied automatically on the payment screen (one booking only).",
  },
  'monitor.status.findLink': { ja: 'カメラマンを探す', en: 'Find a Photographer' },
  'monitor.status.rejectedBody': { ja: '今回はご希望に添えない結果となりました。ご応募ありがとうございました。', en: "Unfortunately we couldn't offer you a spot this time. Thank you for applying." },
  'monitor.status.appliedBody': { ja: 'すでにモニター企画にご応募いただいています。審査結果はメールでご連絡します。', en: "You've already applied to the monitor program. We'll email you the result." },

  // -- meeting-points.html --
  'meeting.title': { ja: '集合場所', en: 'Meeting Points' },
  'meeting.lead': { ja: '対応エリアごとの集合場所です。予約完了後、詳細はサイト内チャットでもご案内します。', en: 'Meeting points for each service area. After you book, we also share details through in-site chat.' },
  'meeting.late': {
    ja: '集合時間に15分以上遅れた場合、キャンセル扱いとなることがあり、その際の返金はできません。時間に余裕を持ってお越しください。',
    en: 'If you arrive 15 minutes or more after the meeting time, your booking may be treated as a cancellation and cannot be refunded. Please allow plenty of time.',
  },
  'meeting.day.title': { ja: '撮影当日について', en: 'About Your Shoot Day' },
  'meeting.day.flow.h': { ja: '当日の流れ', en: 'How the Day Goes' },
  'meeting.day.flow.b': {
    ja: '集合場所でご挨拶・撮影イメージの確認 → 撮影(ポーズや表情はカメラマンがリード) → その場で解散。レタッチ済みデータは後日メールでお届けします。',
    en: 'Greet your photographer at the meeting point and go over the look you want → shoot (your photographer guides your poses and expressions) → we wrap up on the spot. Retouched photos are delivered by email afterward.',
  },
  'meeting.day.bring.h': { ja: '持ち物', en: 'What to Bring' },
  'meeting.day.bring.b': {
    ja: '特別な持ち物は不要です。着替えたい服があれば他1〜2着、リップやヘアアイテムなど身だしなみを整えるものがあると安心です。',
    en: 'No special items are needed. If you would like to change outfits, bring one or two extra tops or outfits. Grooming items such as lip balm or hair products are also handy.',
  },
  'meeting.day.wear.h': { ja: '服装アドバイス', en: 'What to Wear' },
  'meeting.day.wear.b': {
    ja: '清潔感のある普段着がおすすめです。白・ネイビー・ベージュなど明るめの無地は写真映えします。過度な柄物や暗い色は避けると仕上がりが良くなります。',
    en: 'Clean, neat everyday clothes are best. Light solid colors such as white, navy, or beige photograph well. Avoiding busy patterns and dark colors gives a better result.',
  },
  'meeting.areaTitle': { ja: '{label}エリア', en: '{label} Area' },

  // -- terms.html (legal pages) --
  'legal.courtesy': {
    ja: 'This is a courtesy translation; the Japanese version prevails.',
    en: 'This is a courtesy translation; the Japanese version prevails.',
  },
  'legal.proJaOnly': {
    ja: 'This page is available in Japanese only.',
    en: 'This page is available in Japanese only.',
  },
});

// English <meta name="description"> (the language toggle is a visitor
// preference, so only the live document is changed; the Japanese baked into
// the HTML remains what crawlers see).
export function setMetaDescription(key) {
  if (getLang() !== 'en') return;
  const value = t(key);
  const meta = document.querySelector('meta[name="description"]');
  if (meta && value !== key) meta.setAttribute('content', value);
}
