// Static marketing / reference content shared across pages.
// Ported from design_handoff_photomatch/PhotoMatch.dc.html sample data.

// labelEn/descEn are additive display-only translations for the English
// toggle — .label itself must stay untouched: functions/api/checkout/
// create-session.js (server-side) matches booking requests against it.
export const AREAS = [
  { key: 'nagoya', label: '名古屋エリア', labelEn: 'Nagoya Area', desc: '栄・名駅など都心のロケーション', descEn: 'Central locations like Sakae and Nagoya Station', lat: 35.1706, lon: 136.9086 },
  { key: 'gifu', label: '岐阜エリア', labelEn: 'Gifu Area', desc: '長良川や街並みを背景に', descEn: 'Scenic backdrops along the Nagara River', lat: 35.4233, lon: 136.7606 },
];

// 担当カメラマンがいないため、一宮は対応エリアから外している。再開するときは、
// AREAS と MEETING_POINTS に一宮を戻し、HIDDEN_AREAS から外す。
// HIDDEN_AREAS のエリアを担当エリアにしているカメラマンは、検索一覧に出さない。
export const HIDDEN_AREAS = ['一宮エリア'];

// 予約で選べる撮影エリア。カメラマンの担当エリア（photographers.area）だけに絞る。
// 担当エリアが AREAS にない（未設定など）ときは、予約できなくならないよう全エリアを返す。
export function areasFor(photographerArea) {
  const own = AREAS.filter((a) => a.label === photographerArea);
  return own.length ? own : AREAS;
}

export const SHOT_TYPES = [
  { label: '一眼×正面笑顔', image: 'assets/shot-front-smile.jpg' },
  { label: '一眼×フォーマル', image: 'assets/shot-natural-snap.jpg' },
  { label: '全身×私服', image: 'assets/shot-casual-fullbody.jpg' },
  { label: '趣味・アウトドア', image: 'assets/shot-outdoor-hobby.jpg' },
];

// 「撮影後マッチング数UP ◯%」は、モニター企画で実データを取得するまで掲出しない。
// 効果を数値で断定する表示は、景品表示法上、根拠資料の提出を求められうるため
// （不実証広告規制）。実証後に「※モニター◯名の実績」等の注記付きで戻す。
// 平均評価は、実際のレビューが集まるまで掲出しない（以前の「4.8」はダミーだった）。
export const STATS = [
  { value: '350+', label: '名古屋エリア撮影実績', labelEn: 'Nagoya-area shoots completed' },
];

// 実在のお客様の口コミだけを入れる。空の間は、トップの「利用者の口コミ」欄ごと
// 非表示になる（以前入っていた3件はダミーだったため削除した）。形式:
// { name, nameEn, starsLabel: '★★★★★', comment, commentEn }
export const TESTIMONIALS = [];

export const TARGET_PAINS = [
  'いいねは来るのに、マッチしてもすぐ途切れる',
  '自撮りしかなくて、プロフィールに載せる写真がない',
  '友達に撮ってもらった写真、なんか決まらない',
];

// Parallel English array (same order/length as TARGET_PAINS) — plain
// strings don't have anywhere to hang an additive *En field.
export const TARGET_PAINS_EN = [
  'The likes come in, but matches fizzle out right away',
  "All I've got are selfies — nothing good enough for my profile",
  "The photo a friend took just doesn't quite land",
];

export const SUPPORTED_APPS = ['Pairs', 'with', 'Omiai', 'タップル', 'Tinder', 'Bumble', '東カレデート', 'D³'];
// Display-only romanizations for the two Japanese-only app names above,
// used when English is selected (falls back to the original for anything
// not listed here, e.g. if a new Japanese-only app is added later).
export const SUPPORTED_APPS_EN = { 'タップル': 'Tapple', '東カレデート': 'TokyoCalendarDate' };

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: '空き枠を選んで予約', titleEn: 'Pick a Time & Book',
    desc: 'カメラマンとプランを選び、カレンダーから希望の時間をタップするだけ。決済まで完了してその場で予約が確定します。',
    descEn: 'Choose a photographer and plan, then tap a time on the calendar. Pay on the spot and your booking is confirmed instantly.',
    note: '天気予報つきカレンダーで、3日後〜30日先まで選べます',
    noteEn: 'The calendar shows the forecast and lets you book 3 to 30 days out',
    img: 'assets/how-it-works-01-booking.jpg',
  },
  {
    step: '02',
    title: '当日は手ぶらで集合', titleEn: 'Show Up Empty-Handed',
    desc: '集合場所でご挨拶と撮影イメージの確認をしたら、そのまま撮影へ。ポーズや表情はカメラマンがリードするので、緊張していても大丈夫です。',
    descEn: "Say hello at the meeting point, confirm the look you're going for, and start shooting. The photographer leads your pose and expression, so nerves are no problem.",
    note: '所要45分／着替えたい服が1〜2着あると印象違いのカットが撮れます',
    noteEn: '45 minutes total — bring an extra outfit or two for some variety',
    img: 'assets/how-it-works-02-meet.jpg',
  },
  {
    step: '03',
    title: 'レタッチ済みデータをお届け', titleEn: 'Retouched Photos, Delivered',
    desc: '撮影後は解散。最短翌日〜3営業日以内に、レタッチ済みのデータをメールでお届けします。',
    descEn: "That's it for the day — retouched photos arrive by email within 1–3 business days.",
    note: 'そのままマッチングアプリのメイン写真に使えます',
    noteEn: 'Ready to use as your main dating-app photo',
    img: 'assets/how-it-works-03-delivery.jpg',
  },
];

export const SAFETY_POINTS = [
  { title: '本人確認済みのカメラマン', titleEn: 'ID-Verified Photographers', desc: '掲載カメラマンは運転免許証などによる本人確認と、ポートフォリオ・接客研修の審査を通過した方のみです。', descEn: "Every listed photographer has passed ID verification (e.g. driver's license) plus a portfolio and customer-service review." },
  { title: '公共の場所での撮影', titleEn: 'Shoots in Public Places', desc: '撮影は原則として公園や街なかなど公共のロケーションで実施します。密室での撮影は行いません。', descEn: 'Sessions take place in public spots like parks and city streets — never in a private, closed room.' },
  { title: 'サイト内で完結する連絡', titleEn: 'All Communication Stays On-Site', desc: 'やり取りはサイト内チャットで記録されます。外部連絡先の交換やサイト外取引はお断りしています。', descEn: 'Messages are logged in the site chat. Exchanging outside contact details or dealing off-platform is not allowed.' },
  { title: '女性利用者への配慮', titleEn: 'For Women, By Choice', desc: '女性カメラマンの指名や、同伴者ありでの撮影のご相談も可能です。安心して撮影いただける体制を整えています。', descEn: "Request a female photographer or bring someone along to the shoot — whatever helps you feel comfortable." },
  { title: '運営によるサポート', titleEn: 'Support From Our Team', desc: 'トラブル時は運営が間に入って対応します。マッチング数保証・再撮影補償もサイト経由の予約が対象です。', descEn: "If something goes wrong, our team steps in. The match-count guarantee and reshoot coverage also apply to bookings made through the site." },
  { title: '写真の取り扱い', titleEn: 'Your Photos Stay Yours', desc: '納品データはご本人のもの。無断での二次利用や公開は行わず、掲載する場合は必ず事前に許諾を得ます。', descEn: 'Delivered photos belong to you. We never reuse or publish them without your prior consent.' },
];

export const LEGAL_PAGES = {
  company: {
    title: '運営会社',
    titleEn: 'Company Information',
    intro: 'PhotoMatch（フォトマッチ）の運営情報です。',
    introEn: 'Operating information for PhotoMatch.',
    rows: [
      { k: '運営', v: 'PhotoMatch運営事務局', kEn: 'Operator', vEn: 'PhotoMatch Operations Office' },
      { k: '所在地', v: '愛知県名古屋市港区（請求があれば遅滞なく開示します）', kEn: 'Address', vEn: 'Minato-ku, Nagoya, Aichi (full address disclosed without delay upon request)' },
      { k: '事業内容', v: 'マッチングアプリ向け出張撮影のマッチングサービスの運営', kEn: 'Business', vEn: 'Operation of a matching service for on-location photo shoots for dating apps' },
      { k: '対応エリア', v: '名古屋中心部・岐阜', kEn: 'Service Area', vEn: 'Central Nagoya and Gifu' },
      { k: 'お問い合わせ', v: 'info.photomatch@gmail.com', kEn: 'Contact', vEn: 'info.photomatch@gmail.com' },
    ],
  },
  tokushoho: {
    title: '特定商取引法に基づく表記',
    titleEn: 'Notation Based on the Act on Specified Commercial Transactions',
    intro: '特定商取引法第11条に基づき表示します。',
    introEn: 'Displayed pursuant to Article 11 of the Act on Specified Commercial Transactions.',
    rows: [
      { k: '販売事業者', v: 'PhotoMatch運営事務局', kEn: 'Seller', vEn: 'PhotoMatch Operations Office' },
      { k: '運営責任者', v: '下山 慧 / 粂川 拓海', kEn: 'Person Responsible for Operations', vEn: '下山 慧 / 粂川 拓海' },
      { k: '所在地', v: '愛知県名古屋市港区（請求があれば遅滞なく開示します）', kEn: 'Address', vEn: 'Minato-ku, Nagoya, Aichi (full address disclosed without delay upon request)' },
      { k: '連絡先', v: 'info.photomatch@gmail.com', kEn: 'Contact', vEn: 'info.photomatch@gmail.com' },
      { k: '電話番号', v: '請求があった場合、遅滞なく開示します（お問い合わせはメールにて承ります）', kEn: 'Phone Number', vEn: 'Disclosed without delay upon request (we handle inquiries by email)' },
      { k: '販売価格', v: '各プランページに税込で表示します（スマホプラン¥6,800〜）', kEn: 'Prices', vEn: 'Shown on each plan page, tax included (Smartphone Plan from ¥6,800)' },
      { k: '商品代金以外の費用', v: '交通費等が発生する場合は予約前に明示します', kEn: 'Charges Other Than the Price', vEn: 'If transportation or other costs apply, we will state them before you book' },
      { k: '支払方法', v: 'クレジットカード（Stripe）／予約時に全額をお支払いいただきます', kEn: 'Payment Method', vEn: 'Credit card (Stripe) / full payment is taken at the time of booking' },
      { k: '役務の提供時期', v: 'ご予約いただいた撮影日時に提供します', kEn: 'Service Timing', vEn: 'Provided at the shoot date and time you booked' },
      { k: 'キャンセル', v: '撮影日の3日前まで無料／2日前 プラン料金の50%／前日・当日 プラン料金の100%（オプション料金は全額返金。返金はお支払いのカードへ）', kEn: 'Cancellation', vEn: 'Free up to 3 days before the shoot date / 2 days before: 50% of the plan price / the day before or the day of: 100% of the plan price (option fees are refunded in full; refunds go to the card used for payment)' },
    ],
  },
  privacy: {
    title: 'プライバシーポリシー',
    titleEn: 'Privacy Policy',
    intro: 'PhotoMatch（以下「当サービス」）は、お客様の個人情報を以下の方針に基づき取り扱います。',
    introEn: 'PhotoMatch (the "Service") handles your personal information in accordance with the policy below.',
    sections: [
      { h: '1. 取得する情報', b: 'お名前、性別（「異性スタッフ写真セレクト」の担当判定に使用します）、連絡先（メール・電話番号）、予約内容、撮影データ、決済に必要な情報などを取得します。', hEn: '1. Information We Collect', bEn: 'We collect your name, gender (used to assign staff for the "Opposite-Gender Staff Pick" option), contact details (email and phone number), booking details, photo data, and information needed for payment.' },
      { h: '2. 利用目的', b: '予約の管理・カメラマンとの調整・撮影データの納品・お問い合わせ対応・サービス改善のために利用します。', hEn: '2. Purposes of Use', bEn: 'We use this information to manage bookings, coordinate with your photographer, deliver your photos, respond to inquiries, and improve the Service.' },
      { h: '3. 第三者提供', b: '撮影の実施に必要な範囲で担当カメラマンに共有するほかは、法令に基づく場合を除き第三者へ提供しません。', hEn: '3. Disclosure to Third Parties', bEn: 'We share information with your assigned photographer only as far as needed to carry out the shoot. Otherwise we do not provide it to third parties, except where required by law.' },
      { h: '4. 決済情報の取り扱い', b: 'クレジットカード情報は決済代行事業者（Stripe）が安全に処理し、当サービスはカード番号を保持しません。', hEn: '4. Handling of Payment Information', bEn: 'Credit card information is processed securely by our payment provider, Stripe. We do not store your card number.' },
      { h: '5. 撮影データ', b: '納品データはお客様に帰属します。事前の許諾なく広告等に二次利用することはありません。', hEn: '5. Photo Data', bEn: 'Delivered photos belong to you. We will not reuse them in advertising or elsewhere without your prior consent.' },
      { h: '6. お問い合わせ', b: '個人情報の開示・訂正・削除のご要望は info.photomatch@gmail.com までご連絡ください。', hEn: '6. Contact', bEn: 'To request disclosure, correction, or deletion of your personal information, please contact info.photomatch@gmail.com.' },
    ],
  },
  terms: {
    title: '利用規約',
    titleEn: 'Terms of Service',
    intro: 'この利用規約（以下「本規約」）は、PhotoMatch運営事務局（以下「当社」）が提供する出張写真撮影マッチングサービス「PhotoMatch」（以下「本サービス」）の利用条件を定めるものです。本サービスをご利用いただくお客様（以下「お客様」）は、本規約に同意のうえご利用ください。',
    introEn: 'These Terms of Service (the "Terms") set out the conditions for using "PhotoMatch" (the "Service"), an on-location photo shoot matching service provided by the PhotoMatch Operations Office ("we" or "us"). Customers who use the Service ("you") are asked to agree to these Terms before using it.',
    sections: [
      { h: '第1条（本サービスの概要）', b: '本サービスは、お客様とカメラマンとの間で撮影日時・場所を調整し、マッチングアプリ用プロフィール写真を中心とした出張撮影を提供するものです。撮影場所の使用許可等の手配は、当社またはカメラマンが行います。', hEn: 'Article 1 (Overview of the Service)', bEn: 'The Service coordinates the shoot date, time, and location between you and a photographer, and provides on-location photo shoots centered on profile photos for dating apps. Arrangements such as permission to use a shooting location are handled by us or the photographer.' },
      { h: '第2条（申込みと契約成立）', b: 'お客様は、サイト上の空き枠カレンダーから希望日時・プランを選択し、必要事項を入力のうえお申込みください。決済が完了した時点で契約が成立し、予約が確定します。', hEn: 'Article 2 (Booking and Formation of Contract)', bEn: 'Choose your preferred date, time, and plan from the availability calendar on the site, enter the required details, and submit your booking. The contract is formed, and your booking confirmed, when payment is completed.' },
      { h: '第3条（支払方法）', b: '利用料金は、予約確定時にサイト上のクレジットカード決済（Stripe）にて全額をお支払いいただきます。表示価格はすべて税込です。当日の追加料金は発生しません。', hEn: 'Article 3 (Payment)', bEn: 'The fee is paid in full by credit card (Stripe) on the site when your booking is confirmed. All displayed prices include tax. No additional charges are made on the day.' },
      { h: '第4条（変更・キャンセル）', b: '撮影日の3日前まで：無料でキャンセル・日程変更が可能です。撮影日の2日前から撮影開始前までの日程変更は、「あんしん振替プラン」にご加入のお客様に限り、1回まで無料で可能です（未加入の場合はキャンセルとなります）。撮影日の2日前：プラン料金の50%をキャンセル料として申し受けます。撮影日の前日・当日：プラン料金の100%をキャンセル料として申し受けます。オプション料金はキャンセル料の対象外とし、全額返金します。キャンセル料を差し引いた金額は、お支払いに使われたクレジットカードへ返金します。キャンセル・日程変更はマイページから承ります（撮影開始時刻以降のキャンセル・日程変更はお問い合わせください）。', hEn: 'Article 4 (Changes and Cancellation)', bEn: 'Up to 3 days before the shoot date: you can cancel or reschedule free of charge. From 2 days before the shoot date until the shoot starts, rescheduling is free, once only, for customers who have the "Peace-of-Mind Reschedule Plan" (without the plan, it is treated as a cancellation). 2 days before the shoot date: a cancellation fee of 50% of the plan price applies. The day before or the day of the shoot: a cancellation fee of 100% of the plan price applies. Option fees are not subject to cancellation fees and are refunded in full. The amount after deducting the cancellation fee is refunded to the credit card used for payment. Cancellations and rescheduling are handled from My Page (for cancellations or rescheduling after the shoot start time, please contact us).' },
      { h: '第5条（遅刻）', b: '集合時間に15分以上遅れて指定場所にお越しいただいた場合、当日キャンセルとして扱い、前条に定めるキャンセル料（返金なし）を申し受けます。15分未満の遅刻の場合も、撮影時間の短縮など提供内容を変更させていただくことがあり、この場合も返金・代金の減額は行いません。', hEn: 'Article 5 (Lateness)', bEn: 'If you arrive at the designated place 15 minutes or more after the meeting time, it is treated as a same-day cancellation and the cancellation fee set out in the previous article applies (no refund). Even if you are less than 15 minutes late, we may have to change what we provide, for example by shortening the shoot; in that case, no refund or fee reduction is given.' },
      { h: '第6条（データの納品）', b: '撮影データは、撮影日から最短翌日〜3営業日以内に、Googleフォトのアルバムリンクを電子メールにてお送りする方法で納品します。お客様はGoogleフォトの利用規約に同意のうえご使用ください。納品後のデータ保存期間は撮影月の翌々月末日までとし、それを超える保存について当社は責任を負いません。', hEn: 'Article 6 (Delivery of Photos)', bEn: 'Photos are delivered by emailing a Google Photos album link, between the day after the shoot at the earliest and 3 business days after the shoot date. Please use Google Photos in accordance with its terms of service. Delivered photos are kept until the last day of the second month after the month of the shoot, and we are not responsible for storage beyond that.' },
      { h: '第7条（システム障害等の免責）', b: 'Googleフォトその他当社が利用するシステムの中断・停止等、当社の責によらない事由により本サービスの提供またはデータ納品が遅延・不能となった場合、当社はその責任を負いません。', hEn: 'Article 7 (Disclaimer for System Failures)', bEn: 'We are not liable if provision of the Service or delivery of photos is delayed or becomes impossible due to causes beyond our control, such as an interruption or outage of Google Photos or another system we use.' },
      { h: '第8条（マッチング数保証・再撮影補償）', b: '事前申請のうえ納品写真をマッチングアプリのメイン写真に設定し、1ヶ月運用してもマッチング数に改善が見られない場合、サイト経由でご予約いただいたお客様に限り、同一プランでの再撮影を無償で承ります。適用条件の詳細はサポートまでお問い合わせください。', hEn: 'Article 8 (Match-Count Guarantee and Reshoot Compensation)', bEn: 'If, after applying in advance, you set a delivered photo as your main dating-app photo, use it for one month, and see no improvement in your match count, we will reshoot with the same plan free of charge. This applies only to customers who booked through the site. Please contact support for the detailed conditions.' },
      { h: '第9条（不可抗力・返金）', b: '天災・悪天候その他お客様および当社いずれの責にも帰さない事由により撮影が不能となった場合は、日程変更または返金にて対応します。専ら当社の責に帰すべき事由により本サービスの提供が不能となった場合は、お客様の選択により日程変更または全額返金を行います。', hEn: 'Article 9 (Force Majeure and Refunds)', bEn: 'If a shoot becomes impossible due to natural disasters, bad weather, or other causes attributable to neither you nor us, we will reschedule or refund. If the Service becomes impossible to provide due to causes solely attributable to us, we will reschedule or give a full refund, at your choice.' },
      { h: '第10条（知的財産）', b: '当社は、納品する写真データについて、第三者の権利を侵害していないことその他一切について保証するものではありません。撮影データの私的利用の範囲を超える二次利用（商用利用等）については別途ご相談ください。', hEn: 'Article 10 (Intellectual Property)', bEn: 'We do not warrant that delivered photos do not infringe third-party rights, or give any other warranty about them. Please contact us separately about any use beyond personal use (such as commercial use).' },
      { h: '第11条（個人情報の取扱い）', b: '当社は、お客様からお預かりする個人情報を、個人情報保護方針に従い適切に取り扱います。', hEn: 'Article 11 (Handling of Personal Information)', bEn: 'We handle the personal information you entrust to us appropriately, in accordance with our privacy policy.' },
      { h: '第12条（禁止事項）', b: 'お客様は、次の行為を行ってはならないものとします。（1）他人になりすましての申込み（2）虚偽の情報の申告（3）カメラマンまたは当社との連絡を正当な理由なく途絶する行為（4）カメラマンと当社を介さず直接取引を行う行為（5）カメラマンまたは他の利用者への迷惑行為・ハラスメント（6）法令または公序良俗に反する行為。違反が確認された場合、当社は契約解除・本サービス提供の中止を行うことができ、利用料金の返還は行いません。', hEn: 'Article 12 (Prohibited Acts)', bEn: 'You must not do any of the following: (1) apply while impersonating another person; (2) give false information; (3) cut off contact with the photographer or us without good reason; (4) deal directly with the photographer without going through us; (5) harass or cause trouble for the photographer or other users; (6) act in violation of laws or public order and morals. If a violation is confirmed, we may terminate the contract and stop providing the Service, and fees paid will not be refunded.' },
      { h: '第13条（反社会的勢力の排除）', b: 'お客様は、自身が暴力団員その他反社会的勢力に該当しないことを表明・確約するものとします。該当することが判明した場合、当社は通知・催告を要せず契約を解除でき、この場合キャンセルとみなし第4条を準用します。', hEn: 'Article 13 (Exclusion of Antisocial Forces)', bEn: 'You represent and warrant that you are not an organized crime group member or other antisocial force. If this is found to be untrue, we may terminate the contract without notice or demand; in that case it is treated as a cancellation and Article 4 applies accordingly.' },
      { h: '第14条（損害賠償）', b: '当社の責に帰すべき事由によりお客様に損害が生じた場合、当社の賠償責任は、お客様から受領した利用料金を上限とします。ただし当社の故意または重過失による場合はこの限りではありません。', hEn: 'Article 14 (Damages)', bEn: 'If you suffer damage due to a cause attributable to us, our liability is limited to the fees we received from you. This does not apply in cases of our intentional misconduct or gross negligence.' },
      { h: '第15条（規約の改定）', b: '当社は、本規約を改定することがあります。改定後の規約は、本サービスサイトへの掲載その他適切な方法で周知した時点から効力を生じるものとします。', hEn: 'Article 15 (Amendments to the Terms)', bEn: 'We may amend these Terms. Amended Terms take effect when published on the Service site or otherwise announced by appropriate means.' },
      { h: '第16条（準拠法・管轄）', b: '本規約の準拠法は日本法とし、本サービスに関して紛争が生じた場合、名古屋地方裁判所を第一審の専属的合意管轄裁判所とします。', hEn: 'Article 16 (Governing Law and Jurisdiction)', bEn: 'These Terms are governed by the laws of Japan. Any dispute relating to the Service is subject to the exclusive jurisdiction of the Nagoya District Court as the court of first instance.' },
    ],
  },
  // カメラマン向け（ログイン画面・管理画面のフッターの下からリンク）。
  // 中身はサイトで実際に動いているルール（報酬・シフト・納品・キャンセル）と同じにすること。
  pro: {
    title: 'カメラマン向けガイド・規約',
    intro: 'PhotoMatchに掲載するカメラマンの方に守っていただくルールと、予約・納品・報酬の仕組みをまとめています。',
    sections: [
      { h: '1. 掲載までの流れ', b: '運営がアカウントを発行し、メールアドレスと仮パスワードをお渡しします。ログイン後、管理画面の「プロフィール設定」で、写真・表示名・活動エリア・性別・紹介文を入力してください。運営が内容を確認し、本人確認と接客研修の完了を確かめたうえで公開します。公開時に、標準の料金プランが登録されます（料金は運営が設定します）。' },
      { h: '2. シフト（予約を受け付ける時間）', b: 'お客様が予約できるのは、管理画面のシフトで「受付中」にした30分枠だけです。初期状態はすべて休みなので、撮影できる日時を開けてください。「まとめて設定する」で、時間帯と曜日を指定して一括で開けられます。45分のプランは、連続する2枠が開いている時間だけ予約できます。お客様が予約できるのは、3日後から30日先までの日時です。しばらく予約を受けられないときは、「予約受付を一時休止する」をお使いください。' },
      { h: '3. 予約が入ったら', b: '予約が確定すると、メールでお知らせします。管理画面の予約一覧で、日時・プラン・オプション・連絡先・集合場所と、お客様の事前カウンセリングの回答を確認できます。お客様との連絡は、サイト内のメッセージで行ってください（新着メッセージはメールでもお知らせします）。集合場所は、エリアごとに決まった場所です。' },
      { h: '4. 撮影当日', b: '撮影は、公園や街なかなど公共の場所で行い、密室での撮影は行わないでください。お客様が集合時間に15分以上遅れた場合は、運営にご連絡ください。運営が当日キャンセルとして処理します。' },
      { h: '5. 納品', b: '撮影日から3営業日以内（スピード納品のオプションがある場合は翌営業日。土日・祝日を除く）に、管理画面の「納品する」から、写真のアルバム（Googleフォトなど）のリンクを登録してください。お客様にメールで届き、マイページにも表示されます。期限は予約一覧に表示されます。全データ納品・スキンレタッチ（20枚まで）・スピード納品のオプションが付いた予約は、その内容で納品してください。「異性スタッフ写真セレクト」は、運営のスタッフが行います。' },
      { h: '6. 報酬', b: '報酬は「プラン料金の50%＋オプション1件につき¥1,100」です（モニター価格の予約は、実際のプラン料金の50%）。お客様の当日キャンセル・遅刻によるキャンセルの場合は、補償として¥2,000をお支払いします。それ以外のキャンセル、運営の判断によるキャンセル、マッチング数保証による無料再撮影は、報酬の対象外です。お支払いは月末締め・翌月25日に、ご登録の口座へ銀行振込します。対象は、納品済みで、撮影日から30日の保証期間が過ぎた予約です（お客様がマッチング数保証に申し込んだ予約は、申請期限が過ぎてから）。不審請求の申し立てなどがあった予約は、確認が済むまでお支払いを保留します。報酬の見込みと送金の状況は、管理画面の「報酬」で確認できます。' },
      { h: '7. 日程変更・キャンセル', b: 'お客様は、撮影日の3日前まで無料で日程を変更・キャンセルできます。2日前以降の日程変更は、「あんしん振替プラン」に加入したお客様だけが1回できます。悪天候やカメラマンのご都合で撮影できないときは、運営が日程変更またはキャンセルを行います。いずれの場合も、メールでお知らせし、元の枠は再び予約を受け付けられる状態になります。ご都合で撮影できなくなったときは、できるだけ早く運営にご連絡ください。' },
      { h: '8. マッチング数保証', b: 'お客様の申請を運営が承認した場合、同じプランで無料の再撮影を行います。お客様がマイページから日時を選ぶと、通常の予約と同じくメールでお知らせします。受け付けられる日時は、シフトで開けておいてください。' },
      { h: '9. 禁止事項', b: 'お客様と、サイト外の連絡先（電話番号・SNSなど）を交換すること、サイトを通さずに取引することは禁止です。撮影した写真を、お客様の事前の許諾なく、作例やSNSなどに掲載・二次利用しないでください。お客様の個人情報は、撮影と納品以外の目的に使わないでください。違反があった場合は、掲載を停止することがあります。' },
      { h: '10. お問い合わせ', b: 'ご不明な点や、トラブルが起きたときは、info.photomatch@gmail.com までご連絡ください。' },
    ],
  },
};

export const FAQS = [
  { q: '予約はどのくらい前からできますか？', qEn: 'How far in advance can I book?',
    a: 'ご予約は撮影日の3日前から承っています。空き枠カレンダーから、ご希望の日時をお選びください。',
    aEn: 'Bookings open starting 3 days before the shoot date. Pick a date and time from the availability calendar.' },
  { q: '支払い方法を教えてください。', qEn: 'What payment methods are accepted?',
    a: 'サイト上でのクレジットカード決済に対応しています。表示価格はすべて税込です。当日の追加料金は発生しません。',
    aEn: 'Credit card, paid through the site. All prices shown include tax, and there are no additional charges on the day.' },
  { q: '天候が悪いときはどうなりますか？', qEn: "What if the weather is bad?",
    a: 'カレンダーに週間天気予報を表示しています。撮影日の3日前まではマイページから無料で日程を変更できます。直前に悪天候で撮影が難しくなった場合は、日程変更または返金で対応します（利用規約第9条）。屋内・アーケードなどのロケーションもご提案します。',
    aEn: 'The calendar shows a weekly forecast. You can reschedule for free from My Page until 3 days before the shoot. If bad weather makes a shoot difficult at the last minute, we will reschedule or refund (Terms, Article 9). We can also suggest a covered location like an arcade.' },
  { q: 'マッチング数保証とは何ですか？', qEn: 'What is the match-count guarantee?',
    a: '事前申請のうえ納品写真をメインに設定し、1ヶ月運用してもマッチング数が増えなかった場合、同じプランで無料で撮り直します。サイト経由のご予約が対象です。',
    aEn: "Apply in advance, set your new photo as your main picture, and if your match count hasn't improved after a month of use, we'll reshoot the same plan for free. Only bookings made through the site qualify." },
  { q: '撮影データはいつ受け取れますか？', qEn: 'When will I receive my photos?',
    a: '撮影後、最短翌日〜3営業日以内にメールにてGoogleフォトのURLを共有してのお渡しになります。',
    aEn: 'Within 1–3 business days after the shoot, by email with a shared Google Photos link.' },
  { q: 'キャンセルはできますか？', qEn: 'Can I cancel my booking?',
    a: '撮影日の3日前まで無料、2日前はプラン料金の50%、前日・当日はプラン料金の100%をキャンセル料として申し受けます（オプション料金は全額返金します）。マイページからお手続きいただけ、残りの金額はお支払いのカードへ自動で返金されます。なお、集合時間に15分以上遅れた場合はキャンセル扱いとなることがあり、その際の返金はできません。',
    aEn: "Free up to 3 days before the shoot; 50% of the plan fee at 2 days before; 100% of the plan fee the day before or on the day (options are always fully refunded). Cancel from My Page — the rest is refunded to your card automatically. Arriving more than 15 minutes late may be treated as a same-day cancellation, which is non-refundable." },
  { q: '撮影場所の許可は自分で取る必要がありますか？', qEn: 'Do I need to get permission for the shoot location myself?',
    a: 'ロケーション撮影に必要な許可取得は運営・カメラマン側で対応します。お客様のお手間はかかりません。',
    aEn: "No — we and the photographer handle any permits the location needs, so it's no extra work for you." },
  { q: '当日の流れを教えてください。', qEn: 'What happens on the day of the shoot?',
    a: '集合場所で簡単なご挨拶・撮影イメージの確認をした後、撮影スタートです。撮影中はカメラマンがポーズや表情もリードします。終了後はその場で解散、レタッチ済みデータは後日メールでお届けします。',
    aEn: "Meet at the pickup point, quickly go over the look you want, then start shooting — the photographer leads your poses and expressions. You're free to go once it wraps, and retouched photos follow by email." },
  { q: '持ち物は何が必要ですか？', qEn: 'What should I bring?',
    a: '特別な持ち物は不要です。着替えたい服がある場合は他1〜2着、リップやヘアアイテムなど身だしなみを整えるものがあると安心です。',
    aEn: "Nothing special. An extra outfit or two is nice to have, along with any touch-up items like lip balm or a hairbrush." },
  { q: '服装はどうすればいいですか？', qEn: 'What should I wear?',
    a: '清潔感のある普段着がおすすめです。白・ネイビー・ベージュなど明るめの無地は写真映えします。過度な柄物や暗い色は避けると仕上がりが良くなります。',
    aEn: "Clean, everyday clothes work best. Light, plain colors like white, navy, or beige photograph well — busy patterns and dark colors tend to work less well." },
];

// label は AREAS 定数（名古屋／岐阜）と揃える。
export const MEETING_POINTS = [
  // mapQuery は緯度経度で固定（同名店舗が他にもあり得るテキスト検索より確実なため）。
  // 出典: https://www.google.com/maps/place/.../@35.1719812,136.909068,...
  { key: 'nagoya', label: '名古屋', labelEn: 'Nagoya', detail: 'ファミリーマート オアシス21前店 前（〒461-0005 愛知県名古屋市東区東桜1丁目10-33）', detailEn: 'In front of FamilyMart Oasis 21 Mae store (1-10-33 Higashisakura, Higashi-ku, Nagoya, Aichi 461-0005)', mapQuery: '35.1719812,136.909068' },
  { key: 'gifu1', label: '岐阜', labelEn: 'Gifu', detail: 'ドトールコーヒーショップ アスティ岐阜店 前', detailEn: 'In front of Doutor Coffee Shop Asty Gifu store', mapQuery: 'ドトールコーヒーショップ アスティ岐阜店' },
];

// 撮影エリア（AREAS の label、例「名古屋エリア」）に対応する集合場所。
export function meetingPointForArea(areaLabel) {
  return MEETING_POINTS.find((mp) => String(areaLabel || '').startsWith(mp.label)) || null;
}

export const mapUrlFor = (mp) => `https://www.google.com/maps?q=${encodeURIComponent(mp.mapQuery)}`;

// お客様の性別（登録時に選ぶ）。「異性スタッフ写真セレクト」は、男性・女性のどちらかを
// 選んだお客様だけが使える（異性のスタッフが写真を選ぶため）。
export const CUSTOMER_GENDERS = [
  { key: 'male', label: '男性', labelEn: 'Male' },
  { key: 'female', label: '女性', labelEn: 'Female' },
  { key: 'other', label: '回答しない', labelEn: 'Prefer not to say' },
];
export const isValidCustomerGender = (g) => CUSTOMER_GENDERS.some((x) => x.key === g);
export const OPPOSITE_SEX_OPTION_KEY = 'oppositeSexPick';
export const needsGenderForOptions = (optionKeys) => (optionKeys || []).includes(OPPOSITE_SEX_OPTION_KEY);

export const MONITOR_CONDITIONS = [
  '名古屋・岐阜いずれかの集合場所での撮影に来場できる方',
  '現在マッチングアプリで使用中の写真がある方（施策前後の変化の比較にご協力いただきます）',
  '撮影から約1ヶ月後を目安に、任意のアンケートへのご協力をお願いできる方（回答は必須ではありません）',
  'PhotoMatchの実績紹介（お名前・個人が特定できる情報は伏せた状態）にご協力いただける方',
];

export const MONITOR_STEPS = [
  { step: '1', title: '応募フォームから申し込み', titleEn: 'Apply with the form', desc: 'このページの応募フォームから必要事項をご入力ください。', descEn: 'Fill in the application form on this page.' },
  { step: '2', title: '審査結果のご連絡', titleEn: 'We email you the result', desc: '先着順・簡単な審査の上、当選可否をメールでご連絡します（定員に達し次第、締め切りとなります）。', descEn: 'Applications are reviewed first-come, first-served with a simple screening, and we email you the result (applications close once the limit is reached).' },
  { step: '3', title: '通常フローで撮影日を予約', titleEn: 'Book your shoot as usual', desc: '当選後、通常の予約フローからご都合の良い日時をお選びいただけます。', descEn: 'Once you are selected, choose a date and time that suits you through the regular booking flow.' },
  { step: '4', title: '撮影・任意アンケート', titleEn: 'Shoot and optional survey', desc: '撮影から約1ヶ月後を目安に、マッチング数の変化について任意のアンケートにご協力いただきます。', descEn: 'About one month after your shoot, we ask you to take an optional survey about how your match numbers changed.' },
];

// MONITOR_CONDITIONS と同じ順番の英語版（表示専用）。
export const MONITOR_CONDITIONS_EN = [
  'You can come to a meeting point in Nagoya or Gifu for your shoot',
  'You have photos you are currently using on a dating app (we will ask for your help comparing before and after)',
  'You are willing to take an optional survey about one month after your shoot (responding is not required)',
  'You are happy for us to feature your results in PhotoMatch case studies (your name and any identifying details are withheld)',
];

export const COLUMN_ARTICLES = [
  {
    id: 'nagoya', priority: 1, keyword: 'マッチングアプリ 写真 名古屋', tag: '名古屋ローカル', readMin: 5,
    title: '名古屋でマッチングアプリの写真を撮るなら？自撮り卒業のすすめ',
    lead: '栄・大須・名古屋城――写真映えするスポットが徒歩圏に揃う名古屋は、実はプロフィール撮影に向いた街です。名古屋でマッチングアプリ用の写真を用意する方法を、費用と時間の観点から整理します。',
    sections: [
      { h: '名古屋で写真を用意する3つの方法', b: '①自撮り：無料だが不自然になりやすく、他撮りに比べマッチ率が落ちる傾向。②スタジオの婚活写真：クオリティは高いが¥20,000〜30,000と高額で、背景も証明写真的になりがち。③出張ロケ撮影：街なかの自然光で撮るため“アプリらしい”自然な1枚になり、費用も抑えられます。' },
      { h: 'なぜ屋外ロケがマッチングアプリ向きなのか', b: 'マッチングアプリのメイン写真で好まれるのは、スタジオの作り込んだ写真より「休日にたまたま撮れたような自然体の1枚」。栄の街並みや鶴舞公園の緑を背景にすると、清潔感と親しみやすさが同時に伝わります。' },
      { h: '名古屋・岐阜エリアなら最短45分', b: 'PhotoMatchは名古屋を拠点に岐阜まで対応。栄や大須など集合しやすい場所で待ち合わせ、撮影は45分で完結します。仕事帰りや休日のスキマ時間で撮影でき、写真は最短翌日〜3営業日でお届けします。' },
    ],
  },
  {
    id: 'howto-men', priority: 2, keyword: 'マッチングアプリ 写真 撮り方 男', tag: 'ノウハウ', readMin: 6,
    title: 'マッチングアプリでモテる写真の撮り方【男性版・保存必須】',
    lead: '同じ人でも、写真次第でいいね数は何倍も変わります。男性がマッチングアプリで“選ばれる”ためのプロフィール写真の撮り方を、メイン・サブに分けて解説します。',
    sections: [
      { h: 'メイン写真は「清潔感×自然な笑顔」が9割', b: '第一印象を決めるメイン写真は、上半身・正面・自然な笑顔が鉄則。歯を見せすぎない口角の上げ方、カメラ目線と外しのバランスで印象は大きく変わります。サングラスや帽子で顔が隠れる写真、加工が強すぎる写真は避けましょう。' },
      { h: 'サブ写真で“生活感”と“ギャップ”を見せる', b: 'メインで好印象を持たれても、サブ写真が自撮りばかりだと不安を与えます。全身がわかる私服カット、趣味やアウトドアのシーン、後ろ姿や横顔など、複数の角度で人柄を伝えるのが効果的です。' },
      { h: '光と背景を制する者がいいねを制す', b: '曇りの日のやわらかい光や、夕方の斜光は肌をきれいに見せます。背景はごちゃつかない場所を選び、被写体を引き立てること。これらは1人では難しいため、プロに任せると失敗がありません。' },
    ],
  },
  {
    id: 'no-match', priority: 3, keyword: 'マッチングアプリ マッチしない 原因 写真', tag: 'お悩み解決', readMin: 5,
    title: 'マッチングアプリでマッチしない原因は写真？見直すべき5つの点',
    lead: '「毎日ログインしているのに全然マッチしない」――その原因の多くは、実は写真にあります。今日から直せる5つのチェックポイントを紹介します。',
    sections: [
      { h: '① メイン写真が自撮りになっていないか', b: '自撮りは「他人から見た自分」が写らず、実物とのギャップや自信のなさが伝わりがち。他撮りに変えるだけでマッチ率が上がるケースは非常に多いです。' },
      { h: '② 顔がはっきり見えるか／③ 写真が1枚だけになっていないか', b: '暗い・遠い・加工が強い写真は、顔の情報が伝わらず敬遠されます。また写真が1枚だけだと情報不足で不安に。3〜5枚を目安に、表情や場面を変えて載せましょう。' },
      { h: '④ 清潔感が伝わるか／⑤ 全身がわかる写真があるか', b: '服装・髪型・背景の生活感まで含めて「清潔感」は判断されます。全身写真がないと体型を隠していると受け取られることも。私服の全身カットを1枚入れるのが効果的です。' },
    ],
  },
  {
    id: 'selfie', priority: 4, keyword: 'マッチングアプリ 自撮り NG', tag: 'ノウハウ', readMin: 4,
    title: '自撮りはなぜ不利？他撮り写真がマッチ率を上げる理由',
    lead: '「自撮りはNG」とよく言われますが、その理由をきちんと説明できる人は多くありません。他撮りが有利な理由を、心理と見た目の両面から解説します。',
    sections: [
      { h: '自撮りが伝えてしまう“3つの印象”', b: '至近距離のレンズによる顔の歪み、生活感のある背景、そして「一緒に写真を撮る相手がいない」という無意識の印象。これらがマイナスに働きます。' },
      { h: '他撮りは「客観的な魅力」が写る', b: '少し離れた位置から撮る他撮りは、顔の比率が自然で、全身のバランスや雰囲気まで伝わります。第三者の目線で撮られた写真は、見る人に安心感を与えます。' },
      { h: 'プロの他撮りなら“自然さ”も演出できる', b: 'カメラマンが表情やポーズをリードするため、「頑張って撮った感」のない自然な1枚に。作り込みすぎず、でも垢抜けて見える——その絶妙なラインを狙えます。' },
    ],
  },
  {
    id: 'outfit', priority: 5, keyword: 'マッチングアプリ 写真 服装', tag: 'ノウハウ', readMin: 4,
    title: 'マッチングアプリ写真の服装｜清潔感が伝わる色と選び方',
    lead: '写真の印象は服装で大きく変わります。マッチングアプリのプロフィールで好印象を与える服の色・シルエット・避けたいアイテムをまとめました。',
    sections: [
      { h: 'まずは白・ネイビー・ベージュ', b: '明るめの無地は肌をきれいに見せ、清潔感が伝わります。特に白シャツやネイビーのニットは万人受けする鉄板。派手な柄や真っ黒のコーデは顔色が沈みやすいので避けましょう。' },
      { h: 'サイズ感は“ジャストか少しゆとり”', b: 'オーバーサイズすぎると清潔感が損なわれ、ぴったりすぎると窮屈な印象に。体に合ったシルエットが好印象です。撮影当日は1〜2着替えを持参すると、印象違いのカットが撮れます。' },
      { h: '小物で“人柄”をさりげなく', b: '腕時計やメガネなど、悪目立ちしない小物は個性を伝えるのに有効。ただし盛りすぎは禁物です。迷ったらシンプルを選びましょう。' },
    ],
  },
  {
    id: 'pairs', priority: 6, keyword: 'Pairs メイン写真 コツ', tag: 'アプリ別', readMin: 4,
    title: 'Pairsのメイン写真で失敗しない選び方｜いいねが増える1枚とは',
    lead: '国内最大級のPairsをはじめWith・Omiaiなど、メイン写真の重要性はどのアプリでも共通です。いいねが増えるメイン写真の条件を整理します。',
    sections: [
      { h: 'メイン写真は“0.5秒”で判断される', b: 'ユーザーは大量のプロフィールをスワイプします。判断は一瞬。だからこそ、顔がはっきり見え、自然に笑っている明るい1枚を選ぶことが最優先です。' },
      { h: '避けるべきメイン写真の典型例', b: '友人と写った集合写真（どれが本人か分からない）、加工アプリの盛りすぎ、暗い・遠い写真、証明写真のような無表情。いずれもスワイプされて終わりがちです。' },
      { h: 'サブ写真と“1セット”で設計する', b: 'メインで惹きつけ、サブで人柄を補足する。この流れを1回の撮影でまとめて用意できるのがプロ撮影の強みです。Pairs・With・Omiaiなど複数アプリに使い回せます。' },
    ],
  },
  {
    id: 'price', priority: 7, keyword: '婚活写真 相場 名古屋', tag: '料金', readMin: 4,
    title: '婚活・プロフィール写真の相場は？名古屋で費用を抑えるコツ',
    lead: 'プロフィール写真をプロに頼むといくらかかるのか。スタジオ・出張撮影それぞれの相場と、名古屋で賢く費用を抑える方法を解説します。',
    sections: [
      { h: 'スタジオ撮影の相場は¥20,000〜30,000', b: 'スタジオの婚活写真はヘアメイクや台紙込みで高額になりがち。仕上がりは丁寧ですが、背景が単調で“アプリらしさ”に欠けることもあります。' },
      { h: '出張ロケ撮影なら¥6,800〜が目安', b: 'カメラマンが街なかまで来てくれる出張撮影は、スタジオ料金がかからない分リーズナブル。自然光のロケ撮影で、マッチングアプリに最適な雰囲気の写真が残せます。' },
      { h: '“使う目的”で選ぶのが失敗しないコツ', b: 'お見合い写真ならスタジオ、マッチングアプリならロケ撮影、と目的で選ぶのが正解。PhotoMatchはアプリ用に特化し、45分・¥6,800〜で名古屋・岐阜に対応しています。' },
    ],
  },
];

// The top page's pricing table, and also the standard plan set that ops
// approval (functions/api/photographers/visibility.js) registers for a
// photographer who has no plans yet — so keep name/price/desc in step with
// the `plans` rows in supabase/schema.sql. planNameText()/planDescText() in
// js/i18n.js translate the same wording where it's echoed back from the DB.
export const PRICING_PLANS = [
  { name: 'スマホプラン', nameEn: 'Smartphone Plan', price: '6,800', originalPrice: '7,800', discountLabel: '1,000円OFF', desc: '45分・20枚納品・スマホ撮影', descEn: '45 min · 20 photos delivered · shot on smartphone' },
  { name: 'スタンダード', nameEn: 'Standard', price: '8,800', originalPrice: '9,800', discountLabel: '1,000円OFF', desc: '45分・20枚納品', descEn: '45 min · 20 photos delivered' },
  { name: 'スタンダードプラス', nameEn: 'Standard Plus', price: '10,800', originalPrice: '11,800', discountLabel: '1,000円OFF', desc: '45分・20枚納品＋スマホ用5枚', descEn: '45 min · 20 photos delivered + 5 smartphone crops' },
  { name: '結婚相談所', nameEn: 'Matchmaking Agency', price: '8,800', originalPrice: '9,800', discountLabel: '1,000円OFF', desc: '45分・10枚納品', descEn: '45 min · 10 photos delivered' },
];

// labelEn/descEn are additive display-only translations for the English
// toggle — .label/.desc/.price themselves must stay untouched: functions/
// _lib/pricing.js and functions/_lib/notifications.js (server-side) import
// this array directly and read those fields (pricing, and the Japanese
// confirmation email text).
export const EXTRA_OPTIONS = [
  { key: 'fullData', label: '全データ納品', labelEn: 'All Photos Delivered', desc: '撮影した全カットをまとめてお渡し', descEn: 'Every shot from the session, delivered together', price: 3800 },
  { key: 'retouch', label: 'スキンレタッチ（美肌補正）', labelEn: 'Skin Retouching', desc: '肌の質感・くすみを自然に補正（20枚まで）', descEn: 'Natural-looking skin smoothing and tone correction (up to 20 photos)', price: 3800 },
  { key: 'speed', label: 'スピード納品', labelEn: 'Speed Delivery', desc: '撮影日から原則3営業日以内の通常納期を、撮影日の翌営業日（土日祝を除く）に早めるオプションです。', descEn: 'Moves the usual 1–3 business day turnaround up to the next business day after your shoot (excluding weekends/holidays).', price: 3800 },
  { key: 'reschedule', label: 'あんしん振替プラン', labelEn: 'Peace-of-Mind Reschedule Plan', desc: '撮影日の2日前〜当日の急な不調・急用でも、1回まで無料で日程変更できます（3日前までは、プランなしでも無料）', descEn: 'Reschedule once for free from 2 days before up to the day itself — sudden illness or an urgent conflict. (Until 3 days before, rescheduling is free without the plan.)', price: 4800 },
  { key: 'oppositeSexPick', label: '異性スタッフ写真セレクト', labelEn: 'Opposite-Gender Staff Pick', desc: '異性のスタッフ目線でマッチングアプリ受けの良い一枚を選び、おすすめとしてご提案します', descEn: "A staff member of the opposite gender picks the shot they think will land best on dating apps, and suggests it to you.", price: 3800 },
];

export const COUNSELING_QUESTIONS = [
  { id: 'ageBand', type: 'single', label: '年代', options: ['20代前半', '20代後半', '30代前半', '30代後半', '40代以上'] },
  { id: 'apps', type: 'multi', label: '主に使うマッチングアプリ・サービス', options: ['Pairs', 'with', 'Omiai', 'タップル', 'Tinder', 'Bumble', '結婚相談所', 'その他'] },
  { id: 'mainShot', type: 'single', label: 'メインで使いたい写真', options: ['正面の顔メイン', '全身', '趣味の様子', 'おまかせ'] },
  { id: 'impression', type: 'multi', label: '叶えたい印象（複数選択可）', options: ['清潔感', '親しみやすさ', '誠実さ', 'おしゃれ感', '明るさ'] },
  { id: 'mood', type: 'single', label: 'なりたい雰囲気', options: ['爽やか', '落ち着き', '自然体', 'おまかせ'] },
  { id: 'reference', type: 'text', label: '「こんな感じ」という参考イメージ（あれば）', placeholder: '例：休日にカフェで撮ったような自然な感じ' },
  { id: 'avoid', type: 'text', label: '逆に避けたい写真の傾向（あれば）', placeholder: '例：かしこまりすぎ・加工が強い など' },
  { id: 'outfit', type: 'text', label: '当日の服装の予定', placeholder: '例：白シャツ＋ベージュのパンツ' },
  { id: 'change', type: 'single', label: '着替え（2着目）', options: ['持参する', 'なし', '未定'] },
  { id: 'items', type: 'text', label: '写したい小物（メガネ・帽子・アクセサリー等）', placeholder: '例：黒縁メガネ' },
  { id: 'camera', type: 'single', label: '写真を撮られるのは得意ですか？', options: ['得意', 'ふつう', '苦手なのでリードしてほしい'] },
  { id: 'concern', type: 'text', label: '気にしている部分・写り方の希望（あれば）', placeholder: '例：左側から撮られるのが好き' },
  { id: 'other', type: 'text', label: 'その他、事前に伝えておきたいこと', placeholder: '自由記入' },
];

// ---- booking calendar constants ----
export const SLOT_TIMES = (() => {
  const slots = [];
  for (let h = 6; h <= 21; h++) {
    slots.push(String(h).padStart(2, '0') + ':00');
    slots.push(String(h).padStart(2, '0') + ':30');
  }
  return slots; // 06:00〜21:30（最終開始）、22:00終了
})();
export const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];
export const BOOKING_LEAD_DAYS = 3;
export const TOTAL_BOOKING_DAYS = 30;
// 日本の祝日（振替休日・国民の休日を含む）。カレンダーの色分けと、納品期限（営業日）の計算に使う。
// 2028年以降は追記が必要。
export const JP_HOLIDAYS = [
  '2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29', '2026-05-03', '2026-05-04',
  '2026-05-05', '2026-05-06', '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12',
  '2026-11-03', '2026-11-23',
  '2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-21', '2027-03-22', '2027-04-29', '2027-05-03',
  '2027-05-04', '2027-05-05', '2027-07-19', '2027-08-11', '2027-09-20', '2027-09-23', '2027-10-11', '2027-11-03',
  '2027-11-23',
];

export function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function buildBookingDays(count, anchor = new Date()) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + BOOKING_LEAD_DAYS + i);
    const dow = d.getDay();
    const isHoliday = JP_HOLIDAYS.includes(isoDate(d));
    const labelColor = (dow === 0 || isHoliday) ? 'oklch(0.55 0.18 25)' : (dow === 6 ? 'oklch(0.5 0.16 250)' : 'oklch(0.3 0.02 240)');
    days.push({ index: i, date: d, iso: isoDate(d), label: WEEKDAY_JP[dow], dateLabel: (d.getMonth() + 1) + '/' + d.getDate(), labelColor });
  }
  return days;
}

export function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

// カメラマンが受け取る割合（残りがPhotoMatchのプラットフォーム手数料）。
// EXTRA_OPTIONS の料金とあわせ、サーバー側（functions/_lib/pricing.js）も
// ここを直接参照して請求額を計算する。変更はここだけでよい。
// 報酬 = プラン料金 × PHOTOGRAPHER_PAYOUT_RATE ＋ オプション1件につき OPTION_PAYOUT_PER_ITEM。
export const PHOTOGRAPHER_PAYOUT_RATE = 0.5;
export const OPTION_PAYOUT_PER_ITEM = 1100;
// 当日キャンセルのときだけ、カメラマンへ補償として支払う額（税込）。
export const SAME_DAY_CANCEL_COMPENSATION = 2000;

// モニター価格（当選者1回限り・半額）の対象プラン。
export const MONITOR_PLAN_NAMES = ['スタンダード', 'スマホプラン'];
export const monitorPriceFor = (planPrice) => Math.round(planPrice / 2);

const DAY_MS = 24 * 60 * 60 * 1000;

// 日本時間での日付（YYYY-MM-DD）。サーバー（UTC）でもブラウザでも同じ結果になる。
export function jstDateIso(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addDaysToIso(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetweenIso(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS);
}

// お客様都合のキャンセルで、いくら返金し、いくらキャンセル料をいただくか。
// 規約どおり 3日前まで無料／2日前 50%／前日・当日 100%。キャンセル料は
// プラン料金にだけかけ、オプション料金は提供していないので全額返金する。
// 撮影開始時刻を過ぎたらマイページからはキャンセルできない（allowed: false）。
// サーバー（/api/bookings/cancel）とマイページの確認ダイアログで共用する。
export function cancellationQuote(booking, now = new Date()) {
  const start = new Date(`${booking.booking_date}T${String(booking.start_time).slice(0, 5)}:00+09:00`);
  if (!(now < start)) return { allowed: false };
  const daysBefore = daysBetweenIso(jstDateIso(now), booking.booking_date);
  const rate = daysBefore >= 3 ? 0 : daysBefore === 2 ? 0.5 : 1;
  const paid = booking.status === 'pending_payment' ? 0 : booking.total_price;
  const fee = paid ? Math.min(paid, Math.round(booking.plan_price * rate)) : 0;
  return {
    allowed: true,
    daysBefore,
    fee,
    refund: paid - fee,
    photographerComp: paid && daysBefore <= 0 ? SAME_DAY_CANCEL_COMPENSATION : 0,
  };
}

// 日程変更（お客様が同じカメラマン・同じプランで、日時だけを動かす）。
//   ・撮影日の3日前まで（日本時間）：誰でも無料。回数の制限なし
//   ・2日前〜撮影開始前：「あんしん振替プラン」に加入していて、まだ使っていない場合だけ、1回無料
//   ・それ以外：日程変更はできない（キャンセル規定どおりのキャンセルになる）
// サーバー（/api/bookings/reschedule）とマイページで同じ判定を使う。
export const RESCHEDULE_OPTION_KEY = 'reschedule';
export const RESCHEDULABLE_STATUSES = ['paid', 'confirmed', 'requested'];

// カメラマンの「予約を確認しました」。予約の確定・日程変更のたびに確認を求め
// （bookings.ack_requested_at）、PHOTOGRAPHER_ACK_HOURS 時間たっても押されなければ、
// 運営にメールで知らせ、カメラマンにも再度お知らせする（/api/bookings/ack-check）。
export const PHOTOGRAPHER_ACK_HOURS = 3;

// 確認待ちの予約か（確認を求めていて、まだ確認されておらず、有効な予約）。
export function awaitingPhotographerAck(b) {
  return !!(b && b.ack_requested_at && !b.photographer_ack_at && RESCHEDULABLE_STATUSES.includes(b.status));
}
export function rescheduleQuote(booking, now = new Date()) {
  if (!RESCHEDULABLE_STATUSES.includes(booking.status)) return { allowed: false, reason: 'status' };
  const start = new Date(`${booking.booking_date}T${String(booking.start_time).slice(0, 5)}:00+09:00`);
  if (!(now < start)) return { allowed: false, reason: 'started' };
  const daysBefore = daysBetweenIso(jstDateIso(now), booking.booking_date);
  if (daysBefore >= 3) return { allowed: true, daysBefore, usesPlan: false };
  const hasPlan = (booking.options || []).some((o) => o.key === RESCHEDULE_OPTION_KEY);
  if (!hasPlan) return { allowed: false, reason: 'no_plan', daysBefore };
  if (booking.reschedule_plan_used) return { allowed: false, reason: 'plan_used', daysBefore };
  return { allowed: true, daysBefore, usesPlan: true };
}

export const RESCHEDULE_DENIED_MESSAGE = {
  status: 'このご予約は日程変更できません。',
  started: '撮影開始時刻を過ぎたご予約は、日程変更できません。お問い合わせください。',
  no_plan: '撮影日の2日前からの日程変更は、「あんしん振替プラン」にご加入の方のみ可能です。ご都合がつかない場合は、キャンセル（キャンセル規定どおり）をご利用ください。',
  plan_used: '「あんしん振替プラン」の無料の日程変更は、1回までです。すでにご利用済みのため、これ以上は日程変更できません。',
};

// マッチング数保証：申請できるのは、撮影日＋30日（eligible_at）から14日間。
// 申し込み済みの予約は、申請期限が過ぎる（または審査が終わる）まで送金しない。
export const GUARANTEE_WINDOW_DAYS = 30;
export const GUARANTEE_CLAIM_DAYS = 14;
export const guaranteeClaimDeadline = (claim) => addDaysToIso(claim.eligible_at, GUARANTEE_CLAIM_DAYS);
// 送金を止めるべき申請か（申請中、または申込み済みで期限内）。
export function guaranteeBlocksPayout(claim, todayIso = jstDateIso()) {
  if (!claim) return false;
  if (claim.status === 'claimed') return true;
  return claim.status === 'applied' && todayIso <= guaranteeClaimDeadline(claim);
}

// モニター価格の定員（schema.sql の monitor_slots_left() と同じ値）。
export const MONITOR_CAPACITY = 10;

// 運営によるキャンセルの理由（/api/bookings/ops-cancel と運営画面で共用）。
export const OPS_CANCEL_REASONS = {
  photographer: 'カメラマンの都合により撮影ができなくなったため',
  weather: '悪天候により撮影ができなくなったため',
  other: '運営の判断により',
};

// 納品期限（規約第6条：撮影日から最短翌日〜3営業日以内。スピード納品は翌営業日）。
// 営業日は土日・祝日を除く日。
export const SPEED_DELIVERY_OPTION_KEY = 'speed';
export function addBusinessDays(iso, n) {
  let d = iso;
  let left = n;
  while (left > 0) {
    d = addDaysToIso(d, 1);
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6 && !JP_HOLIDAYS.includes(d)) left -= 1;
  }
  return d;
}
export function deliveryDueDate(booking) {
  const speed = (booking.options || []).some((o) => o.key === SPEED_DELIVERY_OPTION_KEY);
  return { date: addBusinessDays(booking.booking_date, speed ? 1 : 3), speed };
}
// 納品リンクとして受け付けるURL（https のみ）。
export const isValidDeliveryUrl = (u) => /^https:\/\/[^\s<>"']{4,490}$/.test(String(u || ''));

// 遅刻キャンセル（集合時間に15分以上遅れた場合。規約第5条）。運営が撮影開始後に
// 処理し、当日キャンセルと同じ扱いにする：プラン料金の100%をいただき、
// オプション料金は返金、カメラマンへは当日キャンセル補償。
export const NO_SHOW_STATUSES = ['paid', 'confirmed', 'requested'];
export function noShowQuote(booking, now = new Date()) {
  const start = new Date(`${booking.booking_date}T${String(booking.start_time).slice(0, 5)}:00+09:00`);
  if (!NO_SHOW_STATUSES.includes(booking.status) || now < start || booking.payout_status === 'released') return { allowed: false };
  const paid = booking.total_price || 0;
  const fee = Math.min(paid, booking.plan_price || 0);
  return { allowed: true, fee, refund: paid - fee, photographerComp: SAME_DAY_CANCEL_COMPENSATION };
}

// 1件の予約についてカメラマンへ振り込む額。キャンセル済みは当日キャンセル補償のみ。
export function photographerPayoutFor(booking) {
  if (booking.status === 'canceled') return booking.photographer_cancel_comp || 0;
  return Math.round(booking.plan_price * PHOTOGRAPHER_PAYOUT_RATE)
    + OPTION_PAYOUT_PER_ITEM * (booking.options || []).length;
}

// 決済待ち（pending_payment）の予約が枠を押さえておく時間（分）。Stripe Checkout の
// 有効期限（CHECKOUT_EXPIRES_MIN。Stripe の最短は30分）より長くしておく。そうしないと、
// 枠が空いたあとに先の人が支払えてしまい、同じ枠に2人が支払える。
// DB の booking_slots ビュー（schema.sql）の interval も同じ値にすること。
export const CHECKOUT_EXPIRES_MIN = 31;
export const PENDING_PAYMENT_HOLD_MIN = 35;

// モニター価格を使った予約が「使用済み」に数えられるか。キャンセル済みと、
// 決済されないまま枠の保持時間（PENDING_PAYMENT_HOLD_MIN）を過ぎた決済待ちは数えない（もう一度使える）。
export function monitorBookingCounts(b, now = new Date()) {
  if (b.status === 'canceled') return false;
  if (b.status === 'pending_payment' && now - new Date(b.created_at) > PENDING_PAYMENT_HOLD_MIN * 60 * 1000) return false;
  return true;
}

export function weatherIconFor(code) {
  if (code == null) return { icon: '', color: 'oklch(0.5 0.05 220)' };
  if (code <= 1) return { icon: '☀', color: 'oklch(0.68 0.17 55)' };
  if (code <= 48) return { icon: '☁', color: 'oklch(0.55 0.02 240)' };
  if (code >= 71 && code <= 77) return { icon: '❄', color: 'oklch(0.65 0.1 230)' };
  return { icon: '☂', color: 'oklch(0.55 0.15 245)' };
}
