// Lightweight client-side language switch for the core booking journey
// (top page, search, profile, booking, login/reset-password, and the shared
// header/footer). Column articles, the legal pages (terms.html), meeting
// points, the monitor page, and mypage/admin/ops stay Japanese-only even
// with English selected — see README notes on those pages.
//
// There is no build step and no router, so this is intentionally simple:
// the choice is stored in localStorage, every page re-reads it on load, and
// switching languages reloads the current page so each page's own render
// logic re-runs from scratch. Booking progress survives that reload via the
// existing draft mechanism (see js/pages/booking.js).
//
// Static page text uses declarative data-i18n / data-i18n-placeholder
// attributes, applied by applyI18n(). Text built from data — e.g. plan
// cards, FAQ entries — is translated by the page's own JS calling t()/tf()
// directly against the dictionaries below.
//
// What this does NOT do: translate email notifications (functions/_lib —
// those are server-side and always Japanese), or change the page's <title>/
// meta description for SEO (this is a visitor preference toggle, not a
// separate indexable /en/ URL).

const STORAGE_KEY = 'pm_lang';

export function getLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ja';
  } catch (e) {
    return 'ja';
  }
}

export function setLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang === 'en' ? 'en' : 'ja');
  } catch (e) {
    /* storage unavailable: the toggle just won't persist */
  }
}

// ---- static UI string dictionary (data-i18n keys) ----
// Keep keys grouped by page/component so a missing translation is easy to
// spot in review. Falls back to the key itself if a translation is missing,
// so a typo shows up as visibly wrong text rather than a blank.
const DICT = {
  // -- header / footer (js/layout.js) --
  'nav.search': { ja: 'カメラマンを探す', en: 'Find a Photographer' },
  'nav.meeting': { ja: '集合場所', en: 'Meeting Points' },
  'nav.column': { ja: 'コラム', en: 'Column' },
  'nav.faq': { ja: 'よくある質問', en: 'FAQ' },
  'nav.login': { ja: 'ログイン', en: 'Log In' },
  'nav.mypage': { ja: 'マイページ', en: 'My Page' },
  'nav.cta': { ja: '撮影を予約する', en: 'Book a Session' },
  'nav.menu': { ja: 'メニュー', en: 'Menu' },
  'footer.tagline': { ja: '名古屋発、マッチングアプリ写真専門サービス', en: 'Nagoya-based dating-app photo service' },
  'footer.serviceInfo': { ja: 'サービス情報', en: 'Service Info' },
  'footer.company': { ja: '運営会社', en: 'Company' },
  'footer.column': { ja: 'コラム', en: 'Column (Japanese)' },
  'footer.monitor': { ja: 'モニター価格プラン募集', en: 'Monitor Pricing (Japanese)' },
  'footer.tokushoho': { ja: '特定商取引法に基づく表記', en: 'Legal Notice (Japanese)' },
  'footer.privacy': { ja: 'プライバシーポリシー', en: 'Privacy Policy (Japanese)' },
  'footer.terms': { ja: '利用規約', en: 'Terms of Service (Japanese)' },
  'lang.toggle.label': { ja: 'English', en: '日本語' },

  // -- login.html --
  'login.title.login': { ja: 'ログイン', en: 'Log In' },
  'login.title.signup': { ja: '新規登録', en: 'Sign Up' },
  'login.lead': { ja: 'マイページから予約情報を確認できます。', en: 'Log in to view and manage your bookings.' },
  'login.field.name': { ja: 'お名前', en: 'Name' },
  'login.field.email': { ja: 'メールアドレス', en: 'Email Address' },
  'login.field.password': { ja: 'パスワード', en: 'Password' },
  'login.submit.login': { ja: 'ログイン', en: 'Log In' },
  'login.submit.signup': { ja: '登録する', en: 'Sign Up' },
  'login.forgot': { ja: 'パスワードをお忘れの方', en: 'Forgot your password?' },
  'login.toggle.toSignup.prefix': { ja: 'アカウントをお持ちでない方は ', en: "Don't have an account? " },
  'login.toggle.toSignup.link': { ja: '新規登録', en: 'Sign up' },
  'login.toggle.toLogin.prefix': { ja: 'すでにアカウントをお持ちの方は ', en: 'Already have an account? ' },
  'login.toggle.toLogin.link': { ja: 'ログイン', en: 'Log in' },
  'login.signupConfirmSent': { ja: '{email} に確認メールをお送りしました。メール内のリンクを開くと登録が完了します。', en: "We've sent a confirmation email to {email}. Open the link inside it to finish signing up." },
  'login.genericError': { ja: 'メールアドレスまたはパスワードが正しくありません。', en: 'Incorrect email or password.' },

  // -- reset-password.html --
  'reset.back': { ja: '← ログインに戻る', en: '← Back to Log In' },
  'reset.title': { ja: 'パスワード再設定', en: 'Reset Password' },
  'reset.request.lead': { ja: 'ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。', en: 'Enter the email address on your account and we will send you a link to reset your password.' },
  'reset.request.emailLabel': { ja: 'メールアドレス', en: 'Email Address' },
  'reset.request.button': { ja: '再設定メールを送る', en: 'Send Reset Email' },
  'reset.update.lead': { ja: '新しいパスワードを入力してください。', en: 'Please enter a new password.' },
  'reset.update.passwordLabel': { ja: '新しいパスワード', en: 'New Password' },
  'reset.update.password2Label': { ja: '新しいパスワード（確認）', en: 'Confirm New Password' },
  'reset.update.button': { ja: 'パスワードを変更する', en: 'Change Password' },
  'reset.request.emailInvalid': { ja: 'メールアドレスを正しくご記入ください。', en: 'Please enter a valid email address.' },
  'reset.request.doneTitle': { ja: 'メールを送信しました', en: 'Email sent' },
  'reset.request.doneBody': { ja: '{email} がご登録済みの場合、パスワード再設定用のリンクをお送りしました。メール内のリンクを開いて、新しいパスワードを設定してください。届かない場合は迷惑メールフォルダもご確認ください。', en: "If {email} is registered with us, we've sent a password reset link to it. Open the link in the email to set a new password. If it doesn't arrive, please check your spam folder too." },
  'reset.request.resendButton': { ja: 'もう一度送る', en: 'Send again' },
  'reset.request.rateLimited': { ja: '短時間に何度も送信されています。数分おいてから再度お試しください。', en: 'Too many requests in a short time. Please wait a few minutes and try again.' },
  'reset.request.sendFailed': { ja: '送信に失敗しました。時間をおいて再度お試しください。', en: 'Failed to send. Please try again shortly.' },
  'reset.update.passwordTooShort': { ja: 'パスワードは6文字以上でご記入ください。', en: 'Password must be at least 6 characters.' },
  'reset.update.passwordMismatch': { ja: '確認用のパスワードが一致しません。', en: 'The passwords do not match.' },
  'reset.update.samePassword': { ja: '以前と同じパスワードは使えません。別のパスワードをご入力ください。', en: 'You cannot reuse your previous password. Please choose a different one.' },
  'reset.update.linkExpired': { ja: 'リンクの有効期限が切れています。お手数ですが、再設定メールをもう一度お送りください。', en: 'This link has expired. Please request a new password reset email.' },
  'reset.update.failed': { ja: 'パスワードを変更できませんでした。時間をおいて再度お試しください。', en: 'Could not change your password. Please try again shortly.' },
  'reset.link.invalidTitle': { ja: 'リンクが無効か、有効期限が切れています', en: 'This link is invalid or has expired' },
  'reset.link.invalidBody': { ja: 'お手数ですが、下のフォームから再設定メールをもう一度お送りください。', en: 'Please use the form below to send a new password reset email.' },
  'reset.link.expiredTitle': { ja: 'リンクの有効期限が切れています', en: 'This link has expired' },
  'reset.done.title': { ja: 'パスワードを変更しました', en: 'Password changed' },
  'reset.done.body': { ja: '自動的に移動します。移動しない場合は{link}。', en: "You'll be redirected automatically. If not, {link}." },
  'reset.done.linkText': { ja: 'こちら', en: 'click here' },
  'reset.backToBooking': { ja: '← ご予約に戻る', en: '← Back to Your Booking' },

  // -- search.html --
  'search.back': { ja: '← トップに戻る', en: '← Back to Top' },
  'search.title': { ja: 'カメラマンを探す', en: 'Find a Photographer' },
  'search.filter.area': { ja: '撮影エリア', en: 'Area' },
  'search.filter.conditions': { ja: 'こだわり条件', en: 'Preferences' },
  'search.filter.femaleOnly': { ja: '女性カメラマンのみ', en: 'Female photographers only' },
  'search.filter.femaleNote': { ja: '同伴者ありでの撮影もご相談いただけます。', en: "You're welcome to bring someone along to the shoot — just let us know." },
  'search.filter.englishOnly': { ja: '英語対応カメラマンのみ', en: 'English-speaking photographers only' },
  'search.filter.sort': { ja: '並び替え', en: 'Sort By' },
  'search.sort.recommended': { ja: 'おすすめ順', en: 'Recommended' },
  'search.sort.rating': { ja: '評価が高い順', en: 'Highest Rated' },
  'search.sort.reviews': { ja: 'レビューが多い順', en: 'Most Reviewed' },
  'search.filter.areaAll': { ja: 'すべて', en: 'All' },
  'search.badge.verified': { ja: '審査済', en: 'Verified' },
  'search.badge.english': { ja: '英語対応', en: 'English OK' },
  'search.empty.reset': { ja: '条件をリセットする', en: 'Reset filters' },
  'search.empty.title': { ja: '条件に合うカメラマンが見つかりませんでした。', en: 'No photographers match those filters.' },
  'search.filterToggle': { ja: '絞り込み・並び替え', en: 'Filter & Sort' },
  'search.filter.hint.open': { ja: '絞り込む ▾', en: 'Filter ▾' },
  'search.filter.hint.close': { ja: '閉じる ▴', en: 'Close ▴' },
  'search.loadError': { ja: 'カメラマン情報の取得に失敗しました。Supabaseの接続設定（js/config.js）をご確認ください。', en: 'Failed to load photographers. Please check the Supabase connection settings (js/config.js).' },
  'common.loading': { ja: '読み込み中…', en: 'Loading…' },

  // -- profile.html --
  'profile.back': { ja: '← 検索結果に戻る', en: '← Back to Results' },
  'profile.badge.verified': { ja: '審査済カメラマン', en: 'Verified Photographer' },
  'profile.badge.english': { ja: '英語対応', en: 'English OK' },
  'profile.plans': { ja: '料金プラン', en: 'Pricing Plans' },
  'profile.reviews': { ja: 'レビュー', en: 'Reviews' },
  'profile.reviewsEmpty': { ja: 'まだレビューはありません。', en: 'No reviews yet.' },
  'profile.plansEmpty': { ja: 'プラン情報がありません。', en: 'No plans available.' },
  'profile.bookThisPlan': { ja: 'このプランで予約', en: 'Book This Plan' },
  'profile.bookCta': { ja: '空き枠から予約する', en: 'View Availability & Book' },
  'profile.taxIncluded': { ja: '税込', en: 'tax incl.' },
  'profile.paused': { ja: '現在、こちらのカメラマンは新規のご予約受付を休止しています。', en: 'This photographer is not accepting new bookings right now.' },
  'profile.loadError': { ja: 'カメラマン情報の取得に失敗しました。', en: 'Failed to load photographer information.' },
  'profile.jaOnlyNote': { ja: '', en: 'Profile details below are shown as written by the photographer, in Japanese unless noted otherwise.' },
  'profile.bookHint': { ja: '空き枠を選ぶとその場で予約が確定します。', en: "Picking a time confirms your booking right away." },

  // -- booking.html --
  'booking.plan.back': { ja: '← プロフィールに戻る', en: '← Back to Profile' },
  'booking.plan.title': { ja: '撮影プランを選ぶ', en: 'Choose a Plan' },
  'booking.plan.loginNoteTitle': { ja: '会員登録について', en: 'About Creating an Account' },
  'booking.plan.loginNoteBody': { ja: '事前の会員登録は不要です。ご連絡先の入力画面でメールアドレスとパスワードを入れるだけで、そのまま登録・ご予約いただけます。', en: "No account needed up front — enter your email and a password on the contact step and you're registered and booked in one go." },
  'booking.slot.back': { ja: '← プラン選択に戻る', en: '← Back to Plans' },
  'booking.slot.title': { ja: '空き枠を選ぶ', en: 'Choose a Time' },
  'booking.slot.areaHeading': { ja: '撮影希望エリアを選ぶ', en: 'Choose a Shoot Area' },
  'booking.slot.scrollHint': { ja: '→ 表がはみ出す場合は横にスクロールしてご覧ください', en: '→ Scroll sideways if the table runs off the screen' },
  'booking.slot.legend.available': { ja: '予約可能', en: 'Available' },
  'booking.slot.legend.taken': { ja: '予約済み', en: 'Booked' },
  'booking.slot.legend.insufficient': { ja: '枠不足', en: 'Not enough time' },
  'booking.slot.loginNoteTitle': { ja: '会員登録について', en: 'About Creating an Account' },
  'booking.slot.loginNoteBody': { ja: '事前の会員登録は不要です。次の画面でメールアドレスとパスワードを入れるだけで、そのまま登録・ご予約いただけます。', en: "No account needed up front — enter your email and a password on the next step and you're registered and booked in one go." },
  'booking.contact.back': { ja: '← 枠選択に戻る', en: '← Back to Time Selection' },
  'booking.contact.title': { ja: 'ご連絡先を入力', en: 'Your Contact Details' },
  'booking.contact.name': { ja: 'お名前', en: 'Name' },
  'booking.contact.namePlaceholder': { ja: '例）山田 太郎', en: 'e.g. Taro Yamada' },
  'booking.contact.nameError': { ja: 'お名前をご記入ください', en: 'Please enter your name' },
  'booking.contact.email': { ja: 'メールアドレス', en: 'Email Address' },
  'booking.contact.emailPlaceholder': { ja: '例）guest@example.com', en: 'e.g. guest@example.com' },
  'booking.contact.emailHint': { ja: '予約確定メールをお送りします。', en: "We'll send your booking confirmation here." },
  'booking.contact.loggedInEmailHint': { ja: 'ログイン中のアカウントのメールアドレスです。予約確定メールをこちらにお送りします。', en: "This is your logged-in account's email address. Your booking confirmation will be sent here." },
  'booking.contact.emailError': { ja: 'メールアドレスを正しくご記入ください', en: 'Please enter a valid email address' },
  'booking.contact.password': { ja: 'パスワード', en: 'Password' },
  'booking.contact.passwordPlaceholder': { ja: '6文字以上', en: '6+ characters' },
  'booking.contact.passwordHint': { ja: '初めての方はこのまま会員登録、登録済みの方はログインします（別ページへの移動はありません）。マイページでの予約確認・カメラマンとのメッセージに使います。', en: "First time here? This creates your account. Already registered? This logs you in — no separate page needed. You'll use it to check your booking and message the photographer." },
  'booking.contact.phone': { ja: '電話番号', en: 'Phone Number' },
  'booking.contact.optional': { ja: '任意', en: 'optional' },
  'booking.contact.phonePlaceholder': { ja: '当日の緊急連絡用（例）090-1234-5678', en: 'For day-of contact, e.g. 090-1234-5678' },
  'booking.contact.options': { ja: 'オプション（追加料金・任意）', en: 'Add-ons (extra charge, optional)' },
  'booking.contact.dayOfTitle': { ja: '撮影当日について', en: 'On the Day of Your Shoot' },
  'booking.contact.dayOfBody': { ja: '当日の流れ：集合場所でご挨拶・撮影イメージの確認 → 撮影 → その場で解散(データは後日メール)。<br>持ち物：特別なものは不要です。着替えたい服が1〜2着あると安心です。<br>服装：白・ネイビー・ベージュなど明るめの無地がおすすめです。', en: "What to expect: meet at the pickup point, quickly go over the look you want, shoot, then you're free to go (photos follow by email).<br>What to bring: nothing special — an extra outfit or two is nice to have.<br>What to wear: light, plain colors like white, navy, or beige tend to photograph best." },
  'booking.contact.cancelTitle': { ja: 'キャンセルポリシー', en: 'Cancellation Policy' },
  'booking.contact.cancelBody': { ja: '撮影日の3日前まで：無料 ／ 2日前：料金の50% ／ 前日・当日：料金の100%<br>集合時間に15分以上遅れた場合、キャンセル扱いとなることがあり、その際の返金はできません。', en: '3+ days before: free ／ 2 days before: 50% of the fee ／ the day before or same day: 100% of the fee.<br>Arriving more than 15 minutes late may be treated as a same-day cancellation, which is non-refundable.' },
  'booking.contact.rescheduleTitle': { ja: '日程振替について', en: 'Rescheduling' },
  'booking.contact.rescheduleBody': { ja: '予約確定後にご都合で日程を振り替える場合、別途5,400円（税込）がかかります。「あんしん振替プラン」（+¥4,800）にご加入の場合は1回まで無料です。', en: 'Rescheduling after your booking is confirmed costs an extra ¥5,400 (tax incl.). With the Peace-of-Mind Reschedule Plan (+¥4,800), the first time is free.' },
  'booking.confirm.sheetNote': { ja: '', en: 'This questionnaire is only available in Japanese.' },
  'booking.contact.submit': { ja: 'お支払いへ進む', en: 'Continue to Payment' },
  'booking.contact.total': { ja: '合計（税込）', en: 'Total (tax incl.)' },
  'booking.payment.back': { ja: '← 連絡先入力に戻る', en: '← Back to Contact Details' },
  'booking.payment.title': { ja: 'お支払い', en: 'Payment' },
  'booking.payment.lead': { ja: 'ご予約時に全額をお支払いいただきます。決済はクレジットカードに対応しています。', en: 'Full payment is collected at booking, by credit card.' },
  'booking.payment.stripeNote': { ja: 'Stripeの決済ページへ移動します。カード情報はPhotoMatchのサーバーを経由しません。', en: "You'll be taken to Stripe's secure payment page. Your card details never pass through PhotoMatch's servers." },
  'booking.payment.cancelTitle': { ja: 'キャンセルポリシー', en: 'Cancellation Policy' },
  'booking.payment.cancelBody': { ja: '撮影日の3日前まで：無料 ／ 2日前：料金の50% ／ 前日・当日：料金の100%', en: '3+ days before: free ／ 2 days before: 50% of the fee ／ the day before or same day: 100% of the fee.' },
  'booking.payment.submit': { ja: 'Stripeの決済ページへ進む', en: "Continue to Stripe" },
  'booking.confirm.title': { ja: 'お支払い・ご予約が完了しました', en: 'Payment Complete — Booking Confirmed' },
  'booking.confirm.detailsTitle': { ja: '予約内容', en: 'Booking Details' },
  'booking.confirm.sheetTitle': { ja: '📋 事前カウンセリングシート', en: '📋 Pre-Shoot Questionnaire' },
  'booking.confirm.sheetBody': { ja: '当日をスムーズに、そして理想の1枚に近づけるために、撮影のご希望をお聞かせください（全問任意・わかる範囲でOK）。', en: 'Tell us what you have in mind so the shoot goes smoothly (every question is optional — answer what you can).' },
  'booking.confirm.sheetButton': { ja: 'カウンセリングシートに回答する', en: 'Fill Out the Questionnaire' },
  'booking.confirm.home': { ja: 'トップに戻る', en: 'Back to Top' },
  'booking.paused': { ja: '現在、こちらのカメラマンは新規のご予約受付を休止しています。お手数ですが他のカメラマンをお探しください。', en: 'This photographer is not accepting new bookings right now — please choose another photographer.' },
  'booking.loadError': { ja: '情報の取得に失敗しました。時間をおいて再度お試しください。', en: 'Failed to load booking information. Please try again shortly.' },

  // -- booking.js: templated / dynamic strings (tf()) --
  'booking.plan.intro': { ja: '{name}さんのプランから選択してください。所要時間分の枠を次のステップで押さえます。', en: "Choose a plan from {name}. You'll pick the time slot in the next step." },
  'booking.slot.planLine': { ja: '{plan}（{duration}分）・空いている時間をタップして、ご連絡先の入力へ進みます。', en: '{plan} ({duration} min) · Tap an open time to continue to your contact details.' },
  'booking.slot.weatherLoading': { ja: '天気予報を取得中…', en: 'Loading forecast…' },
  'booking.slot.weatherFor': { ja: '天気予報は「{area}」の予報です。', en: 'The forecast shown is for {area}.' },
  'booking.slot.weatherFailed': { ja: '天気予報を取得できませんでした。', en: "Couldn't load the weather forecast." },
  'booking.slot.windowNote': { ja: 'ご予約は3日後から30日先まで承っています。', en: 'Bookings are open from 3 to 30 days from today.' },
  'booking.contact.summary': { ja: '{name}さん ・ {plan}（{duration}分）<br>{date}（{day}） {start}〜{end}<br>撮影エリア：{area}', en: '{name} ・ {plan} ({duration} min)<br>{date} ({day}) {start}–{end}<br>Shoot area: {area}' },
  'booking.contact.passwordTooShort': { ja: 'パスワードは6文字以上でご記入ください', en: 'Password must be at least 6 characters' },
  'booking.contact.wrongPassword': { ja: 'このメールアドレスは登録済みです。登録時のパスワードをご入力ください。', en: "This email is already registered. Please enter the password you signed up with." },
  'booking.contact.forgotTitle': { ja: 'パスワードをお忘れの方', en: 'Forgot your password?' },
  'booking.contact.forgotLink': { ja: 'パスワードを再設定する', en: 'Reset your password' },
  'booking.contact.forgotSuffix': { ja: '（入力内容は保持されます）', en: ' (your entries will be kept)' },
  'booking.contact.confirmEmailTitle': { ja: 'メールアドレスの確認をお願いします', en: 'Please confirm your email' },
  'booking.contact.confirmEmailBody': { ja: '{email} に確認メールをお送りしました。メール内のリンクを開くと、入力内容をそのままにお支払いへ進めます（このブラウザで開いてください）。', en: "We've sent a confirmation email to {email}. Open the link inside it (in this same browser) to continue straight to payment with everything you've entered kept." },
  'booking.contact.resendLink': { ja: '確認メールを再送する', en: 'Resend the confirmation email' },
  'booking.contact.resendDone': { ja: '再送しました', en: 'Resent' },
  'booking.contact.resendFailed': { ja: '再送できませんでした。しばらくしてからお試しください', en: 'Could not resend — please try again shortly' },
  'booking.contact.rateLimited': { ja: '短時間にお試しいただいた回数が多すぎます。数分おいてから再度お試しください。', en: 'Too many attempts in a short time. Please wait a few minutes and try again.' },
  'booking.contact.authFailed': { ja: 'ログイン・登録に失敗しました。時間をおいて再度お試しください。', en: 'Log in / sign-up failed. Please try again shortly.' },
  'booking.payment.summaryDuration': { ja: '{plan}（{duration}分）', en: '{plan} ({duration} min)' },
  'booking.payment.optionLine': { ja: '＋{label}', en: '+ {label}' },
  'booking.payment.locationLine': { ja: '{name}さん ・ {area} ・ {date}（{day}） {start}〜{end}', en: '{name} ・ {area} ・ {date} ({day}) {start}–{end}' },
  'booking.payment.submitLabel': { ja: '{total} を支払って予約を確定', en: 'Pay {total} & Confirm Booking' },
  'booking.payment.loginRequired': { ja: 'ログインが必要です。', en: 'You need to be logged in.' },
  'booking.payment.checkoutFailed': { ja: '決済ページの作成に失敗しました。', en: 'Failed to create the payment page.' },
  'booking.payment.checkoutFailedRetry': { ja: '決済ページの作成に失敗しました。時間をおいて再度お試しください。', en: 'Failed to create the payment page. Please try again shortly.' },
  'booking.payment.canceledNotice': { ja: 'お支払いがキャンセルされました。内容をご確認の上、再度お試しください。', en: 'Payment was canceled. Please review the details and try again.' },
  'booking.confirm.lead': { ja: '{name}さんとの撮影が確定しました。当日は撮影場所で直接お待ち合わせください。', en: 'Your shoot with {name} is confirmed. Please meet directly at the shoot location on the day.' },
  'booking.confirm.optionLine': { ja: '＋オプション：{label}（+¥{price}）', en: '+ Add-on: {label} (+¥{price})' },
  'booking.confirm.photographer': { ja: 'カメラマン：{name}', en: 'Photographer: {name}' },
  'booking.confirm.area': { ja: '撮影エリア：{area}', en: 'Shoot area: {area}' },
  'booking.confirm.datetime': { ja: '日時：{date} {start}〜{end}', en: 'Date & time: {date} {start}–{end}' },
  'booking.confirm.plan': { ja: 'プラン：{plan}（¥{price}　税込）', en: 'Plan: {plan} (¥{price}, tax incl.)' },
  'booking.confirm.total': { ja: 'お支払い合計：¥{total}（税込）', en: 'Total paid: ¥{total} (tax incl.)' },
  'booking.confirm.paidVia': { ja: 'お支払い：Stripeで決済完了', en: 'Payment: completed via Stripe' },
  'booking.confirm.customerName': { ja: 'お名前：{name}', en: 'Name: {name}' },
  'booking.confirm.customerContact': { ja: '連絡先：{contact}', en: 'Contact: {contact}' },
  'booking.confirm.sheetOpenTitle': { ja: '{date} {start}〜 ・ {name}さん', en: '{date} {start}– ・ {name}' },

  // -- index.html (top page) --
  'top.badge': { ja: '名古屋発、マッチングアプリ写真専門', en: 'Nagoya-based · Dating App Photography' },
  'top.h1.pre': { ja: 'その一枚が、', en: 'That one photo could be ' },
  'top.h1.highlight': { ja: '恋の始まり。', en: 'the start of something.' },
  'top.hero.lead': { ja: '待ち合わせから撮影終了まで、わずか45分。<br>あなたの街を舞台に、プロカメラマンが<br>最高の一枚を引き出します。', en: 'From meeting up to wrapping the shoot, just 45 minutes.<br>A professional photographer brings out your best shot,<br>right in your own city.' },
  'top.pains.pre': { ja: 'マッチしない原因、', en: "Not getting matches? " },
  'top.pains.highlight': { ja: '写真かもしれません。', en: 'It might be your photo.' },
  'top.pains.footer': { ja: 'ひとつでも当てはまったら、写真を変えるタイミングです。', en: "If even one of these sounds familiar, it's time for a new photo." },
  'top.apps.title': { ja: '主要マッチングアプリに対応', en: 'Works With All the Major Apps' },
  'top.apps.desc': { ja: 'どのアプリのメイン写真・サブ写真にも使える一枚を撮影します。', en: "We shoot photos that work as your main or secondary picture on any app." },
  'top.apps.footnote': { ja: '上記以外のアプリでもご相談いただけます。', en: "Using a different app? Just ask — we can likely help." },
  'top.solution.title': { ja: 'PhotoMatchが選ばれる理由', en: 'Why PhotoMatch' },
  'top.solution.desc': { ja: '審査済みカメラマンが、名古屋中心部・岐阜・一宮の街で撮影します', en: 'Vetted photographers, shooting on location in central Nagoya, Gifu, and Ichinomiya' },
  'top.reason1.title': { ja: '審査済みカメラマンのみ', en: 'Vetted Photographers Only' },
  'top.reason1.desc': { ja: 'マッチングアプリ向け撮影の経験とコミュニケーション研修を通過したカメラマンだけを掲載しています。', en: 'Every photographer listed has dating-app shoot experience and has passed our communication training.' },
  'top.reason2.title': { ja: 'マッチング数保証', en: 'Match-Count Guarantee' },
  'top.reason2.desc': { ja: 'サイト経由の予約なら、1ヶ月運用してもマッチング数が増えなかった場合、無料で再撮影します。', en: "Book through the site and if your match count hasn't improved after a month, we'll reshoot for free." },
  'top.reason3.title': { ja: '料金を事前に明示', en: 'Upfront Pricing' },
  'top.reason3.desc': { ja: 'プラン料金・納品枚数・所要時間を予約前に確認でき、当日の認識違いを防ぎます。', en: 'See the plan price, photo count, and duration before you book — no surprises on the day.' },
  'top.reason4.title': { ja: '撮影許可の取得も対応', en: 'Location Permits Handled for You' },
  'top.reason4.desc': { ja: 'ロケーション撮影に必要な許可取得は運営・カメラマン側で対応。お客様は手間なく当日を迎えられます。', en: 'We take care of any permits the shoot location needs, so you can just show up.' },
  'top.solution.ctaNote': { ja: '空き枠の確認は会員登録なしでできます', en: 'No account needed to check availability' },
  // STATS/TESTIMONIALS/TARGET_PAINS/HOW_IT_WORKS/SAFETY_POINTS/FAQS/PRICING_PLANS
  // text lives alongside its Japanese source as additive *En fields on the
  // arrays in js/data.js (see L() below) rather than here, so a translation
  // never drifts out of sync with the content it belongs to.
  'top.results.title': { ja: '名古屋エリアでの実績', en: 'Our Track Record in the Nagoya Area' },
  'top.voice.title': { ja: '利用者の口コミ', en: 'What Customers Say' },
  'top.results.sourceNote': { ja: '※撮影実績・評価・口コミは、代表カメラマンTAKUMIのこれまでの撮影活動（PhotoMatch開始前を含む）によるものです。', en: "※ These numbers, the rating, and the reviews reflect lead photographer TAKUMI's shooting career, including work before PhotoMatch launched." },
  'top.pricing.title': { ja: 'シンプルな料金プラン', en: 'Simple, Transparent Pricing' },
  'top.pricing.studioCompare': { ja: 'スタジオの婚活・プロフィール写真は相場 ', en: 'Studio matchmaking / profile photos typically run ' },
  'top.pricing.studioPrice': { ja: '¥20,000〜30,000', en: '¥20,000–30,000' },
  'top.pricing.ourPrice': { ja: 'PhotoMatchなら ¥6,800〜', en: 'With PhotoMatch, from ¥6,800' },
  'top.pricing.ctaNote': { ja: 'プランは予約画面でも選べます', en: "You can also choose a plan on the booking screen" },
  'top.monitor.badge': { ja: '先着10名', en: 'First 10' },
  'top.monitor.banner': { ja: 'モニター価格プラン募集中：スタンダードが半額¥4,900（税込）', en: 'Now recruiting monitors: Standard plan at half price, ¥4,900 (tax incl.)' },
  'top.monitor.link': { ja: '詳細を見る →', en: 'See details →' },
  'top.safety.title': { ja: '安心・安全への取り組み', en: 'Built for Peace of Mind' },
  'top.safety.desc': { ja: '初めての方も安心してご利用いただけるよう、運営が体制を整えています。', en: "We've put safeguards in place so first-time users can book with confidence." },
  'top.howItWorks.title': { ja: '初めてでも、迷いません', en: 'Simple, Even the First Time' },
  'top.howItWorks.desc': { ja: '予約から納品まで3ステップ。当日は手ぶらでお越しいただけます。', en: 'Three steps from booking to delivery — just show up on the day.' },
  'top.howItWorks.link': { ja: '集合場所・持ち物・服装のくわしい案内を見る', en: 'See details on meeting points, what to bring, and what to wear' },
  'top.faq.title': { ja: 'よくある質問', en: 'Frequently Asked Questions' },
  'top.finalCta.title': { ja: '次のマッチングは、この一枚から。', en: 'Your next match starts with this photo.' },
  'top.finalCta.desc': { ja: '名古屋エリアの審査済みカメラマンを、今すぐ比較できます。', en: 'Compare vetted photographers in the Nagoya area right now.' },
};

export function t(key) {
  const entry = DICT[key];
  if (!entry) return key;
  const lang = getLang();
  return entry[lang] || entry.ja || key;
}

// t() with {placeholder} substitution, for the sentences booking.js builds
// around a plan name, date, price, etc. — keeps the interpolation logic in
// one place instead of every call site building its own template branch.
export function tf(key, vars) {
  return t(key).replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
}

// Applies every data-i18n[-placeholder] element under `root` to the current
// language. Safe to call repeatedly (e.g. after an innerHTML rebuild).
export function applyI18n(root = document) {
  const lang = getLang();
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  // For the handful of spots that need inline markup (e.g. a <br> in a note
  // box). The dictionary strings involved are all authored by us, never user
  // input, so setting innerHTML here is safe.
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
}

// ---- small lookup tables for the fixed, small sets of DB-sourced strings
// that appear on in-scope pages (area names, availability labels, the
// handful of plan name/description pairs seeded in supabase/schema.sql).
// These intentionally do NOT restructure js/data.js's AREAS/EXTRA_OPTIONS
// (server-side Cloudflare Functions import those directly and match on the
// original Japanese .label), and they fall back to the original Japanese
// text for anything not in the map — a photographer's own free-text bio,
// custom plan names, etc. are never silently mistranslated or blanked.
const AREA_EN = {
  '名古屋エリア': 'Nagoya Area',
  '岐阜エリア': 'Gifu Area',
  '一宮エリア': 'Ichinomiya Area',
  '名古屋中心部・栄・名駅': 'Central Nagoya (Sakae / Nagoya Station)',
  '岐阜・一宮': 'Gifu / Ichinomiya',
};

const AVAILABILITY_EN = {
  '今週末 空きあり': 'Open this weekend',
  '来週 空きあり': 'Open next week',
  '今月 空きあり': 'Open this month',
  '今週末に空きあり': 'Open this weekend',
  '平日夕方に空きあり': 'Open weekday evenings',
};

const PLAN_NAME_EN = {
  'スマホプラン': 'Smartphone Plan',
  'スタンダード': 'Standard',
  'スタンダードプラス': 'Standard Plus',
  '結婚相談所': 'Matchmaking Agency',
};

const PLAN_DESC_EN = {
  '45分・10枚納品・スマホ撮影': '45 min · 10 photos delivered · shot on smartphone',
  '45分・20枚納品': '45 min · 20 photos delivered',
  '45分・20枚納品＋スマホ用5枚': '45 min · 20 photos delivered + 5 smartphone crops',
  '45分・10枚納品': '45 min · 10 photos delivered',
};

// Translates a fixed-vocabulary string via the given map when English is
// selected, otherwise (or when there's no entry) returns the original text.
function localize(map, ja) {
  if (!ja) return ja;
  return getLang() === 'en' ? (map[ja] || ja) : ja;
}

// Builds the parenthesized "(N reviews)" / "（N件）" bit used on search cards
// and the profile page — handled as one function rather than dictionary
// strings because the punctuation (full-width vs ASCII parens) and plural
// form both depend on the count and the language together.
export function reviewsCountLabel(n, long = false) {
  const count = n ?? 0;
  // English wants a space before the opening paren; Japanese full-width
  // parens already carry that visual spacing themselves.
  if (getLang() === 'en') return ` (${count} review${count === 1 ? '' : 's'})`;
  return long ? `（${count}件のレビュー）` : `（${count}件）`;
}

// "（税込）" / " (tax incl.)" — used wherever a price is immediately
// followed by the tax-included note; centralized so every call site gets
// the correct paren width and spacing for the language automatically.
export function taxIncludedSuffix() {
  return getLang() === 'en' ? ` (${t('profile.taxIncluded')})` : `（${t('profile.taxIncluded')}）`;
}

export const areaText = (ja) => localize(AREA_EN, ja);
export const availabilityText = (ja) => localize(AVAILABILITY_EN, ja);
export const planNameText = (ja) => localize(PLAN_NAME_EN, ja);
export const planDescText = (ja) => localize(PLAN_DESC_EN, ja);

// A photographer's bio/price_comment are free text the photographer wrote
// themselves — never machine-translated on their behalf. If they (or ops)
// have supplied an explicit English version (bio_en / price_comment_en),
// show that when English is selected; otherwise fall back to the Japanese.
export function localizedField(row, jaKey, enKey) {
  if (getLang() === 'en' && row && row[enKey]) return row[enKey];
  return row ? row[jaKey] : '';
}

// Generic version of localizedField for the js/data.js arrays that carry
// additive `<field>En` translations (STATS, TESTIMONIALS, HOW_IT_WORKS,
// SAFETY_POINTS, FAQS, PRICING_PLANS, AREAS, EXTRA_OPTIONS, …). Falls back to
// the Japanese field whenever no English override is present, so an
// untranslated or newly-added entry degrades to Japanese rather than blank.
export function L(obj, field) {
  if (!obj) return '';
  const enField = field + 'En';
  return (getLang() === 'en' && obj[enField]) ? obj[enField] : obj[field];
}
