"""Extra demo data: four more cities, ~100 more experiences at real landmark coordinates, more travelers and tours.

Merged into catalog.py at import time. All businesses and people are fictional; landmarks are real.
"""

EXTRA_DESTINATIONS = {
    "bikaner": ("Bikaner", "Rajasthan", "Camel country, Junagarh Fort and the famous bhujia",
                "A desert trading town with a never-conquered fort, carved sandstone havelis and India's camel research farm.",
                28.0229, 73.3119, ["heritage", "food", "culture", "adventure"], 1, False, True, "Oct–Mar"),
    "chittorgarh": ("Chittorgarh", "Rajasthan", "India's largest fort and the legend of Rani Padmini",
                    "A hilltop fort that runs for 13 km, with victory towers, palaces and reservoirs built over eight centuries.",
                    24.8887, 74.6269, ["heritage", "culture", "photography"], 1, False, True, "Oct–Mar"),
    "mount_abu": ("Mount Abu", "Rajasthan", "Rajasthan's only hill station, lakes and Dilwara marble",
                  "Cool forest air, Nakki Lake and the most intricate marble temples in India.",
                  24.5926, 72.7156, ["nature", "spiritual", "relaxation", "adventure"], 2, False, True, "Sep–Jun"),
    "bundi": ("Bundi", "Rajasthan", "Stepwells, murals and the fort Kipling loved",
              "A small blue town under Taragarh Fort, full of stepwells and some of Rajasthan's finest palace murals.",
              25.4305, 75.6499, ["heritage", "photography", "culture", "relaxation"], 1, False, True, "Oct–Mar"),
}

# Real landmark coordinates for the original activities (seed used a jitter around the city centre before).
ACT_COORDS = {
    "Amber Fort Guided Heritage Walk": (26.9855, 75.8513), "City Palace & Jantar Mantar Tour": (26.9258, 75.8237),
    "Old City Street Food Trail": (26.9209, 75.8262), "Sanganer Block-Printing Workshop": (26.8205, 75.7912),
    "Nahargarh Sunset & Stepwell": (26.9373, 75.8155), "Albert Hall Museum": (26.9117, 75.8195),
    "Rajasthani Cooking Class with a Family": (26.9080, 75.8000), "Johari & Bapu Bazaar Shopping Walk": (26.9180, 75.8200),
    "Mehrangarh Fort Guided Tour": (26.2980, 73.0187), "Mehrangarh Flying Fox Zipline": (26.2995, 73.0170),
    "Blue City Photo Walk": (26.2960, 73.0230), "Umaid Bhawan Palace Museum": (26.2810, 73.0470),
    "Bishnoi Village Safari": (26.1500, 73.0800), "Sardar Market Food Crawl": (26.2940, 73.0240),
    "City Palace Udaipur Tour": (24.5764, 73.6835), "Lake Pichola Sunset Boat Ride": (24.5720, 73.6790),
    "Bagore Ki Haveli Folk Dance Show": (24.5800, 73.6810), "Sajjangarh Monsoon Palace Sunset": (24.5930, 73.6420),
    "Mewari Cooking Class": (24.5790, 73.6800), "Miniature Painting Workshop": (24.5780, 73.6830),
    "Ayurvedic Spa Session": (24.5750, 73.6800),
    "Golden Fort & Havelis Walk": (26.9124, 70.9120), "Sam Dunes Camel Safari & Sunset": (26.8330, 70.5080),
    "Desert Camp Folk Night & Dinner": (26.8350, 70.5200), "Gadisar Lake Morning Walk": (26.9000, 70.9230),
    "Dune Bashing Jeep Safari": (26.8300, 70.5000), "Kuldhara Abandoned Village": (26.8000, 70.7900),
    "Pushkar Ghats & Brahma Temple": (26.4880, 74.5530), "Savitri Temple Ropeway Sunrise": (26.4720, 74.5450),
    "Pushkar Bazaar & Cafe Trail": (26.4895, 74.5530), "Hot Air Balloon Ride": (26.4950, 74.5700),
    "Tiger Safari: Morning Canter": (26.0170, 76.5020), "Tiger Safari: Private Gypsy": (26.0200, 76.4900),
    "Ranthambore Fort Hike": (26.0200, 76.4570), "Dastkar Craft Village Visit": (26.0100, 76.3700),
    "Taj Mahal Sunrise Guided Tour": (27.1751, 78.0421), "Agra Fort Guided Visit": (27.1795, 78.0211),
    "Mehtab Bagh Sunset View": (27.1800, 78.0430), "Mughlai Food Walk": (27.1870, 78.0140),
    "Old Delhi Rickshaw & Food Walk": (28.6560, 77.2300), "Humayun's Tomb & Lodhi Garden": (28.5933, 77.2507),
    "National Museum Highlights": (28.6118, 77.2190), "Dilli Haat Crafts Evening": (28.5730, 77.2080),
}

# dest -> [(title, tags, minutes, price/person, open, close, io, lat, lng, vendor, description)]
_NEW = {
    "jaipur": [
        ("Hawa Mahal Sunrise Photo Walk", ["photography", "heritage"], 90, 700, "06:00", "10:00", "outdoor", 26.9239, 75.8267, "Pink City Heritage Guides", "The Palace of Winds glows pink at dawn; learn to frame it before the traffic arrives."),
        ("Jaigarh Fort & Jaivana Cannon", ["heritage", "adventure"], 120, 600, "09:00", "17:00", "outdoor", 26.9851, 75.8456, "Pink City Heritage Guides", "Walk the ramparts above Amber and see one of the largest wheeled cannons ever built."),
        ("Panna Meena Stepwell Visit", ["heritage", "photography"], 45, 200, "07:00", "18:00", "outdoor", 26.9870, 75.8580, "Pink City Heritage Guides", "A geometric 16th-century stepwell a short walk from Amber Fort."),
        ("Galta Ji Monkey Temple Hike", ["spiritual", "nature", "adventure"], 120, 400, "06:00", "18:00", "outdoor", 26.9168, 75.8586, "Jaipur Food Walks", "A gorge of temples and sacred springs, busy with macaques."),
        ("Jal Mahal Evening Stroll", ["relaxation", "photography"], 60, 150, "16:00", "21:00", "outdoor", 26.9534, 75.8462, "Pink City Heritage Guides", "The water palace floating in Man Sagar lake, best at dusk."),
        ("Chokhi Dhani Village Dinner", ["food", "culture", "nightlife"], 180, 1400, "17:00", "23:00", "outdoor", 26.7680, 75.8339, "Kesar Home Kitchens", "Folk dance, puppet shows and an unlimited Rajasthani thali in a recreated village."),
        ("Gem-Cutting Studio in Johari", ["workshop", "shopping"], 90, 800, "10:00", "19:00", "indoor", 26.9215, 75.8270, "Sanganer Print Studio", "Watch emeralds and garnets being cut, then polish a stone yourself."),
        ("Patrika Gate Photo Stop", ["photography", "culture"], 45, 200, "08:00", "18:00", "outdoor", 26.8434, 75.8061, "Pink City Heritage Guides", "A painted gateway with every surface covered in Rajasthani motifs."),
        ("Birla Mandir Sunset", ["spiritual", "relaxation"], 60, 150, "16:00", "20:00", "mixed", 26.8921, 75.8155, "Pink City Heritage Guides", "White marble temple on a hill, calm at sunset."),
    ],
    "jodhpur": [
        ("Jaswant Thada Marble Cenotaph", ["heritage", "photography"], 60, 300, "09:00", "17:00", "outdoor", 26.3020, 73.0220, "Marwar Trails", "Translucent marble memorial with Mehrangarh towering behind."),
        ("Mandore Gardens & Cenotaphs", ["heritage", "nature"], 90, 300, "09:00", "18:00", "outdoor", 26.3500, 73.0500, "Marwar Trails", "The old Marwar capital: temple-like cenotaphs in shady gardens."),
        ("Toorji Ka Jhalra Stepwell", ["heritage", "photography"], 45, 150, "08:00", "20:00", "outdoor", 26.2940, 73.0200, "Marwar Trails", "A restored rose-sandstone stepwell ringed by cafes."),
        ("Rao Jodha Desert Rock Park Trail", ["nature", "adventure"], 120, 500, "07:00", "17:00", "outdoor", 26.3040, 73.0150, "Flying Fox Jodhpur", "Volcanic rock trails and native desert plants below the fort."),
        ("Kaylana Lake Sunset", ["relaxation", "photography"], 90, 300, "16:00", "20:00", "outdoor", 26.2870, 72.9670, "Desert Jeep Co.", "A quiet lake west of the city that turns orange at sunset."),
        ("Salawas Pottery & Weaving Village", ["workshop", "culture"], 150, 900, "10:00", "17:00", "mixed", 26.1300, 73.0700, "Desert Jeep Co.", "Throw a pot and watch durries being woven on village looms."),
        ("Mirchi Vada & Makhaniya Lassi Tasting", ["food"], 60, 300, "10:00", "21:00", "outdoor", 26.2945, 73.0245, "Marwar Trails", "Jodhpur's two famous snacks at the stalls that made them."),
        ("Machiya Safari Park", ["wildlife", "nature"], 90, 400, "08:00", "17:00", "outdoor", 26.3000, 72.9870, "Desert Jeep Co.", "Blackbuck, deer and desert birds on a short sanctuary drive."),
    ],
    "udaipur": [
        ("Jagdish Temple Morning Aarti", ["spiritual", "culture"], 45, 100, "05:00", "10:00", "mixed", 24.5795, 73.6838, "Mewar Explorers", "Carved 17th-century temple steps from City Palace, with morning prayers."),
        ("Saheliyon Ki Bari Gardens", ["nature", "relaxation"], 60, 200, "09:00", "18:00", "outdoor", 24.6010, 73.6860, "Mewar Explorers", "Fountains and lotus pools built for the royal ladies."),
        ("Fateh Sagar Lake Cycling", ["adventure", "nature"], 90, 600, "06:00", "11:00", "outdoor", 24.6020, 73.6720, "Pichola Boat Club", "An easy loop round Fateh Sagar with hills on every side."),
        ("Vintage Car Museum", ["heritage"], 60, 400, "09:00", "21:00", "indoor", 24.5850, 73.6930, "Mewar Explorers", "The Maharana's Rolls-Royces and Cadillacs, some still running."),
        ("Shilpgram Crafts Village", ["culture", "shopping", "workshop"], 120, 300, "11:00", "19:00", "outdoor", 24.6100, 73.6400, "Lakeside Kitchen Studio", "Huts from four states, live crafts and folk music."),
        ("Ambrai Ghat Photo Walk", ["photography", "relaxation"], 60, 500, "16:00", "20:00", "outdoor", 24.5760, 73.6770, "Mewar Explorers", "The classic view of City Palace across the water."),
        ("Badi Lake Sunrise Kayak", ["adventure", "nature"], 120, 1500, "06:00", "10:00", "outdoor", 24.6180, 73.6250, "Pichola Boat Club", "Paddle a calm hill lake before the day warms up."),
        ("Karni Mata Ropeway", ["relaxation", "photography"], 45, 250, "09:00", "21:00", "outdoor", 24.5720, 73.6890, "Pichola Boat Club", "A short cable-car ride to a hilltop temple and lake views."),
    ],
    "jaisalmer": [
        ("Patwon Ki Haveli Tour", ["heritage", "photography"], 60, 300, "09:00", "18:00", "mixed", 26.9170, 70.9150, "Thar Trails", "Five merchant mansions carved like sandstone lace."),
        ("Bada Bagh Cenotaphs Sunset", ["photography", "heritage"], 60, 300, "16:00", "19:30", "outdoor", 26.9530, 70.8960, "Thar Trails", "Royal chhatris silhouetted against wind turbines and dunes."),
        ("Khaba Fort Ruins", ["heritage", "adventure"], 90, 400, "08:00", "17:00", "outdoor", 26.8000, 70.7400, "Desert Jeep Co.", "A deserted Paliwal fort near Kuldhara with desert views."),
        ("Desert National Park Birding", ["wildlife", "nature"], 180, 1800, "06:00", "11:00", "outdoor", 26.7500, 70.5500, "Desert Jeep Co.", "Look for the rare great Indian bustard with a naturalist."),
        ("Jain Temples in the Fort", ["spiritual", "heritage"], 45, 200, "07:00", "12:00", "indoor", 26.9120, 70.9110, "Thar Trails", "Seven interlinked temples of carved yellow sandstone."),
        ("Stargazing in the Thar", ["nature", "relaxation"], 90, 900, "20:00", "23:30", "outdoor", 26.8360, 70.5150, "Dunes Camp Co.", "A telescope session under some of India's darkest skies."),
        ("Camel Cart Village Visit", ["culture", "adventure"], 120, 800, "09:00", "17:00", "outdoor", 26.8700, 70.8000, "Dunes Camp Co.", "Ride out to a desert hamlet for chai with a Bhil family."),
    ],
    "pushkar": [
        ("Pap Mochani Temple Sunset", ["spiritual", "photography"], 60, 150, "16:00", "19:30", "outdoor", 26.4970, 74.5500, "Pushkar Walks", "A short climb to a hilltop temple over the lake town."),
        ("Rose Farm & Gulkand Tasting", ["nature", "food"], 90, 500, "08:00", "12:00", "outdoor", 26.5100, 74.5600, "Pushkar Walks", "Pushkar's rose fields and the sweet rose jam made from them."),
        ("Varaha Ghat Evening Aarti", ["spiritual", "culture"], 45, 100, "18:00", "20:00", "outdoor", 26.4885, 74.5520, "Pushkar Walks", "Lamps, bells and chanting on the lakefront."),
        ("Desert Horse Ride", ["adventure", "nature"], 90, 1500, "07:00", "18:00", "outdoor", 26.5000, 74.5750, "Sky Waltz Balloons", "Marwari horses across the dunes outside town."),
        ("Pushkar Home Cooking Class", ["food", "workshop"], 150, 1200, "10:00", "19:00", "indoor", 26.4890, 74.5510, "Pushkar Walks", "Malpua and kachori in a family kitchen near the ghats."),
        ("Lakeside Sunrise Yoga", ["relaxation", "spiritual"], 60, 500, "06:00", "08:30", "outdoor", 26.4875, 74.5540, "Pushkar Walks", "Gentle yoga on a rooftop facing the ghats."),
        ("Ajmer Sharif Dargah Visit", ["spiritual", "culture"], 120, 400, "06:00", "21:00", "mixed", 26.4560, 74.6280, "Pushkar Walks", "The Sufi shrine over the hill in Ajmer, with qawwali in the evening."),
    ],
    "ranthambore": [
        ("Padam Talao Birdwatching", ["wildlife", "nature"], 90, 700, "06:00", "10:00", "outdoor", 26.0190, 76.4700, "Ranthambore Safari Desk", "Waterbirds and crocodiles at the park's biggest lake."),
        ("Surwal Lake Birding", ["wildlife", "nature"], 120, 600, "06:00", "10:00", "outdoor", 26.0500, 76.3800, "Ranthambore Safari Desk", "A seasonal lake busy with flamingos and cranes in winter."),
        ("Village Cycling Tour", ["adventure", "culture"], 120, 800, "07:00", "17:00", "outdoor", 26.0000, 76.3900, "Ranthambore Safari Desk", "Pedal through farm villages on the park edge."),
        ("Trinetra Ganesh Temple Climb", ["spiritual", "heritage"], 90, 200, "06:00", "18:00", "outdoor", 26.0240, 76.4580, "Ranthambore Safari Desk", "Pilgrims' path through the old fort to a three-eyed Ganesh."),
        ("Naturalist Nature Walk", ["nature", "wildlife"], 90, 900, "07:00", "17:00", "outdoor", 26.0120, 76.4300, "Ranthambore Safari Desk", "Tracks, trees and birds on foot with a forest guide."),
        ("Rajbagh Ruins Photo Drive", ["photography", "wildlife"], 60, 500, "15:00", "18:00", "outdoor", 26.0150, 76.4750, "Ranthambore Safari Desk", "Ruined pavilions where tigers are often seen."),
        ("Resort Folk Music Evening", ["culture", "nightlife"], 90, 500, "19:00", "22:30", "outdoor", 26.0060, 76.3950, "Ranthambore Safari Desk", "Bonfire, dholak and Rajasthani songs after the safari."),
        ("Tiger Watch Conservation Talk", ["wildlife", "culture"], 60, 300, "10:00", "17:00", "indoor", 26.0050, 76.3600, "Dastkar Crafts", "How local communities help protect Ranthambore's tigers."),
    ],
    "agra": [
        ("Baby Taj (Itimad-ud-Daulah)", ["heritage", "photography"], 60, 300, "07:00", "18:00", "outdoor", 27.1928, 78.0311, "Agra Heritage Walks", "The inlay-covered tomb that inspired the Taj."),
        ("Fatehpur Sikri Day Trip", ["heritage", "culture"], 240, 1800, "07:00", "17:00", "outdoor", 27.0945, 77.6679, "Agra Heritage Walks", "Akbar's abandoned red-sandstone capital."),
        ("Kinari Bazaar Walk", ["shopping", "food"], 90, 400, "11:00", "21:00", "outdoor", 27.1850, 78.0160, "Agra Heritage Walks", "Wedding-market lanes and the best petha in town."),
        ("Marble Inlay Workshop", ["workshop", "culture"], 90, 900, "10:00", "18:00", "indoor", 27.1700, 78.0500, "Taj Crafts Guild", "Descendants of the Taj craftsmen show the pietra dura technique."),
        ("Akbar's Tomb at Sikandra", ["heritage"], 60, 300, "07:00", "18:00", "outdoor", 27.2206, 77.9505, "Agra Heritage Walks", "A huge tomb garden where deer and langurs roam."),
        ("Taj Nature Walk", ["nature", "photography"], 60, 200, "07:00", "17:00", "outdoor", 27.1720, 78.0520, "Agra Heritage Walks", "Forest trails with framed views of the Taj."),
        ("Mohabbat the Taj Show", ["culture", "nightlife"], 90, 1500, "18:00", "21:00", "indoor", 27.1650, 78.0450, "Taj Crafts Guild", "A stage musical telling the story of Shah Jahan and Mumtaz."),
    ],
    "delhi": [
        ("Qutub Minar Complex", ["heritage", "photography"], 90, 400, "07:00", "18:00", "outdoor", 28.5245, 77.1855, "Dilli Trails", "The 73 m victory tower and India's first mosque ruins."),
        ("Red Fort Guided Visit", ["heritage", "culture"], 120, 700, "09:30", "16:30", "mixed", 28.6562, 77.2410, "Dilli Trails", "The Mughal palace-fortress on the Yamuna."),
        ("India Gate Evening Walk", ["relaxation", "culture"], 60, 150, "17:00", "21:00", "outdoor", 28.6129, 77.2295, "Dilli Trails", "Lawns, ice cream and the lit-up war memorial."),
        ("Lodhi Art District Walk", ["culture", "photography"], 90, 600, "09:00", "18:00", "outdoor", 28.5910, 77.2270, "Dilli Trails", "Street murals by Indian and international artists."),
        ("Hauz Khas Village Evening", ["nightlife", "food"], 120, 800, "17:00", "23:00", "outdoor", 28.5535, 77.1940, "Dilli Trails", "Medieval ruins by a lake, now cafes and rooftop bars."),
        ("Akshardham Temple & Water Show", ["spiritual", "culture"], 180, 500, "10:00", "20:00", "mixed", 28.6127, 77.2773, "Dilli Trails", "A vast carved temple and a sunset fountain show."),
        ("Bangla Sahib Langar Seva", ["spiritual", "food", "culture"], 60, 0, "06:00", "22:00", "indoor", 28.6264, 77.2090, "Dilli Trails", "Help cook and serve the free community kitchen."),
        ("Khari Baoli Spice Market", ["food", "shopping"], 90, 500, "10:00", "19:00", "outdoor", 28.6560, 77.2230, "Dilli Trails", "Asia's largest spice market, sacks piled to the rooftops."),
    ],
    "bikaner": [
        ("Junagarh Fort Tour", ["heritage", "photography"], 120, 700, "10:00", "17:00", "mixed", 28.0220, 73.3190, "Bikaner Heritage Walks", "A never-conquered fort with gold-leaf halls."),
        ("Karni Mata Temple, Deshnoke", ["spiritual", "culture"], 120, 500, "06:00", "20:00", "mixed", 27.7900, 73.3400, "Bikaner Heritage Walks", "The famous temple where rats are revered."),
        ("Camel Research Farm", ["wildlife", "culture"], 90, 300, "14:00", "18:00", "outdoor", 28.0000, 73.3500, "Thar Camel Co.", "Baby camels, camel-milk ice cream and breeding research."),
        ("Bhujia & Sweets Trail", ["food"], 90, 500, "10:00", "21:00", "outdoor", 28.0170, 73.3100, "Bikaner Heritage Walks", "Taste Bikaner's famous namkeen fresh from the fryer."),
        ("Lalgarh Palace Museum", ["heritage"], 60, 300, "10:00", "17:00", "indoor", 28.0400, 73.3300, "Bikaner Heritage Walks", "Red-sandstone palace of the Bikaner royals."),
        ("Rampuria Havelis Walk", ["heritage", "photography"], 60, 300, "09:00", "18:00", "outdoor", 28.0150, 73.3130, "Bikaner Heritage Walks", "Merchant mansions with European and Rajput detailing."),
        ("Desert Camel Safari & Dinner", ["adventure", "food"], 180, 1800, "15:00", "22:00", "outdoor", 27.9700, 73.2800, "Thar Camel Co.", "Ride into the dunes for sunset and dinner by the fire."),
        ("Gajner Palace Lake", ["relaxation", "nature"], 120, 600, "08:00", "18:00", "outdoor", 27.9500, 73.0600, "Thar Camel Co.", "A lakeside hunting lodge with migratory birds."),
        ("Devi Kund Sagar Cenotaphs", ["heritage", "photography"], 60, 200, "08:00", "18:00", "outdoor", 27.9900, 73.2500, "Bikaner Heritage Walks", "Royal memorials beside a sacred tank."),
        ("Usta Art Studio", ["workshop", "culture"], 90, 800, "10:00", "18:00", "indoor", 28.0180, 73.3150, "Bikaner Heritage Walks", "Gold-embossed camel-hide painting, taught by an Usta family."),
    ],
    "chittorgarh": [
        ("Chittorgarh Fort Walk", ["heritage", "photography"], 180, 900, "09:00", "18:00", "outdoor", 24.8870, 74.6450, "Mewar Fort Guides", "Seven gates, palaces and temples along a 13 km plateau."),
        ("Vijay Stambh Climb", ["heritage"], 45, 200, "09:00", "17:00", "outdoor", 24.8860, 74.6460, "Mewar Fort Guides", "A nine-storey victory tower covered in sculpture."),
        ("Padmini Palace", ["heritage", "culture"], 60, 200, "09:00", "18:00", "outdoor", 24.8790, 74.6470, "Mewar Fort Guides", "The water palace tied to the legend of Rani Padmini."),
        ("Fort Light & Sound Show", ["culture", "nightlife"], 60, 400, "19:00", "21:00", "outdoor", 24.8880, 74.6440, "Mewar Fort Guides", "The fort's history told after dark."),
        ("Kalika Mata Temple", ["spiritual", "heritage"], 45, 100, "06:00", "19:00", "mixed", 24.8820, 74.6460, "Mewar Fort Guides", "An 8th-century sun temple later rededicated to Kali."),
        ("Bassi Wildlife Sanctuary Drive", ["wildlife", "nature"], 150, 1500, "06:00", "17:00", "outdoor", 24.9300, 74.4200, "Mewar Fort Guides", "Antelope, wild boar and birds in the Vindhya hills."),
        ("Sanwariya Seth Temple", ["spiritual"], 90, 200, "06:00", "21:00", "mixed", 24.8000, 74.5800, "Mewar Fort Guides", "A busy pilgrimage temple of Krishna."),
        ("Gaumukh Reservoir", ["nature", "relaxation"], 45, 100, "08:00", "18:00", "outdoor", 24.8850, 74.6470, "Mewar Fort Guides", "A cliff-side spring feeding a deep blue tank."),
        ("Fort Cycling Ride", ["adventure", "photography"], 120, 900, "06:30", "10:30", "outdoor", 24.8900, 74.6400, "Mewar Fort Guides", "Ride the fort's long loop road in the cool morning."),
        ("Mewari Village Lunch", ["food", "culture"], 120, 700, "12:00", "15:00", "outdoor", 24.8700, 74.6200, "Mewar Fort Guides", "Home-cooked lunch in a farming village below the fort."),
    ],
    "mount_abu": [
        ("Dilwara Jain Temples", ["spiritual", "heritage"], 90, 300, "12:00", "18:00", "indoor", 24.6100, 72.7230, "Abu Hills Guides", "Marble carved so finely it looks like lace."),
        ("Nakki Lake Boating", ["relaxation", "nature"], 60, 300, "08:00", "20:00", "outdoor", 24.5930, 72.7070, "Abu Hills Guides", "Pedal boats on a lake ringed by hills."),
        ("Sunset Point", ["photography", "relaxation"], 60, 100, "16:00", "19:30", "outdoor", 24.5860, 72.7010, "Abu Hills Guides", "The classic sunset over the plains below."),
        ("Guru Shikhar Summit", ["nature", "spiritual", "adventure"], 120, 400, "07:00", "18:00", "outdoor", 24.6490, 72.7790, "Abu Hills Guides", "Rajasthan's highest point, with a temple on top."),
        ("Achalgarh Fort Hike", ["heritage", "adventure"], 90, 300, "08:00", "17:00", "outdoor", 24.6390, 72.7700, "Abu Hills Guides", "Ruined fort and old temples on a forested ridge."),
        ("Toad Rock Hike", ["adventure", "nature"], 60, 200, "07:00", "18:00", "outdoor", 24.5950, 72.7050, "Abu Hills Guides", "A short scramble to a rock shaped like a toad."),
        ("Trevor's Tank Birding", ["wildlife", "nature"], 90, 400, "07:00", "17:00", "outdoor", 24.6190, 72.7360, "Abu Hills Guides", "A forest reservoir for birds and crocodiles."),
        ("Peace Park Meditation", ["spiritual", "relaxation"], 60, 0, "08:00", "18:00", "outdoor", 24.6250, 72.7450, "Abu Hills Guides", "Guided meditation in gardens between two peaks."),
        ("Rock Climbing Session", ["adventure"], 150, 1500, "07:00", "16:00", "outdoor", 24.5900, 72.7100, "Abu Hills Guides", "Beginner climbing and rappelling with certified instructors."),
        ("Wildlife Sanctuary Trek", ["wildlife", "nature", "adventure"], 180, 900, "06:30", "15:00", "outdoor", 24.6000, 72.7300, "Abu Hills Guides", "Forest trails where sloth bears are sometimes seen."),
    ],
    "bundi": [
        ("Taragarh Fort Hike", ["heritage", "adventure"], 120, 400, "08:00", "17:00", "outdoor", 25.4400, 75.6400, "Bundi Walks", "A steep climb to an overgrown star fort above the town."),
        ("Chitrashala Murals", ["heritage", "culture", "photography"], 60, 300, "09:00", "17:00", "indoor", 25.4380, 75.6440, "Bundi Walks", "Room after room of blue-and-green palace murals."),
        ("Raniji Ki Baori Stepwell", ["heritage", "photography"], 45, 150, "09:00", "17:00", "outdoor", 25.4410, 75.6460, "Bundi Walks", "A 46 m deep stepwell with carved elephant arches."),
        ("Sukh Mahal & Lake", ["relaxation", "heritage"], 60, 200, "09:00", "17:00", "outdoor", 25.4470, 75.6300, "Bundi Walks", "The summer palace where Kipling stayed."),
        ("84 Pillared Cenotaph", ["heritage"], 45, 150, "09:00", "18:00", "outdoor", 25.4280, 75.6570, "Bundi Walks", "A memorial pavilion held up by 84 carved columns."),
        ("Old Town Photo Walk", ["photography", "culture"], 90, 500, "07:00", "11:00", "outdoor", 25.4390, 75.6470, "Bundi Walks", "Blue houses, stepwells and bazaars in soft morning light."),
        ("Jait Sagar Canoe", ["adventure", "nature"], 90, 800, "07:00", "12:00", "outdoor", 25.4540, 75.6250, "Bundi Walks", "Paddle through lotus beds below the hills."),
        ("Mural Painting Class", ["workshop", "culture"], 120, 1000, "10:00", "17:00", "indoor", 25.4370, 75.6450, "Bundi Walks", "Learn the Bundi school of painting from a local artist."),
        ("Kshar Bagh Royal Cenotaphs", ["heritage", "photography"], 45, 150, "09:00", "17:00", "outdoor", 25.4270, 75.6380, "Bundi Walks", "Sixty-six royal memorials in a quiet garden."),
        ("Bundi Family Cooking", ["food", "workshop"], 150, 1000, "11:00", "19:00", "indoor", 25.4360, 75.6480, "Bundi Walks", "Hadoti dishes cooked with a family in the old town."),
    ],
}


def _rating(i):
    return round(4.1 + ((i * 37) % 9) / 10, 1)


EXTRA_ACTIVITIES = []
for dest, rows in _NEW.items():
    for n, (title, tags, dur, price, op, cl, io, lat, lng, vendor, desc) in enumerate(rows):
        i = len(EXTRA_ACTIVITIES)
        EXTRA_ACTIVITIES.append((dest, title, tags, dur, price, op, cl, io, _rating(i), 60 + (i * 53) % 700,
                                 "adventure" not in tags or dur < 150, io != "outdoor" or "walk" not in title.lower(), [], vendor, desc))
        ACT_COORDS[title] = (lat, lng)

EXTRA_HOTELS = {
    "bikaner": [("budget", "Camel Trail Inn", 1500, 3.9), ("standard", "Bhujia Haveli", 3800, 4.2),
                ("premium", "Laxmi Niwas Suites", 9000, 4.6), ("luxury", "Gajner Lake Palace", 20000, 4.8)],
    "chittorgarh": [("budget", "Fortview Lodge", 1400, 3.9), ("standard", "Padmini Residency", 3500, 4.2),
                    ("premium", "Mewar Fort Retreat", 8000, 4.5), ("luxury", "Bassi Castle", 16000, 4.7)],
    "mount_abu": [("budget", "Nakki Hill Stay", 1800, 4.0), ("standard", "Abu Pines Hotel", 4500, 4.3),
                  ("premium", "Aravalli Heights Resort", 10000, 4.6), ("luxury", "Palanpur Palace Abu", 21000, 4.8)],
    "bundi": [("budget", "Blue Lane Guesthouse", 1200, 4.1), ("standard", "Haveli Taragarh", 3200, 4.3),
              ("premium", "Garh Bundi Retreat", 7500, 4.5), ("luxury", "Jait Sagar Palace", 15000, 4.7)],
}

EXTRA_CUSTOMERS = [
    ("Lena Fischer", "lena.f@example.com", "+49 151 2345 6789", "Munich", "solo", ["nature", "adventure", "photography"]),
    ("The Rao Family", "rao.family@example.com", "+91 98480 44556", "Chennai", "family", ["wildlife", "relaxation", "food"]),
    ("Kenji & Aiko Tanaka", "tanaka@example.com", "+81 90 1234 5678", "Osaka", "couple", ["heritage", "spiritual", "culture"]),
    ("Brightpath School Trip", "trips@brightpath.example.com", "+91 22 4000 5678", "Mumbai", "group", ["heritage", "culture", "adventure"]),
    ("Maria Gonzalez", "maria.g@example.com", "+34 612 345 678", "Madrid", "solo", ["food", "workshop", "shopping"]),
    ("Sam & Jordan Lee", "lee.pair@example.com", "+1 415 555 0142", "San Francisco", "couple", ["adventure", "nightlife", "photography"]),
    ("Gupta Silver Anniversary", "gupta25@example.com", "+91 98100 77889", "Lucknow", "couple", ["relaxation", "heritage", "spiritual"]),
    ("Tech4Good Retreat", "ops@tech4good.example.com", "+91 80 4555 1200", "Bengaluru", "corporate", ["nature", "adventure", "relaxation"]),
]

# (customer idx into the combined list, title, start offset from today, days, prefs, lifecycle)
_B = lambda **k: {"start_city": "delhi", "adults": 2, "children": 0, "hotel_tier": "standard", "transport": "best", "pace": "balanced", **k}  # noqa: E731
EXTRA_TOURS = [
    (7, "Hills & Lakes of Southern Rajasthan", -3, 7, _B(destinations=["udaipur", "mount_abu"], start_city="udaipur", adults=1, budget=90000, interests=["nature", "adventure", "photography"]), "operate"),
    (8, "Safari & Sands Family Holiday", 10, 8, _B(destinations=["ranthambore", "jaipur", "bikaner"], adults=2, children=2, budget=210000, hotel_tier="premium", interests=["wildlife", "relaxation", "food"], pace="relaxed"), "prepare"),
    (9, "Forts of Mewar", 20, 6, _B(destinations=["chittorgarh", "udaipur"], start_city="udaipur", budget=140000, hotel_tier="premium", interests=["heritage", "spiritual", "culture"]), "prepare_paid"),
    (10, "Grade 10 Heritage Trail", 40, 5, _B(destinations=["agra", "jaipur"], adults=24, budget=420000, hotel_tier="budget", transport="train", interests=["heritage", "culture", "adventure"], pace="packed"), "draft"),
    (11, "Spice & Craft Journey", -1, 9, _B(destinations=["delhi", "jaipur", "pushkar", "jodhpur"], adults=1, budget=150000, transport="train", interests=["food", "workshop", "shopping"]), "operate"),
    (12, "Wild Nights Rajasthan", -18, 7, _B(destinations=["jaipur", "jaisalmer", "bikaner"], start_city="jaipur", budget=110000, hotel_tier="budget", transport="car", interests=["adventure", "nightlife", "photography"], pace="packed"), "complete"),
    (13, "Silver Anniversary Escape", -40, 5, _B(destinations=["udaipur", "bundi"], start_city="udaipur", budget=260000, hotel_tier="luxury", transport="car", interests=["relaxation", "heritage", "spiritual"], pace="relaxed"), "reviewed"),
    (14, "Aravalli Offsite", 55, 4, _B(destinations=["mount_abu"], start_city="udaipur", adults=18, budget=380000, transport="car", interests=["nature", "adventure", "relaxation"]), "draft"),
]

EXTRA_COORDINATORS = [
    ("Farah Sheikh", "+91 94140 10005", "udaipur", ["Hindi", "English", "Spanish"]),
    ("Devendra Charan", "+91 94140 10006", "bikaner", ["Hindi", "English", "Marwari"]),
]
