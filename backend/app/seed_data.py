"""Static seed data for the Jaipur demo city. All values are deterministic."""

LOCATIONS = {
    "hotel": ("Umaid Haveli Hotel, Bani Park", 26.9270, 75.7950),
    "amber_fort": ("Amber Fort", 26.9855, 75.8513),
    "jal_mahal": ("Jal Mahal", 26.9534, 75.8462),
    "nahargarh": ("Nahargarh Fort", 26.9373, 75.8155),
    "hawa_mahal": ("Hawa Mahal", 26.9239, 75.8267),
    "city_palace": ("City Palace", 26.9258, 75.8237),
    "johari_bazaar": ("Johari Bazaar", 26.9209, 75.8262),
    "mi_road": ("MI Road", 26.9160, 75.8120),
    "albert_hall": ("Albert Hall Museum", 26.9117, 75.8195),
    "c_scheme": ("C-Scheme", 26.9080, 75.8000),
    "sanganer": ("Sanganer", 26.8000, 75.7950),
}

# Precomputed door-to-door minutes by auto-rickshaw/cab (symmetric). No live maps API is called.
TRAVEL_MINUTES = {
    ("hotel", "amber_fort"): 38,
    ("hotel", "jal_mahal"): 28,
    ("hotel", "nahargarh"): 14,
    ("hotel", "hawa_mahal"): 17,
    ("hotel", "city_palace"): 16,
    ("hotel", "johari_bazaar"): 17,
    ("hotel", "mi_road"): 13,
    ("hotel", "albert_hall"): 17,
    ("hotel", "c_scheme"): 13,
    ("hotel", "sanganer"): 60,
    ("amber_fort", "jal_mahal"): 19,
    ("amber_fort", "nahargarh"): 30,
    ("amber_fort", "hawa_mahal"): 33,
    ("amber_fort", "city_palace"): 33,
    ("amber_fort", "johari_bazaar"): 35,
    ("amber_fort", "mi_road"): 39,
    ("amber_fort", "albert_hall"): 39,
    ("amber_fort", "c_scheme"): 44,
    ("amber_fort", "sanganer"): 88,
    ("jal_mahal", "nahargarh"): 19,
    ("jal_mahal", "hawa_mahal"): 20,
    ("jal_mahal", "city_palace"): 20,
    ("jal_mahal", "johari_bazaar"): 21,
    ("jal_mahal", "mi_road"): 26,
    ("jal_mahal", "albert_hall"): 26,
    ("jal_mahal", "c_scheme"): 32,
    ("jal_mahal", "sanganer"): 74,
    ("nahargarh", "hawa_mahal"): 12,
    ("nahargarh", "city_palace"): 11,
    ("nahargarh", "johari_bazaar"): 13,
    ("nahargarh", "mi_road"): 14,
    ("nahargarh", "albert_hall"): 16,
    ("nahargarh", "c_scheme"): 19,
    ("nahargarh", "sanganer"): 65,
    ("hawa_mahal", "city_palace"): 6,
    ("hawa_mahal", "johari_bazaar"): 6,
    ("hawa_mahal", "mi_road"): 12,
    ("hawa_mahal", "albert_hall"): 11,
    ("hawa_mahal", "c_scheme"): 17,
    ("hawa_mahal", "sanganer"): 60,
    ("city_palace", "johari_bazaar"): 7,
    ("city_palace", "mi_road"): 11,
    ("city_palace", "albert_hall"): 11,
    ("city_palace", "c_scheme"): 17,
    ("city_palace", "sanganer"): 61,
    ("johari_bazaar", "mi_road"): 11,
    ("johari_bazaar", "albert_hall"): 10,
    ("johari_bazaar", "c_scheme"): 17,
    ("johari_bazaar", "sanganer"): 59,
    ("mi_road", "albert_hall"): 8,
    ("mi_road", "c_scheme"): 11,
    ("mi_road", "sanganer"): 56,
    ("albert_hall", "c_scheme"): 13,
    ("albert_hall", "sanganer"): 54,
    ("c_scheme", "sanganer"): 52,
}

SAME_PLACE_MINUTES = 3

VENDORS = [
    {"key": "trails", "name": "Pinkcity Trails", "contact_channel": "whatsapp:+91 98290 11111"},
    {"key": "print", "name": "Sanganer Print House", "contact_channel": "whatsapp:+91 98290 22222"},
    {"key": "kitchen", "name": "Chaat Corner Collective", "contact_channel": "whatsapp:+91 98290 33333"},
    {"key": "nahargarh", "name": "Nahargarh Adventures", "contact_channel": "whatsapp:+91 98290 44444"},
    {"key": "afterdark", "name": "Jaipur After Dark", "contact_channel": "whatsapp:+91 98290 55555"},
]

A = lambda sf=False, seat=False, wc=False, sens=False: {  # noqa: E731
    "step_free": sf, "seating_available": seat, "restroom_onsite": wc, "sensory_friendly": sens,
}
ALL_GROUPS = ["solo", "couple", "family", "large_group"]

# reviews: list of (rating, days_ago, text)
EXPERIENCES = [
    {
        "key": "street_food", "vendor": "trails", "title": "Old City Street Food Trail",
        "description": "Walk the lanes of Johari Bazaar tasting pyaaz kachori, ghevar and kulhad chai with a local foodie guide.",
        "tags": ["food", "walking", "local"], "price": 800, "duration": 120, "loc": "johari_bazaar",
        "access": A(), "groups": ALL_GROUPS, "hours": ("10:00", "21:00"), "io": "outdoor", "cap": 12,
        "reviews": [(5, 6, "Best kachori of my life."), (5, 20, "Guide was hilarious and knew everyone."),
                    (4, 45, "Loved it, a bit crowded."), (5, 130, "Must do.")],
    },
    {
        "key": "sunrise_walk", "vendor": "trails", "title": "Jal Mahal Sunrise Photo Walk",
        "description": "Golden-hour photo walk along Man Sagar lake with tips on framing the floating palace.",
        "tags": ["culture", "photography", "walking"], "price": 350, "duration": 40, "loc": "jal_mahal",
        "access": A(sf=True), "groups": ["solo", "couple", "family"], "hours": ("06:00", "10:30"), "io": "outdoor", "cap": 10,
        "reviews": [(5, 12, "Stunning light."), (4, 70, "Short but sweet."), (4, 200, "Nice tips.")],
    },
    {
        "key": "cycling", "vendor": "trails", "title": "Heritage Cycling at Dawn",
        "description": "Early-morning cycle loop past the Aravalli foothills and Jal Mahal before the traffic wakes up.",
        "tags": ["adventure", "outdoors", "active"], "price": 1200, "duration": 90, "loc": "jal_mahal",
        "access": A(), "groups": ["solo", "couple"], "hours": ("06:00", "09:30"), "io": "outdoor", "cap": 8,
        "reviews": [(4, 30, "Great workout."), (5, 95, "Loved the quiet roads.")],
    },
    {
        "key": "block_print", "vendor": "print", "title": "Hand Block-Printing Workshop",
        "description": "Carve-free block printing with natural dyes in a 3rd-generation Sanganer workshop. Take home your own scarf.",
        "tags": ["workshop", "craft", "culture"], "price": 1500, "duration": 120, "loc": "sanganer",
        "access": A(sf=True, seat=True, wc=True, sens=True), "groups": ["solo", "couple", "family"], "hours": ("10:00", "18:00"), "io": "indoor", "cap": 10,
        "reviews": [(5, 8, "Magical, very patient teachers."), (5, 25, "Kids loved it."), (5, 60, "Worth the drive."), (4, 300, "A bit far.")],
    },
    {
        "key": "thali_class", "vendor": "kitchen", "title": "Rajasthani Thali Cooking Class",
        "description": "Cook dal baati churma and gatte ki sabzi in a home kitchen, then eat everything you made.",
        "tags": ["food", "workshop", "local"], "price": 1800, "duration": 150, "loc": "c_scheme",
        "access": A(sf=True, seat=True, wc=True), "groups": ["solo", "couple", "family"], "hours": ("10:00", "20:00"), "io": "indoor", "cap": 6,
        "reviews": [(5, 15, "Aunty is a legend."), (4, 50, "Lots of food!"), (5, 180, "Recipes emailed after.")],
    },
    {
        "key": "lassi", "vendor": "kitchen", "title": "Lassi & Kachori Tasting",
        "description": "A quick, seated tasting flight of saffron lassi and three kachori styles at a 1940s MI Road counter.",
        "tags": ["food", "quick", "local"], "price": 300, "duration": 45, "loc": "mi_road",
        "access": A(sf=True, seat=True), "groups": ALL_GROUPS, "hours": ("09:00", "22:00"), "io": "indoor", "cap": 20,
        "reviews": [(5, 3, "Quick and delicious."), (4, 18, "Lassi was thick as cream."), (5, 40, "Perfect snack stop."),
                    (4, 110, "Good value.")],
    },
    {
        "key": "trek", "vendor": "nahargarh", "title": "Nahargarh Sunset Trek",
        "description": "Guided ridge trek up to Nahargarh Fort with chai at the top as the city lights up.",
        "tags": ["adventure", "outdoors", "views"], "price": 900, "duration": 150, "loc": "nahargarh",
        "access": A(), "groups": ["solo", "couple", "large_group"], "hours": ("14:00", "19:30"), "io": "outdoor", "cap": 15,
        "reviews": [(5, 10, "Views were unreal."), (5, 35, "Tough but worth it."), (3, 400, "Guide was late (old review).")],
    },
    {
        "key": "zipline", "vendor": "nahargarh", "title": "Fort Zipline Ride",
        "description": "Short harnessed zipline run over the Nahargarh ramparts. Quick adrenaline hit.",
        "tags": ["adventure", "quick", "views"], "price": 1100, "duration": 60, "loc": "nahargarh",
        "access": A(wc=True), "groups": ["solo", "couple", "large_group"], "hours": ("10:00", "17:30"), "io": "outdoor", "cap": 20,
        # Old reviews glowing, recent ones poor: recency weighting pulls the trust score down.
        "reviews": [(5, 380, "Amazing!"), (5, 350, "Loved it"), (5, 300, "Great staff"), (2, 12, "Harness felt worn, long wait."),
                    (2, 25, "Queue of 90 minutes."), (3, 40, "OK but overpriced now.")],
    },
    {
        "key": "folk_night", "vendor": "afterdark", "title": "Rooftop Folk Music Night",
        "description": "Live Manganiyar folk performance on a rooftop overlooking MI Road, with mocktails and snacks.",
        "tags": ["nightlife", "music", "culture"], "price": 1200, "duration": 120, "loc": "mi_road",
        "access": A(seat=True, wc=True), "groups": ["solo", "couple", "large_group"], "hours": ("18:00", "23:30"), "io": "mixed", "cap": 30,
        "reviews": [(5, 5, "Goosebumps."), (5, 22, "Magical evening."), (4, 90, "Loud but fun.")],
    },
    {
        "key": "puppet", "vendor": "afterdark", "title": "Kathputli Puppet Show",
        "description": "Traditional Rajasthani string-puppet show in the Albert Hall courtyard theatre, with a puppet-maker Q&A.",
        "tags": ["culture", "family", "performance"], "price": 400, "duration": 60, "loc": "albert_hall",
        "access": A(sf=True, seat=True, wc=True, sens=False), "groups": ALL_GROUPS, "hours": ("11:00", "19:00"), "io": "indoor", "cap": 40,
        "reviews": [(4, 9, "Kids were glued."), (5, 28, "Charming."), (4, 75, "Short but lovely.")],
    },
    {
        "key": "museum_audio", "vendor": "afterdark", "title": "Albert Hall Museum Audio Tour",
        "description": "Self-paced audio story tour of Egyptian mummies, miniature paintings and Indo-Saracenic architecture.",
        "tags": ["culture", "museum", "history"], "price": 500, "duration": 75, "loc": "albert_hall",
        "access": A(sf=True, seat=True, wc=True, sens=True), "groups": ALL_GROUPS, "hours": ("09:00", "17:00"), "io": "indoor", "cap": 50,
        "reviews": [(4, 14, "Air-conditioned bliss."), (4, 60, "Good narration."), (5, 150, "Gorgeous building.")],
    },
    {
        "key": "gem_cutting", "vendor": "trails", "title": "Gem-Cutting Studio Visit",
        "description": "Watch master lapidaries cut emeralds and garnets, then try polishing a stone yourself.",
        "tags": ["workshop", "craft", "shopping"], "price": 600, "duration": 60, "loc": "johari_bazaar",
        "access": A(seat=True, sens=True), "groups": ["solo", "couple", "family"], "hours": ("10:00", "19:00"), "io": "indoor", "cap": 8,
        "reviews": [(4, 16, "No hard sell, very cool."), (4, 48, "Learned a lot."), (3, 220, "Bit touristy.")],
    },
]

TRAVELER = {
    "display_name": "Aanya (demo traveler)", "group_type": "couple", "accessibility_flags": [], "home_currency": "INR",
}

DEFAULT_BUDGET = 3000

# (title, start, end, location_key, type, experience_key, slot_start, slot_end)
SAMPLE_ITINERARY = [
    ("Breakfast at the haveli", "07:30", "08:15", "hotel", "booked", None, None, None),
    ("Amber Fort guided tour (pre-booked)", "10:00", "12:00", "amber_fort", "booked", None, None, None),
    ("City Palace timed entry", "15:30", "16:30", "city_palace", "booked", None, None, None),
    # Previously accepted suggestion, filling the 16:30–19:20 idle window. This is the item disruptions hit in the demo.
    (None, "16:40", "18:40", "johari_bazaar", "suggested", "street_food", "16:30", "19:20"),
    ("Dinner reservation — Suvarna Mahal", "19:20", "21:00", "c_scheme", "booked", None, None, None),
]

DEMAND_SEED = [
    ("area:johari_bazaar", "food", 14), ("area:johari_bazaar", "shopping", 6), ("area:mi_road", "food", 9),
    ("area:mi_road", "nightlife", 7), ("area:albert_hall", "culture", 8), ("area:albert_hall", "indoor", 5),
    ("area:nahargarh", "adventure", 6), ("area:sanganer", "workshop", 3), ("area:c_scheme", "food", 4),
]
