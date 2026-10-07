// Strings for the customer's My Page (mypage.html / js/pages/mypage.js) and the
// modals it opens: chat (js/chat.js), pre-shoot counseling sheet (js/sheet.js),
// reschedule (js/rescheduleModal.js) and review (js/reviewModal.js).
//
// Registered at import time — import this file BEFORE the first t()/tf() call:
//   import '../i18n/mypage.js';
// The `ja` entries are the wording the pages shipped with, so Japanese mode is
// unchanged. Text that comes from the server (error messages from
// functions/api/*) and user-entered data (names, messages, review comments,
// staff notes) is deliberately not translated.
import { registerDict } from '../i18n.js';

const ENTRIES = {
  // ---------- mypage.html (static) ----------
  'mypage.pageTitle': { ja: 'マイページ | PhotoMatch', en: 'My Page | PhotoMatch' },
  'mypage.loading': { ja: '読み込み中…', en: 'Loading…' },
  'mypage.title': { ja: 'マイページ', en: 'My Page' },
  'mypage.logout': { ja: 'ログアウト', en: 'Log Out' },
  'mypage.upcoming': { ja: '今後の予約', en: 'Upcoming Bookings' },
  'mypage.history': { ja: '過去の撮影履歴', en: 'Past Shoots' },

  // ---------- mypage.js ----------
  'mypage.guestName': { ja: 'ゲスト ユーザー', en: 'Guest' },
  'mypage.userLine': { ja: '{name}　（{email}）', en: '{name} ({email})' },
  'mypage.loadFailed': { ja: '予約情報の取得に失敗しました。', en: 'Could not load your bookings.' },
  'mypage.emptyUpcoming': { ja: '今後のご予約はありません。', en: 'You have no upcoming bookings.' },
  'mypage.emptyHistory': { ja: '撮影履歴はまだありません。', en: 'No past shoots yet.' },

  // booking status badges
  'mypage.status.pending_payment': { ja: '決済待ち', en: 'Awaiting Payment' },
  'mypage.status.paid': { ja: '確定', en: 'Confirmed' },
  'mypage.status.confirmed': { ja: '確定', en: 'Confirmed' },
  'mypage.status.requested': { ja: '依頼中', en: 'Requested' },
  'mypage.status.completed': { ja: '完了', en: 'Completed' },
  'mypage.status.canceled': { ja: 'キャンセル済', en: 'Canceled' },

  // booking card
  'mypage.dateLine': { ja: '{date}（{start}〜{end}）', en: '{date} ({start}–{end})' },
  'mypage.orderNumber': { ja: '注文番号：{n}', en: 'Order No. {n}' },
  'mypage.planLine': { ja: '{plan} ・ {price}', en: '{plan} · {price}' },
  'mypage.priceTaxIncl': { ja: '¥{amount}（税込）', en: '¥{amount} (tax incl.)' },
  'mypage.freeReshoot': { ja: '無料再撮影（マッチング数保証）', en: 'Free reshoot (Match-Count Guarantee)' },
  'mypage.btn.message': { ja: 'メッセージ', en: 'Message' },
  'mypage.btn.counseling': { ja: '事前カウンセリング', en: 'Pre-Shoot Counseling' },
  'mypage.btn.counselingDone': { ja: 'カウンセリング済', en: 'Counseling done' },
  'mypage.btn.reschedule': { ja: '日程変更', en: 'Reschedule' },
  'mypage.btn.cancel': { ja: 'キャンセル', en: 'Cancel' },
  'mypage.delivery.link': { ja: '📷 撮影データを見る（納品済み）↗', en: '📷 View your photos (delivered) ↗' },
  'mypage.staffPick': { ja: '異性スタッフのおすすめ', en: 'Opposite-Gender Staff Pick' },
  'mypage.rescheduledFrom': { ja: '日程変更済み（変更前：{date} {time}〜）', en: 'Rescheduled (previously: {date} {time})' },
  'mypage.noShowNote': { ja: '集合時間に15分以上遅れたため、当日キャンセル扱いとなりました（利用規約第5条）', en: 'Treated as a same-day cancellation because you were more than 15 minutes late to the meeting point (Terms, Article 5).' },
  'mypage.refund.done': { ja: 'ご返金：¥{amount}（カードへ返金済み）', en: 'Refund: ¥{amount} (refunded to your card)' },
  'mypage.refund.pending': { ja: 'ご返金：¥{amount}（運営より手続き中）', en: 'Refund: ¥{amount} (being processed by our team)' },

  // cancel flow
  'mypage.cancel.started': { ja: '撮影開始時刻を過ぎたため、マイページからはキャンセルできません。お問い合わせください。', en: 'The shoot start time has passed, so this booking can no longer be canceled from My Page. Please contact us.' },
  'mypage.cancel.confirmUnpaid': { ja: 'お支払い前のご予約をキャンセルします。よろしいですか？', en: 'This will cancel your unpaid booking. Continue?' },
  'mypage.cancel.confirm': {
    ja: 'このご予約をキャンセルします。\n\nキャンセル料：{fee}\nご返金額：{refund}\n\n※キャンセル料はプラン料金にかかり、オプション料金は全額返金します。\n※一度キャンセルすると取り消せません。\n\nキャンセルしますか？',
    en: 'This will cancel your booking.\n\nCancellation fee: {fee}\nRefund amount: {refund}\n\n* The cancellation fee applies to the plan fee only; option fees are fully refunded.\n* A canceled booking cannot be restored.\n\nCancel this booking?',
  },
  'mypage.cancel.doneCard': { ja: 'キャンセルしました。{refund}をご利用のカードへ返金しました（明細への反映まで数日〜2週間ほどかかる場合があります）。', en: 'Your booking has been canceled. {refund} has been refunded to your card (it may take a few days to 2 weeks to appear on your statement).' },
  'mypage.cancel.donePending': { ja: 'キャンセルしました。{refund}のご返金は、運営より順次お手続きします。', en: 'Your booking has been canceled. Our team will process your {refund} refund shortly.' },
  'mypage.cancel.failed': { ja: 'キャンセル処理に失敗しました。', en: 'Could not cancel the booking.' },

  // reschedule denied (mirrors RESCHEDULE_DENIED_MESSAGE in js/data.js)
  'mypage.reschedDenied.default': { ja: 'このご予約は日程変更できません。', en: 'This booking cannot be rescheduled.' },
  'mypage.reschedDenied.status': { ja: 'このご予約は日程変更できません。', en: 'This booking cannot be rescheduled.' },
  'mypage.reschedDenied.started': { ja: '撮影開始時刻を過ぎたご予約は、日程変更できません。お問い合わせください。', en: 'A booking whose start time has passed cannot be rescheduled. Please contact us.' },
  'mypage.reschedDenied.no_plan': { ja: '撮影日の2日前からの日程変更は、「あんしん振替プラン」にご加入の方のみ可能です。ご都合がつかない場合は、キャンセル（キャンセル規定どおり）をご利用ください。', en: 'From 2 days before your shoot, rescheduling is only available with the Peace-of-Mind Reschedule Plan. If you cannot make it, you can cancel under the cancellation policy.' },
  'mypage.reschedDenied.plan_used': { ja: '「あんしん振替プラン」の無料の日程変更は、1回までです。すでにご利用済みのため、これ以上は日程変更できません。', en: 'The Peace-of-Mind Reschedule Plan covers one free reschedule, and you have already used it, so this booking can no longer be rescheduled.' },

  // match-count guarantee
  'mypage.gu.prefix': { ja: 'マッチング数保証：', en: 'Match-Count Guarantee: ' },
  'mypage.gu.apply': { ja: 'マッチング数保証に申し込む', en: 'Apply for the Match-Count Guarantee' },
  'mypage.gu.appliedWait': { ja: 'マッチング数保証：申込み済み（{from}〜{to}の間に無料再撮影を申請できます）', en: 'Match-Count Guarantee: applied (you can request a free reshoot between {from} and {to})' },
  'mypage.gu.expired': { ja: 'マッチング数保証：申請期限（{deadline}）を過ぎました', en: 'Match-Count Guarantee: the request deadline ({deadline}) has passed' },
  'mypage.gu.claimBtn': { ja: '無料再撮影を申請する', en: 'Request a Free Reshoot' },
  'mypage.gu.deadline': { ja: '申請期限：{deadline}', en: 'Request by: {deadline}' },
  'mypage.gu.reviewing': { ja: '審査中', en: 'Under review' },
  'mypage.gu.approved': { ja: '承認済み（無料再撮影）', en: 'Approved (free reshoot)' },
  'mypage.gu.reshootBooked': { ja: '再撮影：{date} {time}〜（予約済み。「今後の予約」に表示されています）', en: 'Reshoot: {date} {time} (booked — shown under "Upcoming Bookings")' },
  'mypage.gu.pickReshoot': { ja: '再撮影の日程を選ぶ', en: 'Choose Reshoot Date' },
  'mypage.gu.rejected': { ja: '対象外', en: 'Not eligible' },
  'mypage.gu.applyConfirm': {
    ja: 'マッチング数保証に申し込みます。\n撮影日から30日後、マッチング数の改善が見られない場合に無料再撮影を申請できます。\n納品写真をマッチングアプリのメイン写真に設定したことをご確認のうえ、お申し込みください。\n\n申し込みますか？',
    en: "You're applying for the Match-Count Guarantee.\n30 days after your shoot, if your match count has not improved, you can request a free reshoot.\nPlease make sure you have set your delivered photos as your main photo on your dating app before applying.\n\nApply now?",
  },
  'mypage.gu.applyFailed': { ja: '申し込みに失敗しました。', en: 'Could not submit your application.' },
  'mypage.gu.claimPrompt': { ja: 'マッチング数に改善が見られなかった状況を簡単にご記入ください（未記入でも申請できます）。', en: 'Briefly describe how your match count has not improved (optional — you can submit without a note).' },
  'mypage.gu.claimFailed': { ja: '申請に失敗しました。', en: 'Could not submit your request.' },

  // review block on the booking card
  'mypage.review.thanks': { ja: 'ご利用ありがとうございました。撮影の感想をお寄せください。', en: 'Thank you for using PhotoMatch. We would love to hear how your shoot went.' },
  'mypage.review.write': { ja: 'レビューを書く', en: 'Write a Review' },
  'mypage.review.posted': { ja: 'レビュー投稿済み', en: 'Review posted' },
  'mypage.review.edit': { ja: '編集・削除', en: 'Edit / Delete' },
  'mypage.review.hidden': { ja: '※運営により非表示になっています。', en: '* This review has been hidden by our team.' },

  // labels passed to the modals
  'mypage.chatLabel': { ja: '{date} {start}〜', en: '{date} {start}' },
  'mypage.sheetLabel': { ja: '{date} {start}〜 ・ {name}さん', en: '{date} {start} · {name}' },

  // ---------- chat modal (js/chat.js) ----------
  'chat.placeholder': { ja: 'メッセージを入力…', en: 'Type a message…' },
  'chat.send': { ja: '送信', en: 'Send' },
  'chat.close': { ja: '閉じる', en: 'Close' },
  'chat.loading': { ja: '読み込み中…', en: 'Loading…' },
  'chat.empty': { ja: 'まだメッセージはありません。<br>気軽にごあいさつしてみましょう。', en: 'No messages yet.<br>Feel free to say hello!' },
  'chat.you': { ja: 'あなた', en: 'You' },
  'chat.photographer': { ja: 'カメラマン', en: 'Photographer' },
  'chat.client': { ja: '依頼者', en: 'Client' },
  'chat.withPhotographer': { ja: 'カメラマンとのチャット', en: 'Chat with your photographer' },
  'chat.withClient': { ja: '依頼者とのチャット', en: 'Chat with your client' },
  'chat.sendFailed': { ja: '送信に失敗しました。', en: 'Could not send your message.' },
  'chat.loadFailed': { ja: 'メッセージの取得に失敗しました。', en: 'Could not load messages.' },

  // ---------- counseling sheet modal (js/sheet.js) ----------
  'mypage.sheet.title': { ja: '事前カウンセリングシート', en: 'Pre-Shoot Counseling Sheet' },
  'mypage.sheet.intro': { ja: 'よろしければ撮影についてお聞かせください。すべて任意です。わかる範囲でご記入いただくと、当日の撮影がよりスムーズになります。', en: 'Tell us a little about what you have in mind for your shoot. Everything is optional — the more you share, the smoother your session will go.' },
  'mypage.sheet.later': { ja: 'あとで', en: 'Later' },
  'mypage.sheet.save': { ja: '回答を保存する', en: 'Save Answers' },
  'mypage.sheet.close': { ja: '閉じる', en: 'Close' },
  'mypage.sheet.saveFailed': { ja: '保存に失敗しました。時間をおいて再度お試しください。', en: 'Could not save. Please try again shortly.' },
  // questions (ids/options mirror COUNSELING_QUESTIONS in js/data.js; the
  // saved answers stay Japanese so photographers read them as before)
  'mypage.sheet.q.ageBand': { ja: '年代', en: 'Age range' },
  'mypage.sheet.q.ageBand.o0': { ja: '20代前半', en: 'Early 20s' },
  'mypage.sheet.q.ageBand.o1': { ja: '20代後半', en: 'Late 20s' },
  'mypage.sheet.q.ageBand.o2': { ja: '30代前半', en: 'Early 30s' },
  'mypage.sheet.q.ageBand.o3': { ja: '30代後半', en: 'Late 30s' },
  'mypage.sheet.q.ageBand.o4': { ja: '40代以上', en: '40s or older' },
  'mypage.sheet.q.apps': { ja: '主に使うマッチングアプリ・サービス', en: 'Main dating app / service you use' },
  'mypage.sheet.q.apps.o3': { ja: 'タップル', en: 'Tapple' },
  'mypage.sheet.q.apps.o6': { ja: '結婚相談所', en: 'Matchmaking agency' },
  'mypage.sheet.q.apps.o7': { ja: 'その他', en: 'Other' },
  'mypage.sheet.q.mainShot': { ja: 'メインで使いたい写真', en: 'Photo you want to use as your main' },
  'mypage.sheet.q.mainShot.o0': { ja: '正面の顔メイン', en: 'Face, front-on' },
  'mypage.sheet.q.mainShot.o1': { ja: '全身', en: 'Full body' },
  'mypage.sheet.q.mainShot.o2': { ja: '趣味の様子', en: 'Doing a hobby' },
  'mypage.sheet.q.mainShot.o3': { ja: 'おまかせ', en: 'Leave it to the photographer' },
  'mypage.sheet.q.impression': { ja: '叶えたい印象（複数選択可）', en: 'Impression you want to give (select all that apply)' },
  'mypage.sheet.q.impression.o0': { ja: '清潔感', en: 'Clean and neat' },
  'mypage.sheet.q.impression.o1': { ja: '親しみやすさ', en: 'Approachable' },
  'mypage.sheet.q.impression.o2': { ja: '誠実さ', en: 'Sincere' },
  'mypage.sheet.q.impression.o3': { ja: 'おしゃれ感', en: 'Stylish' },
  'mypage.sheet.q.impression.o4': { ja: '明るさ', en: 'Cheerful' },
  'mypage.sheet.q.mood': { ja: 'なりたい雰囲気', en: 'Vibe you are going for' },
  'mypage.sheet.q.mood.o0': { ja: '爽やか', en: 'Fresh' },
  'mypage.sheet.q.mood.o1': { ja: '落ち着き', en: 'Calm' },
  'mypage.sheet.q.mood.o2': { ja: '自然体', en: 'Natural' },
  'mypage.sheet.q.mood.o3': { ja: 'おまかせ', en: 'Leave it to the photographer' },
  'mypage.sheet.q.reference': { ja: '「こんな感じ」という参考イメージ（あれば）', en: 'A reference look you like (if any)' },
  'mypage.sheet.q.reference.ph': { ja: '例：休日にカフェで撮ったような自然な感じ', en: 'e.g. a natural look, like a photo taken at a café on a day off' },
  'mypage.sheet.q.avoid': { ja: '逆に避けたい写真の傾向（あれば）', en: 'Styles of photo you want to avoid (if any)' },
  'mypage.sheet.q.avoid.ph': { ja: '例：かしこまりすぎ・加工が強い など', en: 'e.g. too formal, heavily retouched' },
  'mypage.sheet.q.outfit': { ja: '当日の服装の予定', en: 'What you plan to wear' },
  'mypage.sheet.q.outfit.ph': { ja: '例：白シャツ＋ベージュのパンツ', en: 'e.g. white shirt and beige pants' },
  'mypage.sheet.q.change': { ja: '着替え（2着目）', en: 'Outfit change (second outfit)' },
  'mypage.sheet.q.change.o0': { ja: '持参する', en: "I'll bring one" },
  'mypage.sheet.q.change.o1': { ja: 'なし', en: 'No' },
  'mypage.sheet.q.change.o2': { ja: '未定', en: 'Not sure yet' },
  'mypage.sheet.q.items': { ja: '写したい小物（メガネ・帽子・アクセサリー等）', en: 'Items you want in the photos (glasses, hat, accessories, etc.)' },
  'mypage.sheet.q.items.ph': { ja: '例：黒縁メガネ', en: 'e.g. black-framed glasses' },
  'mypage.sheet.q.camera': { ja: '写真を撮られるのは得意ですか？', en: 'How comfortable are you in front of a camera?' },
  'mypage.sheet.q.camera.o0': { ja: '得意', en: 'Very comfortable' },
  'mypage.sheet.q.camera.o1': { ja: 'ふつう', en: 'Okay' },
  'mypage.sheet.q.camera.o2': { ja: '苦手なのでリードしてほしい', en: 'Not really — please guide me' },
  'mypage.sheet.q.concern': { ja: '気にしている部分・写り方の希望（あれば）', en: 'Anything you are self-conscious about, or how you want to look (if any)' },
  'mypage.sheet.q.concern.ph': { ja: '例：左側から撮られるのが好き', en: 'e.g. I prefer being photographed from my left side' },
  'mypage.sheet.q.other': { ja: 'その他、事前に伝えておきたいこと', en: 'Anything else you would like us to know beforehand' },
  'mypage.sheet.q.other.ph': { ja: '自由記入', en: 'Free text' },

  // ---------- reschedule modal (js/rescheduleModal.js) ----------
  'resched.title': { ja: '日程を変更する', en: 'Reschedule Your Shoot' },
  'resched.titleReshoot': { ja: '無料再撮影の日程を選ぶ', en: 'Choose a Date for Your Free Reshoot' },
  'resched.close': { ja: '閉じる', en: 'Close' },
  'resched.loading': { ja: '空き枠を読み込み中…', en: 'Loading available slots…' },
  'resched.pickDate': { ja: '日付を選ぶ', en: 'Choose a date' },
  'resched.pickTime': { ja: '開始時刻を選ぶ', en: 'Choose a start time' },
  'resched.save': { ja: 'この日時に変更する', en: 'Change to This Time' },
  'resched.saveReshoot': { ja: 'この日時で予約する', en: 'Book This Time' },
  'resched.noSlots': { ja: '現在、変更できる空き枠がありません。カメラマンが受付を開けるまでお待ちください。', en: 'There are no open slots to move to right now. Please check back once the photographer opens up more availability.' },
  'resched.dateFirst': { ja: '先に日付を選んでください。', en: 'Please choose a date first.' },
  'resched.selected': { ja: '{date}（{wd}） {start}〜{end}', en: '{date} ({wd}) {start}–{end}' },
  'resched.labelReshoot': { ja: '{name} ・ 元の撮影：{date}（{plan}）', en: '{name} · Original shoot: {date} ({plan})' },
  'resched.labelCurrent': { ja: '{name} ・ 現在：{date} {start}〜{end}', en: '{name} · Current: {date} {start}–{end}' },
  'resched.rule.reshoot': { ja: 'マッチング数保証による無料再撮影です。同じカメラマン・同じプランで、お支払いは不要です。カメラマンが受け付けている空き枠から選んでください。', en: 'This is a free reshoot under the Match-Count Guarantee — same photographer, same plan, no payment needed. Please choose from the slots the photographer has open.' },
  'resched.rule.ops': { ja: '運営として日程を変更します（料金・回数の制限はかかりません）。変更先は、カメラマンが受付中にしている空き枠から選べます。', en: 'You are rescheduling as operations staff (no fee or count limits apply). Choose from the slots the photographer has open.' },
  'resched.rule.plan': { ja: '撮影日の2日前からの日程変更です。「あんしん振替プラン」の無料の日程変更（1回）を使います。', en: 'This change is within 2 days of your shoot. It will use the one free reschedule from your Peace-of-Mind Reschedule Plan.' },
  'resched.rule.free': { ja: '撮影日の3日前までの日程変更は無料です（回数の制限はありません）。', en: 'Rescheduling is free until 3 days before your shoot (as many times as you like).' },
  'resched.planNote': { ja: '「あんしん振替プラン」の無料の日程変更（1回）を使います。', en: "This will use your Peace-of-Mind Reschedule Plan's one free reschedule." },
  'resched.confirmReshoot': { ja: '次の日時で無料再撮影を予約します（お支払いは不要です）。\n\n{when}\n\nよろしいですか？', en: "We'll book your free reshoot for the time below (no payment needed).\n\n{when}\n\nContinue?" },
  'resched.confirm': { ja: '日程を次のとおり変更します。\n\n{when}{planNote}\n\nよろしいですか？', en: 'Your shoot will be rescheduled to:\n\n{when}{planNote}\n\nContinue?' },
  'resched.doneReshoot': { ja: '無料再撮影を予約しました。予約内容をメールでお送りしました。', en: 'Your free reshoot is booked. We have emailed you the details.' },
  'resched.doneOps': { ja: '日程を変更しました。お客様・カメラマンにメールで知らせました。', en: 'Rescheduled. The customer and photographer have been notified by email.' },
  'resched.done': { ja: '日程を変更しました。変更内容をメールでお送りしました。', en: 'Your shoot has been rescheduled. We have emailed you the new details.' },
  'resched.failed': { ja: '日程変更に失敗しました。時間をおいて再度お試しください。', en: 'Could not reschedule. Please try again shortly.' },
  'resched.loadFailed': { ja: '空き枠を取得できませんでした。時間をおいて再度お試しください。', en: 'Could not load available slots. Please try again shortly.' },
  'resched.wd.0': { ja: '日', en: 'Sun' },
  'resched.wd.1': { ja: '月', en: 'Mon' },
  'resched.wd.2': { ja: '火', en: 'Tue' },
  'resched.wd.3': { ja: '水', en: 'Wed' },
  'resched.wd.4': { ja: '木', en: 'Thu' },
  'resched.wd.5': { ja: '金', en: 'Fri' },
  'resched.wd.6': { ja: '土', en: 'Sat' },

  // ---------- review modal (js/reviewModal.js) ----------
  'review.title': { ja: '撮影のレビュー', en: 'Review Your Shoot' },
  'review.close': { ja: '閉じる', en: 'Close' },
  'review.ratingLabel': { ja: '総合評価', en: 'Overall rating' },
  'review.star.1': { ja: '不満', en: 'Unsatisfied' },
  'review.star.2': { ja: 'やや不満', en: 'Somewhat unsatisfied' },
  'review.star.3': { ja: 'ふつう', en: 'Okay' },
  'review.star.4': { ja: '満足', en: 'Satisfied' },
  'review.star.5': { ja: 'とても満足', en: 'Very satisfied' },
  'review.starAria': { ja: '{n}つ星 {label}', en: '{n} of 5 stars, {label}' },
  'review.tapStars': { ja: '星をタップして評価してください', en: 'Tap a star to rate your shoot' },
  'review.tapStarsError': { ja: '星をタップして評価してください。', en: 'Please tap a star to rate your shoot.' },
  'review.commentLabel': { ja: 'コメント（任意）', en: 'Comment (optional)' },
  'review.commentPlaceholder': { ja: '撮影の雰囲気、写真の仕上がり、当日の進め方など、感じたことをお書きください', en: 'Tell us about the atmosphere, how the photos turned out, how the day went — anything you felt.' },
  'review.nameLabel': { ja: '表示名（任意）', en: 'Display name (optional)' },
  'review.anonymous': { ja: '匿名のお客様', en: 'Anonymous customer' },
  'review.nameHint': { ja: '本名でなくてかまいません。未入力の場合は「{name}」と表示します。', en: "It doesn't have to be your real name. If you leave it blank, we'll show \"{name}\"." },
  'review.notice': { ja: '投稿したレビューは、カメラマンのプロフィールページに公開されます。個人が特定できる情報や、誹謗中傷にあたる内容はご遠慮ください。運営が不適切と判断した場合は、非表示にすることがあります。', en: "Your review will be published on the photographer's profile page. Please don't include personal information or defamatory content. Our team may hide reviews it considers inappropriate." },
  'review.delete': { ja: '削除', en: 'Delete' },
  'review.submit': { ja: '投稿する', en: 'Post Review' },
  'review.update': { ja: '更新する', en: 'Update' },
  'review.bookingLabel': { ja: '{date} ・ {name}さん', en: '{date} · {name}' },
  'review.duplicate': { ja: 'この撮影のレビューは、すでに投稿されています。', en: 'A review for this shoot has already been posted.' },
  'review.saveFailed': { ja: '投稿できませんでした。撮影の終了後に、ご自身のご予約についてのみ投稿できます。時間をおいて再度お試しください。', en: 'Could not post your review. Reviews can only be posted for your own bookings after the shoot has ended. Please try again shortly.' },
  'review.confirmDelete': { ja: 'このレビューを削除します。よろしいですか？', en: 'This will delete your review. Continue?' },
  'review.deleteFailed': { ja: '削除できませんでした。時間をおいて再度お試しください。', en: 'Could not delete. Please try again shortly.' },
};

registerDict(ENTRIES);

// Japanese wording of a key, regardless of the visitor's language. Shared
// modals that staff screens also use (ops reschedule, admin chat) call this so
// those screens stay Japanese.
export function jaText(key, vars) {
  const entry = ENTRIES[key];
  const s = entry ? entry.ja : key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m)) : s;
}
