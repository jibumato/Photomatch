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
};
