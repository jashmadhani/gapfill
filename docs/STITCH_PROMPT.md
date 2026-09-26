# Google Stitch prompt — TourCraft mobile app

Paste everything below the line into Google Stitch (mobile, 390 × 844). Generate each screen separately if Stitch asks.

---

Design a mobile travel app called **TourCraft** that plans and runs personalised tours of Rajasthan and the Golden Triangle (Jaipur, Udaipur, Jodhpur, Jaisalmer, Agra, Delhi and more). The app must feel calm, premium and extremely easy to read: minimal text, large type, big rounded cards, lots of breathing room, and never more than 4–5 choices on a screen.

**Visual style**
- Layout language like modern outdoor-travel apps: huge rounded cards (28–36 px radius), full-bleed photography inside cards, pill-shaped chips and buttons, generous 20–24 px side margins and 24–32 px gaps between sections.
- Typography: Outfit (or a similar geometric grotesk) for headings — 36–40 px extra-bold titles, 22–24 px section titles; Plus Jakarta Sans for body at 16–17 px. Uppercase letter-spaced eyebrows (13 px, bold) above big titles.
- Colour: misty steel-blue background (#EAF0F7), white cards, near-black navy (#0C1626) for active chips and the navigation bar, ocean blue (#1F4F8F) for primary actions, green (#16A34A) for completed/visited, orange (#EA580C) for "plan changed". High contrast text only — no light grey body text.
- Icons: bold 2 px stroke line icons, 20–24 px.
- Bottom navigation: a floating near-black pill bar with 4 icons (Discover, Plan, Trip, Assist); the active item becomes a white pill with icon + label.

**Screen 1 — Discover (home)**
- Top row: "Hi, Aanya" on the left; a white pill on the right with a sun icon and "Clear skies".
- Eyebrow "DAY 2 OF 7 · JAIPUR" with a pin icon, then the title "Royal Rajasthan for Two" in 40 px extra-bold. A tall white rounded search button sits to the right of the title.
- A horizontal row of interest chips: selected chips are near-black with white text and an icon (Heritage, Food, Culture); unselected are white.
- Section "Your story so far" with a **coverflow carousel**: one large photo card in the centre (Jaipur's Amber Fort) with a "You're here" badge, an arrow button top-right, eyebrow "STOP 1 · DAY 1", the city name in 32 px bold, and two frosted chips ("2 nights", "6 plans"). The previous and next cards peek out on both sides, smaller and faded. Dots under the carousel show position.
- A dark navy "Up next" card: a rounded square with a clock and "12:23", then "UP NEXT" and "Rajasthani Cooking Class", with an arrow.
- Section "Your route": a light map card showing a road-accurate route through Jaipur → Jodhpur → Udaipur. The travelled part is solid green with a ✓ pin, the current city is a pulsing blue numbered pin, and upcoming parts are dashed blue. Inside the map, bottom-left, a dark Route/Today toggle and a white "579 km by road" pill. Under the map, a selected-stop row: a photo thumbnail, the city name, "2 nights · You're here" and a round dark arrow button.

**Screen 2 — Trip (today)**
- Eyebrow "SAT, 26 SEPT · 11:30 AM", title "Day 2 in Jaipur", and a thin progress bar labelled "On tour · day 2 of 7".
- A large photo card for the current activity: a "Happening now" badge, a booking code pill, a big time "9:56 AM", the title "Amber Fort Guided Heritage Walk" and the vendor name.
- Three square action tiles: Swap, Ask, Directions.
- "Today's route" map card zoomed into the city: the hotel pin "H", then numbered activity pins 1-2-3 joined by a street-level route.
- "Today" timeline: a thin vertical rail with dots (green = done, pulsing blue = now, grey = later). Each stop is a white card with a big time at the top ("1:07 PM"), a coloured category icon tile, a bold title and one line of detail ("150 min · ₹1,800"), and small swap/remove icon buttons on the right.
- A full-width "Report a change" pill button; a "Tomorrow · Jodhpur · 3 plans" card with a photo; a coordinator card with initials, name, languages and a large green call button.

**Screen 3 — Plan**
- Eyebrow "DRAFT PLAN · TC-2616", title "Mount Abu · Jodhpur — 4 days", and white info chips (dates, 8 travelers, Standard stays, Balanced pace).
- A route map card with a horizontal row of stop cards under it (photo thumbnail, "1. Mount Abu", "1 night · 17 Oct").
- A budget card: "₹1,02,979 of ₹1,20,000" with a green progress bar and "₹17,021 under budget".
- Day-by-day timeline in the same style as the Trip screen, with a floating "Review price & book" primary pill above the nav bar.

**Screen 4 — Report a change (bottom sheet)**
- A sheet with the title "What changed?" and four large rows, each with an icon in a soft blue circle: Running late, It's raining, Change my budget, Something else. Each row has one short line of explanation.

Avoid: dense tables, small grey text, more than one primary button per screen, emoji used as icons, and long paragraphs.
