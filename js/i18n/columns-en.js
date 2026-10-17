// English text for the column articles in js/data.js (COLUMN_ARTICLES), keyed
// by article id. Mirrors the structure of the Japanese source: title, lead and
// sections[{ h, b }]. The generated HTML stays Japanese (SEO); js/pages/
// column-article.js and column.js swap this in when the visitor picks English.
// Keep the section count in step with COLUMN_ARTICLES — a missing entry just
// falls back to the Japanese text.
export const COLUMN_EN = {
  nagoya: {
    title: 'Getting Dating-App Photos Taken in Nagoya? Time to Retire the Selfie',
    lead: 'Sakae, Osu, Nagoya Castle: Nagoya has photogenic spots within walking distance of each other, which makes it a surprisingly good city for profile shoots. Here is how to get photos for your dating-app profile in Nagoya, compared on cost and time.',
    sections: [
      {
        h: 'Three Ways to Get Photos Done in Nagoya',
        b: '(1) Selfies: free, but they tend to look unnatural and usually get fewer matches than photos taken by someone else. (2) Studio matchmaking photos: high quality, but expensive at ¥20,000–30,000, and the backdrop often ends up looking like an ID photo. (3) On-location shoots: shot in natural light out on the street, they give you a natural, "app-style" photo, and the cost stays down.',
      },
      {
        h: 'Why Outdoor Shoots Suit Dating Apps',
        b: 'What people like in a main dating-app photo is not a polished studio shot but one that looks like it was taken naturally on a day off. With the streets of Sakae or the greenery of Tsurumai Park behind you, you come across as both clean-cut and approachable.',
      },
      {
        h: 'As Little as 45 Minutes in Nagoya and Gifu',
        b: 'PhotoMatch is based in Nagoya and covers Gifu as well. Meet at an easy-to-reach spot such as Sakae or Osu, and the shoot is done in 45 minutes. You can fit it in after work or on a day off, and your photos are usually delivered within 3 business days.',
      },
    ],
  },
  'howto-men': {
    title: 'How to Take Photos That Get Men Noticed on Dating Apps [Save This]',
    lead: 'The same person can get several times more likes depending on the photo. This guide explains how men can take profile photos that get chosen on dating apps, split into main and sub photos.',
    sections: [
      {
        h: 'Your Main Photo Is 90% a Clean Look and a Natural Smile',
        b: 'The main photo sets the first impression, and the rule is an upper-body, front-facing shot with a natural smile. How you lift the corners of your mouth without showing too many teeth, and how you balance looking at the camera with looking away, change the impression a lot. Avoid photos where sunglasses or a hat hide your face, and photos that are heavily edited.',
      },
      {
        h: 'Use Sub Photos to Show Everyday Life and a Touch of the Unexpected',
        b: 'Even if your main photo makes a good impression, a set of sub photos that are all selfies leaves people uneasy. It works best to convey your personality from several angles: a full-length shot in casual clothes, a hobby or outdoor scene, a shot from behind or in profile.',
      },
      {
        h: 'Master Light and Background, and the Likes Will Follow',
        b: 'Soft light on an overcast day and the slanting light of late afternoon make skin look good. Choose an uncluttered background that sets you off. This is hard to do on your own, so leaving it to a pro keeps you from going wrong.',
      },
    ],
  },
  'no-match': {
    title: 'Not Getting Matches on Dating Apps? Your Photos May Be the Cause: 5 Things to Check',
    lead: '"I log in every day and still get no matches": in most cases, the real cause is the photos. Here are five checkpoints you can fix starting today.',
    sections: [
      {
        h: '1. Is Your Main Photo a Selfie?',
        b: 'A selfie does not show how others see you, and it tends to convey a gap with the real you or a lack of confidence. In a great many cases, simply switching to a photo taken by someone else raises the match rate.',
      },
      {
        h: '2. Can Your Face Be Seen Clearly? / 3. Do You Have Only One Photo?',
        b: 'Photos that are dark, far away or heavily edited do not convey your face and get passed over. And with only one photo there is not enough information, which makes people uneasy. Aim for 3 to 5 photos with varied expressions and settings.',
      },
      {
        h: '4. Does It Convey a Clean-Cut Look? / 5. Is There a Full-Body Photo?',
        b: 'A "clean-cut" impression is judged from everything: clothing, hairstyle, even the lived-in feel of the background. Without a full-body photo, people may suspect you are hiding your build. Including one full-length shot in casual clothes works well.',
      },
    ],
  },
  selfie: {
    title: 'Why Are Selfies at a Disadvantage? Why Photos Taken by Others Raise Your Match Rate',
    lead: 'People often say "no selfies," but few can explain why. This article explains why photos taken by someone else have the advantage, from both a psychological and a visual angle.',
    sections: [
      {
        h: 'The 3 Impressions a Selfie Gives Off',
        b: 'Distortion of the face from a lens held at arm\'s length, a lived-in background, and the unconscious impression that "there is no one to take a photo with you." These all work against you.',
      },
      {
        h: 'Photos by Others Capture Your Objective Appeal',
        b: 'Shot from a little farther away, a photo taken by someone else shows natural facial proportions and conveys your overall balance and atmosphere. A photo taken from a third party\'s point of view puts the viewer at ease.',
      },
      {
        h: 'A Pro Can Make It Look Natural, Too',
        b: 'Because the photographer guides your expression and poses, you get a natural shot without the "trying hard" look. Not over-produced, yet polished: you can aim for that fine line.',
      },
    ],
  },
  outfit: {
    title: 'What to Wear in Dating-App Photos: Colors and Choices That Look Clean-Cut',
    lead: 'Clothing changes the impression of a photo a great deal. Here are the colors and silhouettes that make a good impression on a dating-app profile, and the items to avoid.',
    sections: [
      {
        h: 'Start with White, Navy, and Beige',
        b: 'Light, solid colors make skin look good and convey a clean-cut look. A white shirt or a navy knit is a safe choice that suits almost everyone. Avoid loud patterns and all-black outfits, which tend to make your complexion look dull.',
      },
      {
        h: 'Fit: Just Right, or Slightly Roomy',
        b: 'Too oversized hurts the clean-cut look, and too tight looks cramped. A silhouette that fits your body makes a good impression. Bring one or two changes of clothes to the shoot and you can get shots with different impressions.',
      },
      {
        h: 'Use Accessories to Hint at Your Personality',
        b: 'Understated items like a watch or glasses are an effective way to show individuality. But do not overdo it. When in doubt, go simple.',
      },
    ],
  },
  pairs: {
    title: 'Choosing a Main Photo for Pairs Without Mistakes: What Gets You More Likes',
    lead: 'From Pairs, one of the largest dating apps in Japan, to With and Omiai, the main photo matters just as much on every app. Here are the conditions for a main photo that gets more likes.',
    sections: [
      {
        h: 'A Main Photo Is Judged in Half a Second',
        b: 'Users swipe through a huge number of profiles, and the decision is instant. That is why the top priority is choosing a bright photo where your face is clearly visible and you are smiling naturally.',
      },
      {
        h: 'Typical Main Photos to Avoid',
        b: 'Group photos with friends (no one can tell which one is you), over-the-top photo-editing apps, dark or distant photos, and expressionless ID-photo-style shots. All of these tend to get swiped past.',
      },
      {
        h: 'Design the Main and Sub Photos as One Set',
        b: 'The main photo draws people in, and the sub photos fill in your personality. A pro shoot\'s strength is that you can prepare this whole flow in a single session. You can reuse the photos across several apps such as Pairs, With, and Omiai.',
      },
    ],
  },
  price: {
    title: 'How Much Do Matchmaking and Profile Photos Cost? Tips for Keeping Costs Down in Nagoya',
    lead: 'How much does it cost to have a pro take your profile photos? This article explains typical prices for studio and on-location shoots, and how to keep costs down smartly in Nagoya.',
    sections: [
      {
        h: 'Studio Shoots Typically Cost ¥20,000–30,000',
        b: 'Studio matchmaking photos tend to be pricey once hair and makeup and a photo mount are included. The finish is careful, but the monotone backdrop can lack that "dating-app feel."',
      },
      {
        h: 'On-Location Shoots Start Around ¥6,800',
        b: 'On-location shoots, where the photographer comes to you out on the street, are reasonable because there is no studio fee. With natural-light shooting outdoors, you get photos with the ideal feel for dating apps.',
      },
      {
        h: 'Choose by Purpose: The Way to Avoid Mistakes',
        b: 'The right answer is to choose by purpose: a studio for omiai (arranged-meeting) photos, an on-location shoot for dating apps. PhotoMatch specializes in photos for apps, covering Nagoya and Gifu at ¥6,800 and up for 45 minutes.',
      },
    ],
  },
  gifu: {
    title: 'Getting Dating-App Photos Taken in Gifu? Seasonal Spots from Kawaramachi to Shimizu Ryokuchi',
    lead: 'For profile photos in Gifu, the appeal is its calm locations — the old streets of Kawaramachi, green spaces near the station — that feel different from Nagoya. Here are our seasonal picks and how a shoot works.',
    sections: [
      { h: 'Gifu Makes Calm, Natural Shots Easy', b: 'Compared with downtown Nagoya, the area around Gifu Station has a more relaxed flow of people, so it is easy to focus on the shoot without worrying about onlookers. Old streets, green spaces and city streets give plenty of variety. A soft, not-too-urban look comes across as approachable — ideal for a main dating-app photo.' },
      { h: 'Spring: Around Kawaramachi Hiroba', b: 'This area brings together the old streets of Kawaramachi, the Japan-China Friendship Garden and Gifu Park. Lattice-fronted townhouses and garden greenery make for calm, soft photos, and spring adds fresh leaves and flowers for a seasonal feel. About 15 minutes by bus from Gifu Station (¥250).' },
      { h: 'Summer: Around Gifu City Hall & Media Cosmos', b: 'Plenty of shade, plus terraces and cafés to cool off on hot days. Heat and glare can make your face tense in summer, but here you can take breaks in the shade and keep a fresh expression. Natural light filtered through greenery flatters the skin. About 15 minutes by bus from Gifu Station (¥250).' },
      { h: 'Autumn: Shimizu Ryokuchi / Winter: Around Gifu Station', b: 'Shimizu Ryokuchi is a green strip along a stream, about 5 minutes on foot from Gifu Station — trees and water set a calm autumn mood. In winter or when the weather looks iffy, head to the station area: indoor shots at Active G, illuminated night views, cafés and city streets, whatever the weather.' },
      { h: 'Meet at Gifu Station, Shoot for 45 Minutes', b: 'In the Gifu area, PhotoMatch meets at Asty Gifu (in front of Doutor Coffee) at JR Gifu Station. You can decide the location with your photographer based on the season and weather. The shoot takes 45 minutes, prices start at ¥6,800 (tax incl.), and photos are usually delivered within 3 business days.', link: 'More about shooting in Gifu' },
    ],
  },
  'nagoya-spots': {
    title: 'Photogenic Spots in Nagoya: Where to Take Profile Photos, Season by Season',
    lead: 'The background you choose changes how your dating-app profile photo comes across. Here are spots in Nagoya that suit profile photos, organized by season.',
    sections: [
      { h: 'What Makes a Good Spot for Profile Photos', b: 'Three things: (1) an uncluttered background that lets you stand out, (2) natural light that flatters the skin, and (3) a seasonal feel or atmosphere that gives people something to talk about. On dating apps, places that look like "somewhere I went on a day off" work better than famous landmarks themselves.' },
      { h: 'Spring: Shonai Ryokuchi Park', b: 'A park with wide lawns and seasonal flowers. In spring, cherry blossoms and fresh greenery make for bright, open photos. It is easy to get both main and sub photos here — full-length shots on the lawn, soft expressions in the shade of the trees.' },
      { h: 'Summer: Garden Pier Rinko Ryokuen', b: 'The open feel of the harbor, with the sea and sky spreading out before you. The waterfront and green plazas give a fresh, healthy look. By choosing the time of day, you can avoid the glare of strong summer sun and get a natural expression.' },
      { h: 'Autumn: Meijo Park / Winter: Around Sakae Station', b: 'Meijo Park offers trees, lawns and Ofuke Pond for calm photos with natural depth; autumn colors add a mature, gentle mood. In winter, head to Sakae. Streetscapes and shop lights give an urban, polished look, and night street snaps make great sub photos.' },
      { h: 'Ask Your Photographer About the Location', b: 'In the Nagoya area, PhotoMatch meets in front of Oasis 21 in Sakae. You can decide the location with your photographer based on the season, the weather and the look you want. Just tell them something like "I want to look fresh" or "I want a calm feel."', link: 'More about shooting in Nagoya' },
    ],
  },
  'main-sub': {
    title: 'Main Photo vs. Sub Photos on Dating Apps: How Many, and Which Ones?',
    lead: 'You may put effort into your main photo but pick your sub photos almost at random. Each has its own role. Here is how many photos to post and how to combine them.',
    sections: [
      { h: 'The Main Photo Is the Door; Sub Photos Are What Is Inside', b: 'Your main photo is the "door" people see in search results and recommendations: your face clearly visible, bright, with a natural smile. Sub photos are what people check after opening your profile to see what you are like — your overall look, how you spend your days off, a range of expressions — filling in what the main photo cannot.' },
      { h: 'Aim for 3 to 5 Photos', b: 'With just one photo there is too little information, and people hesitate. On the other hand, a row of similar photos actually weakens the impression. Aim for one main photo plus 2–4 sub photos, each telling the viewer something different.' },
      { h: 'Sample Sub-Photo Combinations', b: '(1) A full-length shot in casual clothes (shows your build and style), (2) a profile or looking-away shot (shows your natural side), (3) a shot with a hobby or favorite place (a conversation starter), (4) a shot with a different outfit or location (shows another side of you). Picking from these four gives a well-balanced profile.' },
      { h: 'Sub Photos to Avoid', b: 'Avoid a profile full of group shots where no one can tell which person is you, heavily edited photos, photos from years ago, and photos where your face is too small to see. Photos of only food or scenery also reduce the information about you if there are too many — keep it to one at most and center your profile on photos of you.' },
      { h: 'Get Your Main and Sub Photos in One Shoot', b: 'Preparing main and sub photos on separate days is a hassle. A PhotoMatch shoot takes 45 minutes, changing location, angle and expression as we go, and the Standard plan delivers 20 photos. You can choose your main and sub photos from them, so you get a consistent profile in one go.', link: 'Check availability' },
    ],
  },
  'camera-shy': {
    title: 'Not Comfortable in Front of the Camera? What Happens on the Day, and Tips for a Natural Smile',
    lead: '"I hate having my photo taken." "My smile looks forced." If that sounds like you, a pro shoot is especially worth it. Here is how the day goes and how to look natural on camera.',
    sections: [
      { h: 'The Less You Like Photos, the More a Pro Helps', b: 'Most camera shyness comes from not knowing where to stand or what face to make. In a pro shoot, the photographer guides your position, pose and gaze one step at a time. You do not have to figure anything out, so you can focus on your expression.' },
      { h: 'How the Day Goes', b: 'After booking, you can tell us the look you want and anything you are self-conscious about in the counseling sheet. On the day, we meet at the meeting point, confirm the image you have in mind, and start shooting. The shoot takes 45 minutes and you are free to go when it ends. Photos usually arrive within 3 business days, so you can pick your main and sub photos once you see them.' },
      { h: 'Tips for a Natural Smile', b: 'Expressions that come out during conversation look more natural than a smile made on command, so we recommend chatting with the photographer while shooting. Breathing out before lifting the corners of your mouth, walking while being photographed, and including shots looking away from the camera also help loosen up a stiff expression.' },
      { h: 'Getting Ready the Day Before and On the Day', b: 'Get a good night\'s sleep to avoid puffiness. On the day, tidy your hair and wear clean, everyday clothes. Bring one or two changes of clothes for shots with a different feel, plus small items like lip balm or hand cream to freshen up.' },
      { h: 'It Is Fine to Be Nervous', b: 'Everyone is nervous at the start of a shoot. After a few minutes, most people get used to it and their expression softens. Photographers have seen plenty of nervous clients — just tell them up front that you are not comfortable with photos, and they will go at your pace.', link: 'Meeting points and what to expect on the day' },
    ],
  },
  'omiai-with': {
    title: 'Profile Photos for Omiai and with: Showing Sincerity and Personality',
    lead: 'The basics of a good photo are the same on every app, but what users look for differs a little from app to app. Here is how to choose photos that fit Omiai and with.',
    sections: [
      { h: 'The Basics Are the Same Everywhere', b: 'Your face clearly visible, a bright and natural smile, and a clean look — these three are essential on any app. On top of that, adjusting your main and sub photos to suit each app\'s atmosphere and what its users value makes them even more effective.' },
      { h: 'Omiai: Lead with Sincerity and a Clean Look', b: 'Omiai is known as an app where many people are looking for something serious. For your main photo, choose a bright shot in calm clothing with your face clearly visible. Including a shot in a jacket or collared shirt conveys sincerity. Keep unusual photos and heavy editing to a minimum.' },
      { h: 'with: Sub Photos That Show Your Personality and Hobbies', b: 'with emphasizes meeting people through personality and values, so consistency between your profile text and photos makes a good impression. Sub photos that spark conversation — hobbies, favorite places, natural expressions — also make it easier to start messaging.' },
      { h: 'Using the Same Photos on Several Apps', b: 'It helps to shoot two styles: one more formal and one more casual. You can then swap your main photo per app — the formal one on Omiai, the casual one on with. Bring one change of clothes on the day and you can get both in a single shoot.' },
      { h: 'Check Out Our Pairs Article Too', b: 'The thinking behind a good main photo is the same on Pairs and other apps. We cover what makes a main photo that gets more likes in a separate column.', link: 'Read how to choose your Pairs main photo' },
    ],
  },
};
