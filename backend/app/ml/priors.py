"""Expert assumptions, the domain knowledge the synthetic training data is generated from.

Every number here is a documented, human-set prior (travel-planning heuristics for Indian heritage tourism).
The models do not read these tables at inference time: they learn the behaviour from the generated data,
and are then refined by real traveler feedback (see train.py). Changing a prior and retraining changes the model.
"""

# ---------------------------------------------------------------- life stages
# band: (label, min_age, max_age)
BANDS = [
    ("young_child", "Young child", 0, 7),
    ("child", "Child", 8, 12),
    ("teen", "Teen", 13, 17),
    ("young_adult", "Young adult", 18, 30),
    ("adult", "Adult", 31, 59),
    ("senior", "Senior", 60, 74),
    ("elder", "Elder", 75, 120),
]


def band_of(age: int) -> str:
    for key, _, lo, hi in BANDS:
        if lo <= age <= hi:
            return key
    return "adult"


BAND_LABEL = {k: label for k, label, _, _ in BANDS}

# band: energy (max comfortable intensity 1-5), stairs tolerance 0-1, heat tolerance 0-1, crowd tolerance 0-1,
#       comfortable walk km, comfortable duration min, latest comfortable end hour
PROFILE = {
    "young_child": dict(energy=2.5, stairs=0.45, heat=0.35, crowd=0.30, walk=1.5, duration=90, late=19.5),
    "child":       dict(energy=3.5, stairs=0.80, heat=0.55, crowd=0.50, walk=3.0, duration=120, late=20.5),
    "teen":        dict(energy=4.5, stairs=1.00, heat=0.75, crowd=0.70, walk=5.0, duration=150, late=22.5),
    "young_adult": dict(energy=5.0, stairs=1.00, heat=0.80, crowd=0.70, walk=6.0, duration=210, late=23.5),
    "adult":       dict(energy=4.0, stairs=0.80, heat=0.60, crowd=0.50, walk=4.0, duration=180, late=22.0),
    "senior":      dict(energy=2.5, stairs=0.35, heat=0.35, crowd=0.35, walk=2.0, duration=130, late=20.5),
    "elder":       dict(energy=1.8, stairs=0.15, heat=0.25, crowd=0.30, walk=1.2, duration=90, late=19.5),
}

CATS = ["heritage", "museum", "religious", "nature", "wildlife", "adventure", "food", "shopping", "performance",
        "workshop", "relaxation", "viewpoint"]

# how much each life stage tends to enjoy each kind of place (-1 .. +1)
AFFINITY = {
    #               herit museum relig nature wild  advent food  shop  perf  work  relax view
    "young_child": [-0.3, -0.2, -0.4, 0.30, 0.95, 0.20, 0.00, -0.4, 0.60, 0.50, -0.5, -0.1],
    "child":       [0.00, 0.10, -0.3, 0.40, 0.90, 0.60, 0.10, -0.2, 0.60, 0.60, -0.4, 0.10],
    "teen":        [-0.1, -0.2, -0.3, 0.20, 0.50, 0.90, 0.40, 0.40, 0.30, 0.20, -0.3, 0.40],
    "young_adult": [0.20, 0.00, -0.1, 0.40, 0.50, 0.90, 0.70, 0.30, 0.50, 0.30, 0.10, 0.60],
    "adult":       [0.60, 0.40, 0.20, 0.40, 0.50, 0.20, 0.60, 0.30, 0.40, 0.40, 0.50, 0.50],
    "senior":      [0.70, 0.50, 0.60, 0.40, 0.30, -0.6, 0.40, 0.20, 0.50, 0.20, 0.70, 0.40],
    "elder":       [0.60, 0.40, 0.70, 0.30, 0.20, -0.9, 0.30, 0.00, 0.40, 0.10, 0.70, 0.30],
}

# interests a traveler can pick -> the kinds of place they point at
INTEREST_CATS = {
    "heritage": ["heritage", "museum"], "culture": ["performance", "religious", "museum", "heritage"], "food": ["food"],
    "adventure": ["adventure"], "wildlife": ["wildlife"], "nature": ["nature", "wildlife", "viewpoint"],
    "shopping": ["shopping"], "spiritual": ["religious"], "relaxation": ["relaxation", "nature"],
    "photography": ["viewpoint", "heritage", "nature"], "nightlife": ["performance", "food"], "workshop": ["workshop"],
}

# ---------------------------------------------------------------- places
# Kaggle "Type" -> category and physical profile:
# (category, intensity 1-5, stairs 0-1, walk km, seating 0-1, shade 0-1, indoor 0/0.5/1, min_age, kid_friendly)
TYPE_PRIORS = {
    "Fort": ("heritage", 3, 0.8, 2.5, 0.2, 0.3, 0.5, 0, True),
    "Palace": ("heritage", 2, 0.5, 1.5, 0.4, 0.6, 0.5, 0, True),
    "Tomb": ("heritage", 2, 0.2, 1.5, 0.3, 0.4, 0.0, 0, True), "Tombs": ("heritage", 2, 0.2, 1.5, 0.3, 0.4, 0.0, 0, True),
    "Mausoleum": ("heritage", 2, 0.3, 1.5, 0.3, 0.3, 0.0, 0, True),
    "Monument": ("heritage", 2, 0.4, 1.2, 0.3, 0.3, 0.0, 0, True), "Historical": ("heritage", 2, 0.4, 1.5, 0.3, 0.3, 0.0, 0, True),
    "Site": ("heritage", 3, 0.5, 2.5, 0.2, 0.2, 0.0, 0, True), "Prehistoric Site": ("heritage", 3, 0.5, 2.5, 0.2, 0.2, 0.0, 0, True),
    "Stepwell": ("heritage", 2, 0.9, 0.5, 0.1, 0.5, 0.0, 0, True), "Observatory": ("heritage", 1, 0.2, 1.0, 0.3, 0.3, 0.0, 0, True),
    "War Memorial": ("heritage", 1, 0.0, 0.8, 0.3, 0.1, 0.0, 0, True), "Memorial": ("heritage", 1, 0.1, 0.8, 0.4, 0.3, 0.0, 0, True),
    "Landmark": ("heritage", 1, 0.2, 1.0, 0.3, 0.2, 0.0, 0, True), "Government Building": ("heritage", 1, 0.1, 1.0, 0.3, 0.3, 0.5, 0, True),
    "Cave": ("heritage", 3, 0.7, 1.5, 0.1, 0.9, 0.5, 0, True), "Bridge": ("viewpoint", 1, 0.1, 1.0, 0.1, 0.0, 0.0, 0, True),
    "Suspension Bridge": ("viewpoint", 2, 0.2, 1.0, 0.1, 0.0, 0.0, 0, True), "Engineering Marvel": ("viewpoint", 1, 0.1, 1.0, 0.1, 0.0, 0.0, 0, True),
    "Museum": ("museum", 1, 0.2, 1.2, 0.6, 1.0, 1.0, 0, True), "Science": ("museum", 1, 0.1, 1.0, 0.6, 1.0, 1.0, 0, True),
    "Film Studio": ("performance", 2, 0.1, 2.0, 0.5, 0.6, 0.5, 0, True), "Cultural": ("performance", 1, 0.1, 0.5, 0.8, 0.8, 1.0, 0, True),
    "Temple": ("religious", 2, 0.5, 0.8, 0.3, 0.5, 0.5, 0, True), "Temples": ("religious", 2, 0.5, 0.8, 0.3, 0.5, 0.5, 0, True),
    "Religious Site": ("religious", 2, 0.4, 1.0, 0.3, 0.5, 0.5, 0, True), "Religious Shrine": ("religious", 3, 0.8, 1.5, 0.2, 0.4, 0.0, 0, True),
    "Shrine": ("religious", 3, 0.8, 1.5, 0.2, 0.4, 0.0, 0, True), "Gurudwara": ("religious", 1, 0.2, 0.5, 0.6, 0.8, 0.5, 0, True),
    "Church": ("religious", 1, 0.1, 0.3, 0.8, 1.0, 1.0, 0, True), "Monastery": ("religious", 2, 0.6, 1.0, 0.4, 0.6, 0.5, 0, True),
    "Lake": ("nature", 1, 0.1, 1.0, 0.5, 0.3, 0.0, 0, True), "Park": ("nature", 1, 0.0, 1.5, 0.6, 0.6, 0.0, 0, True),
    "Botanical Garden": ("nature", 1, 0.0, 1.5, 0.6, 0.7, 0.0, 0, True), "Sculpture Garden": ("nature", 1, 0.0, 1.2, 0.5, 0.5, 0.0, 0, True),
    "Beach": ("nature", 1, 0.0, 1.5, 0.3, 0.1, 0.0, 0, True), "Promenade": ("nature", 1, 0.0, 1.5, 0.5, 0.2, 0.0, 0, True),
    "Valley": ("nature", 3, 0.3, 3.0, 0.2, 0.3, 0.0, 0, True), "Waterfall": ("nature", 3, 0.6, 2.0, 0.2, 0.5, 0.0, 0, True),
    "Hill": ("viewpoint", 3, 0.6, 2.5, 0.2, 0.3, 0.0, 0, True), "Natural Feature": ("nature", 2, 0.3, 2.0, 0.2, 0.3, 0.0, 0, True),
    "Viewpoint": ("viewpoint", 2, 0.4, 1.0, 0.3, 0.2, 0.0, 0, True), "Scenic Point": ("viewpoint", 2, 0.3, 1.0, 0.3, 0.2, 0.0, 0, True),
    "Scenic Area": ("viewpoint", 2, 0.3, 2.0, 0.3, 0.3, 0.0, 0, True), "Mountain Peak": ("adventure", 5, 0.9, 6.0, 0.0, 0.1, 0.0, 12, False),
    "Tea Plantation": ("nature", 2, 0.4, 2.0, 0.3, 0.4, 0.0, 0, True), "Vineyard": ("food", 1, 0.1, 1.0, 0.7, 0.6, 0.5, 18, False),
    "National Park": ("wildlife", 2, 0.1, 0.5, 0.8, 0.2, 0.0, 0, True), "Wildlife Sanctuary": ("wildlife", 2, 0.1, 0.8, 0.7, 0.3, 0.0, 0, True),
    "Bird Sanctuary": ("wildlife", 2, 0.1, 2.0, 0.4, 0.4, 0.0, 0, True), "Zoo": ("wildlife", 2, 0.0, 2.5, 0.5, 0.5, 0.0, 0, True),
    "Amusement Park": ("adventure", 3, 0.2, 3.0, 0.4, 0.3, 0.0, 4, True), "Theme Park": ("adventure", 2, 0.1, 2.0, 0.5, 0.4, 0.0, 0, True),
    "Adventure Sport": ("adventure", 5, 0.5, 1.5, 0.1, 0.1, 0.0, 12, False), "Trekking": ("adventure", 5, 0.8, 8.0, 0.0, 0.3, 0.0, 12, False),
    "Ski Resort": ("adventure", 4, 0.3, 2.0, 0.3, 0.0, 0.0, 6, True), "Cricket Ground": ("performance", 1, 0.5, 0.8, 0.9, 0.3, 0.0, 0, True),
    "Market": ("shopping", 2, 0.0, 2.0, 0.2, 0.4, 0.0, 0, True), "Mall": ("shopping", 1, 0.0, 1.5, 0.6, 1.0, 1.0, 0, True),
    "Urban Development Project": ("viewpoint", 1, 0.1, 1.5, 0.4, 0.3, 0.0, 0, True), "Border Crossing": ("performance", 2, 0.3, 1.0, 0.6, 0.1, 0.0, 0, True),
}
DEFAULT_TYPE = ("heritage", 2, 0.3, 1.5, 0.3, 0.3, 0.0, 0, True)

# category -> interest tags shown to travelers
CAT_TAGS = {
    "heritage": ["heritage", "culture", "photography"], "museum": ["heritage", "culture"], "religious": ["spiritual", "culture"],
    "nature": ["nature", "relaxation"], "wildlife": ["wildlife", "nature"], "adventure": ["adventure"], "food": ["food", "culture"],
    "shopping": ["shopping"], "performance": ["culture", "nightlife"], "workshop": ["workshop", "culture"],
    "relaxation": ["relaxation"], "viewpoint": ["photography", "nature"],
}

# typical opening hours by category (for Kaggle places imported into the catalogue)
CAT_HOURS = {
    "heritage": ("09:00", "17:30"), "museum": ("10:00", "17:00"), "religious": ("06:00", "20:00"), "nature": ("06:00", "19:00"),
    "wildlife": ("08:00", "17:00"), "adventure": ("09:00", "17:00"), "food": ("11:00", "22:00"), "shopping": ("10:30", "21:00"),
    "performance": ("10:00", "20:00"), "workshop": ("10:00", "18:00"), "relaxation": ("09:00", "19:00"), "viewpoint": ("06:00", "20:00"),
}

# ---------------------------------------------------------------- crowds
# relative busyness by hour (6..22) for each category; peaks follow typical Indian visiting patterns
def crowd_curve(cat: str, hour: float) -> float:
    import math

    def bump(center, width, height=1.0):
        return height * math.exp(-((hour - center) ** 2) / (2 * width ** 2))
    if cat in ("heritage", "viewpoint"):
        return 0.15 + bump(11.5, 1.8) + (0.6 * bump(17.5, 1.0) if cat == "viewpoint" else 0.3 * bump(16, 1.5))
    if cat == "museum":
        return 0.1 + bump(13, 2.0)
    if cat == "religious":
        return 0.15 + 0.9 * bump(7.5, 1.3) + bump(19, 1.3)
    if cat in ("food", "shopping", "performance"):
        return 0.1 + 0.4 * bump(13, 1.5) + bump(19.5, 1.6)
    if cat == "wildlife":
        return 0.1 + bump(7.5, 1.2) + 0.8 * bump(16, 1.2)
    if cat in ("nature", "relaxation"):
        return 0.15 + 0.6 * bump(8, 1.5) + bump(17.5, 1.5)
    return 0.2 + bump(12, 2.5)


BEST_TIME_SHIFT = {"morning": -2.0, "afternoon": 1.0, "evening": 4.0, "night": 6.0, "all": 0.0}
# month -> tourist-season multiplier for Rajasthan / north India
SEASON = {1: 1.25, 2: 1.15, 3: 1.0, 4: 0.75, 5: 0.6, 6: 0.55, 7: 0.6, 8: 0.65, 9: 0.8, 10: 1.1, 11: 1.25, 12: 1.35}
# month -> how hot middays get (0-1)
MONTH_HEAT = {1: 0.1, 2: 0.2, 3: 0.5, 4: 0.85, 5: 1.0, 6: 0.95, 7: 0.7, 8: 0.65, 9: 0.65, 10: 0.5, 11: 0.25, 12: 0.1}

# ---------------------------------------------------------------- moods
MOODS = ["tired", "energetic", "relaxed", "adventurous", "cultural", "foodie", "romantic", "restless_kids", "hot"]
MOOD_LABEL = {"tired": "Tired", "energetic": "Energetic", "relaxed": "Relaxed", "adventurous": "Adventurous",
              "cultural": "Cultural", "foodie": "Hungry / foodie", "romantic": "Romantic", "restless_kids": "Kids restless",
              "hot": "Feeling the heat"}
# mood -> category bonuses and physical sensitivities it adds
MOOD_EFFECT = {
    "tired": dict(cats={"relaxation": 0.6, "museum": 0.2, "heritage": -0.15, "adventure": -0.7}, energy=-1.8, duration=-40, walk=-1.5),
    "energetic": dict(cats={"adventure": 0.5, "nature": 0.2, "relaxation": -0.3}, energy=0.8),
    "relaxed": dict(cats={"relaxation": 0.6, "nature": 0.3, "adventure": -0.3}, crowd=-0.25),
    "adventurous": dict(cats={"adventure": 0.8, "wildlife": 0.3, "museum": -0.3}),
    "cultural": dict(cats={"heritage": 0.5, "museum": 0.5, "performance": 0.4, "religious": 0.3}),
    "foodie": dict(cats={"food": 0.9, "shopping": 0.1}),
    "romantic": dict(cats={"viewpoint": 0.5, "relaxation": 0.4, "performance": 0.3, "food": 0.3}, adults_only=True),
    "restless_kids": dict(cats={"wildlife": 0.4, "adventure": 0.3, "workshop": 0.4, "performance": 0.3, "museum": -0.4, "heritage": -0.4},
                          kids_only=True, duration=-40),
    "hot": dict(heat=-0.3, cats={"museum": 0.3, "relaxation": 0.2}),
}
