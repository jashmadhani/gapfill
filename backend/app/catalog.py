"""Seed catalogue: a Rajasthan + Golden Triangle operator's destinations, hotels, transport and activity vendors.

All names are fictional. Prices are realistic INR for 2026.
"""

INTERESTS = ["heritage", "culture", "food", "adventure", "wildlife", "nature", "shopping", "spiritual",
             "relaxation", "photography", "nightlife", "workshop"]
TIERS = ["budget", "standard", "premium", "luxury"]
PACES = {  # travel style -> (day start, day end, max activities per day)
    "relaxed": ("10:00", "19:00", 2),
    "balanced": ("09:00", "20:30", 3),
    "packed": ("08:00", "22:00", 4),
}

# key: (name, region, tagline, description, lat, lng, tags, ideal_nights, airport, rail, best_months)
DESTINATIONS = {
    "delhi": ("Delhi", "NCR", "Mughal monuments, bazaars and legendary street food",
              "India's capital and the natural gateway for most tours: Old Delhi lanes, Lutyens' boulevards and some of the best food in the country.",
              28.6139, 77.2090, ["heritage", "food", "shopping", "culture"], 1, True, True, "Oct–Mar"),
    "agra": ("Agra", "Uttar Pradesh", "The Taj Mahal and Mughal grandeur",
             "Home of the Taj Mahal, Agra Fort and Mehtab Bagh. Best seen at sunrise, before the crowds.",
             27.1767, 78.0081, ["heritage", "photography", "culture"], 1, False, True, "Oct–Mar"),
    "jaipur": ("Jaipur", "Rajasthan", "The Pink City of forts, bazaars and block prints",
               "Amber Fort, City Palace and bustling bazaars, plus hands-on crafts and one of India's best food scenes.",
               26.9124, 75.7873, ["heritage", "culture", "shopping", "food", "photography", "workshop"], 2, True, True, "Oct–Mar"),
    "ranthambore": ("Ranthambore", "Rajasthan", "Tiger safaris in a thousand-year-old fort forest",
                    "One of India's best chances to see a wild tiger, with a hilltop fort inside the national park.",
                    26.0173, 76.5026, ["wildlife", "nature", "photography", "adventure"], 2, False, True, "Oct–Jun"),
    "pushkar": ("Pushkar", "Rajasthan", "Sacred lake, ghats and a laid-back cafe culture",
                "A small holy town around a lake with 52 ghats, a rare Brahma temple and a relaxed backpacker bazaar.",
                26.4899, 74.5511, ["spiritual", "relaxation", "shopping", "culture"], 1, False, True, "Oct–Mar"),
    "jodhpur": ("Jodhpur", "Rajasthan", "The Blue City beneath mighty Mehrangarh",
                "Blue-washed lanes below one of India's most impressive forts, with ziplines, village safaris and spicy mirchi vadas.",
                26.2389, 73.0243, ["heritage", "adventure", "food", "photography", "culture"], 2, True, True, "Oct–Mar"),
    "jaisalmer": ("Jaisalmer", "Rajasthan", "A living golden fort on the edge of the Thar",
                  "Sandstone havelis, camel safaris in the Sam dunes and folk music nights under desert skies.",
                  26.9157, 70.9083, ["adventure", "culture", "photography", "nightlife", "nature"], 2, True, True, "Nov–Feb"),
    "udaipur": ("Udaipur", "Rajasthan", "The City of Lakes — palaces, boats and sunsets",
                "Romantic lake palaces, rooftop sunsets, cooking classes and folk dance evenings.",
                24.5854, 73.7125, ["relaxation", "culture", "photography", "heritage", "food"], 2, True, True, "Sep–Mar"),
}

# (dest, title, tags, duration, price/person, open, close, io, rating, count, kids, step_free, closed_weekdays, vendor, description)
ACTIVITIES = [
    # Jaipur
    ("jaipur", "Amber Fort Guided Heritage Walk", ["heritage", "culture", "photography"], 150, 1200, "08:00", "17:30", "outdoor", 4.7, 812, True, False, [], "Pink City Heritage Guides",
     "A licensed guide takes you through Amber's ramparts, the Sheesh Mahal mirror palace and the zenana courtyards."),
    ("jaipur", "City Palace & Jantar Mantar Tour", ["heritage", "culture"], 150, 900, "09:30", "17:00", "mixed", 4.5, 604, True, True, [], "Pink City Heritage Guides",
     "The royal residence and the UNESCO-listed stone observatory next door, in one walk."),
    ("jaipur", "Old City Street Food Trail", ["food", "culture", "nightlife"], 150, 1100, "17:00", "22:00", "outdoor", 4.8, 433, True, False, [], "Jaipur Food Walks",
     "Pyaaz kachori, ghewar, lassi in clay cups and a thali to finish, with the stories behind each stall."),
    ("jaipur", "Sanganer Block-Printing Workshop", ["workshop", "culture", "shopping"], 120, 1500, "10:00", "17:00", "indoor", 4.6, 221, True, True, [6], "Sanganer Print Studio",
     "Carve, ink and print your own scarf with a third-generation block-printing family."),
    ("jaipur", "Nahargarh Sunset & Stepwell", ["photography", "relaxation", "heritage"], 120, 600, "15:00", "20:00", "outdoor", 4.4, 390, True, False, [], "Pink City Heritage Guides",
     "Watch the city turn gold from Nahargarh's walls, with a stop at the hidden stepwell."),
    ("jaipur", "Albert Hall Museum", ["heritage", "culture"], 90, 300, "09:00", "17:00", "indoor", 4.3, 512, True, True, [], "Rajasthan Museums Trust",
     "Indo-Saracenic museum with an Egyptian mummy, miniature paintings and royal arms."),
    ("jaipur", "Rajasthani Cooking Class with a Family", ["food", "workshop", "culture"], 180, 2200, "10:00", "20:00", "indoor", 4.9, 178, True, True, [], "Kesar Home Kitchens",
     "Cook dal baati churma and gatte ki sabzi in a family kitchen, then eat together."),
    ("jaipur", "Johari & Bapu Bazaar Shopping Walk", ["shopping", "culture"], 120, 500, "11:00", "21:00", "outdoor", 4.2, 266, True, False, [], "Jaipur Food Walks",
     "Gems, mojaris and textiles with a local who knows fair prices."),
    # Jodhpur
    ("jodhpur", "Mehrangarh Fort Guided Tour", ["heritage", "photography", "culture"], 150, 1000, "09:00", "17:00", "mixed", 4.8, 920, True, True, [], "Marwar Trails",
     "Rajasthan's most impressive fort, with lift access to the museum galleries and ramparts."),
    ("jodhpur", "Mehrangarh Flying Fox Zipline", ["adventure"], 90, 2000, "09:00", "17:00", "outdoor", 4.7, 340, False, False, [], "Flying Fox Jodhpur",
     "Six ziplines over the fort's lakes and walls."),
    ("jodhpur", "Blue City Photo Walk", ["photography", "culture"], 120, 900, "07:00", "18:00", "outdoor", 4.6, 205, True, False, [], "Marwar Trails",
     "The best blue lanes, rooftops and stepwells for photos, with a photographer guide."),
    ("jodhpur", "Umaid Bhawan Palace Museum", ["heritage"], 60, 300, "09:00", "17:00", "indoor", 4.3, 310, True, True, [], "Rajasthan Museums Trust",
     "Art-deco palace museum with vintage cars and royal memorabilia."),
    ("jodhpur", "Bishnoi Village Safari", ["culture", "nature", "adventure"], 240, 2500, "08:00", "17:00", "outdoor", 4.5, 188, True, False, [], "Desert Jeep Co.",
     "Jeep safari to Bishnoi villages: potters, weavers, blackbuck and an opium-tea ceremony."),
    ("jodhpur", "Sardar Market Food Crawl", ["food", "shopping"], 120, 800, "16:00", "22:00", "outdoor", 4.6, 240, True, False, [], "Marwar Trails",
     "Mirchi vada, makhaniya lassi and omelettes at the famous clock-tower stalls."),
    # Udaipur
    ("udaipur", "City Palace Udaipur Tour", ["heritage", "culture"], 150, 1100, "09:30", "17:30", "mixed", 4.7, 701, True, True, [], "Mewar Explorers",
     "Balconies, towers and courtyards of the largest palace complex in Rajasthan."),
    ("udaipur", "Lake Pichola Sunset Boat Ride", ["relaxation", "photography"], 60, 900, "10:00", "19:00", "outdoor", 4.8, 655, True, False, [], "Pichola Boat Club",
     "A shared boat past the Lake Palace and Jag Mandir as the sun sets."),
    ("udaipur", "Bagore Ki Haveli Folk Dance Show", ["culture", "nightlife"], 75, 400, "19:00", "20:30", "indoor", 4.6, 420, True, True, [], "Mewar Explorers",
     "An hour of Rajasthani folk dance and puppetry in an 18th-century haveli."),
    ("udaipur", "Sajjangarh Monsoon Palace Sunset", ["photography", "heritage"], 120, 700, "14:00", "19:30", "outdoor", 4.4, 300, True, False, [], "Mewar Explorers",
     "Hilltop palace with a sweeping view over the lakes and the Aravalli hills."),
    ("udaipur", "Mewari Cooking Class", ["food", "workshop"], 150, 1800, "10:00", "19:00", "indoor", 4.8, 260, True, True, [], "Lakeside Kitchen Studio",
     "Five dishes, a chai masala of your own, and dinner on the rooftop."),
    ("udaipur", "Miniature Painting Workshop", ["workshop", "culture"], 120, 1300, "10:00", "18:00", "indoor", 4.5, 145, True, True, [], "Lakeside Kitchen Studio",
     "Paint a Mewar-school miniature with squirrel-hair brushes and natural pigments."),
    ("udaipur", "Ayurvedic Spa Session", ["relaxation"], 90, 2800, "10:00", "20:00", "indoor", 4.6, 190, False, True, [], "Pichola Wellness",
     "Abhyanga massage and herbal steam overlooking the lake."),
    # Jaisalmer
    ("jaisalmer", "Golden Fort & Havelis Walk", ["heritage", "photography", "culture"], 180, 900, "08:00", "18:00", "outdoor", 4.7, 510, True, False, [], "Thar Trails",
     "Inside the living fort, then Patwon ki Haveli's carved facades."),
    ("jaisalmer", "Sam Dunes Camel Safari & Sunset", ["adventure", "photography", "nature"], 180, 2200, "15:00", "20:00", "outdoor", 4.8, 620, True, False, [], "Thar Trails",
     "Camel ride into the dunes for sunset, with chai on the sand."),
    ("jaisalmer", "Desert Camp Folk Night & Dinner", ["nightlife", "culture", "food"], 180, 2500, "19:00", "23:00", "outdoor", 4.6, 380, True, False, [], "Dunes Camp Co.",
     "Kalbeliya dancers, Manganiyar musicians and a Rajasthani buffet under the stars."),
    ("jaisalmer", "Gadisar Lake Morning Walk", ["relaxation", "photography"], 60, 200, "06:30", "11:00", "outdoor", 4.4, 210, True, True, [], "Thar Trails",
     "Temples, ghats and pelicans on the old reservoir."),
    ("jaisalmer", "Dune Bashing Jeep Safari", ["adventure"], 90, 3000, "14:00", "19:00", "outdoor", 4.5, 150, False, False, [], "Desert Jeep Co.",
     "A 4x4 roller-coaster over the dunes."),
    ("jaisalmer", "Kuldhara Abandoned Village", ["heritage", "culture"], 120, 600, "08:00", "18:00", "outdoor", 4.2, 180, True, False, [], "Desert Jeep Co.",
     "The eerie, beautifully preserved village abandoned overnight in 1825."),
    # Pushkar
    ("pushkar", "Pushkar Ghats & Brahma Temple", ["spiritual", "culture"], 120, 300, "06:00", "20:00", "outdoor", 4.5, 330, True, False, [], "Pushkar Walks",
     "A gentle walk round the sacred lake and to one of the world's few Brahma temples."),
    ("pushkar", "Savitri Temple Ropeway Sunrise", ["spiritual", "photography"], 120, 500, "05:30", "12:00", "outdoor", 4.6, 240, True, False, [], "Pushkar Walks",
     "Ropeway up to the hilltop temple for sunrise over the lake."),
    ("pushkar", "Pushkar Bazaar & Cafe Trail", ["shopping", "food", "relaxation"], 120, 600, "10:00", "22:00", "outdoor", 4.3, 205, True, False, [], "Pushkar Walks",
     "Silver, leather and rose products, with falafel and malpua stops."),
    ("pushkar", "Hot Air Balloon Ride", ["adventure", "photography"], 60, 12000, "06:00", "09:00", "outdoor", 4.8, 90, False, False, [], "Sky Waltz Balloons",
     "Float over the lake and the desert at dawn."),
    # Ranthambore
    ("ranthambore", "Tiger Safari — Morning Canter", ["wildlife", "nature", "adventure"], 210, 1800, "06:30", "10:00", "outdoor", 4.6, 890, True, False, [], "Ranthambore Safari Desk",
     "Shared 20-seat canter through the park's zones at first light."),
    ("ranthambore", "Tiger Safari — Private Gypsy", ["wildlife", "photography"], 210, 5500, "14:30", "18:30", "outdoor", 4.8, 410, True, False, [], "Ranthambore Safari Desk",
     "A 6-seat gypsy with a naturalist, best odds for sightings and photos."),
    ("ranthambore", "Ranthambore Fort Hike", ["heritage", "nature"], 150, 400, "08:00", "17:00", "outdoor", 4.4, 260, True, False, [], "Ranthambore Safari Desk",
     "Climb to the 10th-century fort and Ganesh temple inside the reserve."),
    ("ranthambore", "Dastkar Craft Village Visit", ["workshop", "culture", "shopping"], 90, 500, "10:00", "18:00", "indoor", 4.3, 120, True, True, [], "Ranthambore Safari Desk",
     "Women's craft cooperative: block printing, patchwork and papier-mâché."),
    # Agra
    ("agra", "Taj Mahal Sunrise Guided Tour", ["heritage", "photography"], 180, 2000, "06:00", "18:00", "outdoor", 4.9, 1500, True, True, [4], "Agra Heritage Walks",
     "Enter at sunrise with a guide who knows the best angles. Closed Fridays."),
    ("agra", "Agra Fort Guided Visit", ["heritage", "culture"], 120, 900, "06:00", "18:00", "mixed", 4.6, 700, True, False, [], "Agra Heritage Walks",
     "The red-sandstone fort where Shah Jahan spent his last years looking at the Taj."),
    ("agra", "Mehtab Bagh Sunset View", ["photography", "relaxation"], 60, 300, "15:00", "19:00", "outdoor", 4.5, 350, True, True, [], "Agra Heritage Walks",
     "The Taj from across the Yamuna at golden hour."),
    ("agra", "Mughlai Food Walk", ["food"], 120, 900, "17:00", "22:00", "outdoor", 4.5, 210, True, False, [], "Agra Heritage Walks",
     "Bedai, petha and Mughlai kebabs in the old city."),
    # Delhi
    ("delhi", "Old Delhi Rickshaw & Food Walk", ["food", "culture"], 180, 1500, "08:00", "20:00", "outdoor", 4.7, 980, True, False, [], "Dilli Trails",
     "Chandni Chowk by cycle-rickshaw, Jama Masjid, and paranthas, jalebis and kulfi."),
    ("delhi", "Humayun's Tomb & Lodhi Garden", ["heritage", "photography"], 120, 800, "06:00", "18:00", "outdoor", 4.6, 540, True, True, [], "Dilli Trails",
     "The garden tomb that inspired the Taj, then a stroll through Lodhi Garden."),
    ("delhi", "National Museum Highlights", ["heritage", "culture"], 120, 650, "10:00", "18:00", "indoor", 4.4, 300, True, True, [0], "Dilli Trails",
     "Harappan seals to Mughal miniatures in two hours. Closed Mondays."),
    ("delhi", "Dilli Haat Crafts Evening", ["shopping", "food"], 120, 200, "10:30", "22:00", "outdoor", 4.3, 410, True, True, [], "Dilli Trails",
     "Crafts from every state and regional food stalls."),
]

# per dest: [(tier, name, price per room-night, rating, amenities)]
HOTELS = {
    "delhi": [("budget", "Paharganj Comfort Inn", 2000, 3.9), ("standard", "Connaught Residency", 5500, 4.3),
              ("premium", "Lodhi Garden Suites", 12000, 4.6), ("luxury", "Raisina Grand", 24000, 4.8)],
    "agra": [("budget", "Taj View Inn", 1800, 3.9), ("standard", "Mughal Gardens Hotel", 4500, 4.2),
             ("premium", "Yamuna Riverside", 10000, 4.6), ("luxury", "Shahjahan Palace Agra", 25000, 4.8)],
    "jaipur": [("budget", "Pink Pearl Inn", 2200, 4.0), ("standard", "Hotel Kesar Haveli", 5200, 4.4),
               ("premium", "Chandni Bagh Retreat", 11500, 4.6), ("luxury", "Amer Vilas Palace", 26000, 4.9)],
    "ranthambore": [("budget", "Jungle Trail Lodge", 2000, 3.9), ("standard", "Tiger Den Resort", 5500, 4.3),
                    ("premium", "Ranthambore Forest Retreat", 12000, 4.6), ("luxury", "Kachida Valley Luxury Camp", 28000, 4.8)],
    "pushkar": [("budget", "Ghat View Guesthouse", 1200, 4.0), ("standard", "Pushkar Garden Inn", 3500, 4.2),
                ("premium", "Aravalli Resort Pushkar", 8000, 4.5), ("luxury", "Sarovar Luxury Tents", 15000, 4.7)],
    "jodhpur": [("budget", "Blue Door Stay", 1800, 4.1), ("standard", "Marwar Haveli", 4600, 4.4),
                ("premium", "Sun City Residency", 9800, 4.5), ("luxury", "Mandore Palace Resort", 22000, 4.8)],
    "jaisalmer": [("budget", "Golden Sand Guesthouse", 1600, 4.0), ("standard", "Haveli Swarna", 4200, 4.3),
                  ("premium", "Thar Oasis Resort", 9000, 4.5), ("luxury", "Dunes Royal Tents", 19000, 4.7)],
    "udaipur": [("budget", "Lakeview Nest", 2400, 4.1), ("standard", "Pichola Haveli", 5800, 4.5),
                ("premium", "Fateh Garden Resort", 12500, 4.6), ("luxury", "Aravalli Lake Palace", 32000, 4.9)],
}
TIER_AMENITIES = {
    "budget": ["Wi-Fi", "Breakfast"], "standard": ["Wi-Fi", "Breakfast", "Rooftop restaurant"],
    "premium": ["Wi-Fi", "Breakfast", "Pool", "Lift"], "luxury": ["Wi-Fi", "All meals", "Pool", "Spa", "Lift", "Butler"],
}

# (name, mode, rate, contact) — car: ₹/km per vehicle; train: ₹/km per person; flight: base ₹ per person (+₹4/km)
TRANSPORT = [
    ("Rajputana Cabs", "car", 14, "Dispatch desk"),
    ("Marwar Rail Desk", "train", 1.7, "Rail bookings"),
    ("SkyLink Air", "flight", 3200, "Corporate sales"),
]

CUSTOMERS = [
    ("Aanya Sharma", "aanya@example.com", "+91 98200 11223", "Mumbai", "couple", ["heritage", "food", "culture", "photography"]),
    ("Rohan & Meera Iyer", "rohan.iyer@example.com", "+91 98450 22110", "Bengaluru", "family", ["wildlife", "heritage", "nature"]),
    ("Sophie Laurent", "sophie.l@example.com", "+33 6 12 34 56 78", "Lyon", "solo", ["culture", "workshop", "food", "photography"]),
    ("Kapoor Family", "vikram.kapoor@example.com", "+91 98110 33445", "Delhi", "family", ["relaxation", "heritage", "food"]),
    ("Northwind Analytics Offsite", "hr@northwind.example.com", "+91 80 4000 1234", "Hyderabad", "corporate", ["adventure", "culture", "nightlife"]),
    ("Daniel & Priya Okafor", "okafor@example.com", "+44 7700 900123", "London", "couple", ["relaxation", "culture", "food"]),
    ("Arjun Mehta", "arjun.m@example.com", "+91 99870 55667", "Pune", "friends", ["adventure", "nightlife", "photography"]),
]

COORDINATORS = [
    ("Rajveer Singh", "+91 94140 10001", "jaipur", ["Hindi", "English"]),
    ("Kavya Rathore", "+91 94140 10002", "udaipur", ["Hindi", "English", "French"]),
    ("Imran Qureshi", "+91 94140 10003", "jodhpur", ["Hindi", "English", "Urdu"]),
    ("Neha Bhati", "+91 94140 10004", "delhi", ["Hindi", "English", "German"]),
]

REVIEW_SNIPPETS = {
    5: ["Absolutely the highlight of our trip.", "Guide was brilliant and on time.", "Worth every rupee.", "Would book again tomorrow."],
    4: ["Really good, a bit crowded.", "Great experience, started a little late.", "Lovely, would recommend."],
    3: ["Okay, but felt rushed.", "Fine, not memorable."],
}

# Extra demo data (more cities, experiences at real coordinates, travelers, tours) lives in catalog_extra.
from .catalog_extra import (ACT_COORDS, EXTRA_ACTIVITIES, EXTRA_COORDINATORS, EXTRA_CUSTOMERS,  # noqa: E402
                            EXTRA_DESTINATIONS, EXTRA_HOTELS)

DESTINATIONS.update(EXTRA_DESTINATIONS)
ACTIVITIES += EXTRA_ACTIVITIES
HOTELS.update(EXTRA_HOTELS)
CUSTOMERS += EXTRA_CUSTOMERS
COORDINATORS += EXTRA_COORDINATORS
