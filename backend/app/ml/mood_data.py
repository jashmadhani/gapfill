"""Training text for the mood model: expert-written phrases per mood, combined into multi-mood sentences,
plus a separate hand-written test set of natural sentences the generator never produced."""
import random

PHRASES = {
    "tired": ["we're exhausted", "so tired", "wiped out after yesterday", "feet are killing me", "low energy today", "need a slow day",
              "jet lagged", "didn't sleep well", "drained", "sleepy", "running on empty", "legs are sore", "can't walk much today",
              "worn out", "knackered", "need to rest", "everyone is tired", "too much walking yesterday", "we are beat", "barely slept",
              "knees hurt", "slept badly", "back is aching", "grandpa is tired", "no energy left"],
    "energetic": ["full of energy", "we're pumped", "ready to go", "feeling great", "fresh and energetic", "up for anything",
                  "let's do a lot today", "slept really well", "raring to go", "high energy"],
    "relaxed": ["want something chill", "take it easy", "slow and relaxed", "just want to unwind", "nothing hectic", "calm day please",
                "lazy day", "no rushing", "peaceful", "somewhere quiet", "avoid crowds", "laid back"],
    "adventurous": ["want some thrill", "something adventurous", "adrenaline", "let's do something wild", "outdoorsy", "want action",
                    "zipline or safari", "something exciting", "daring", "bored of monuments"],
    "cultural": ["more history please", "want to learn about the culture", "museums", "heritage stuff", "local traditions",
                 "art and architecture", "temples and forts", "cultural experience", "folk music", "stories of the kings"],
    "foodie": ["we're hungry", "starving", "want to try local food", "food tour", "street food", "craving something tasty",
               "where to eat", "thali", "foodie mood", "snacks"],
    "romantic": ["romantic evening", "date night", "anniversary", "something romantic for us two", "sunset for two", "honeymoon vibes",
                 "candle light dinner", "special evening together"],
    "restless_kids": ["kids are restless", "the children are bored", "kids are cranky", "little one is fussy", "kids need to run around",
                      "children won't sit still", "kids want something fun", "toddler meltdown", "the kids hate museums", "kids are hyper"],
    "hot": ["it's too hot", "boiling outside", "the heat is too much", "sweating a lot", "need air conditioning", "scorching sun",
            "so humid", "heatwave", "burning up", "need shade", "45 degrees outside",
            "can't be outside in this", "unbearable heat", "need somewhere cool"],
}
PREFIX = ["", "", "honestly ", "today ", "ugh ", "hey, ", "right now ", "this morning ", "well ", "so "]
JOIN = [" and ", ", ", " but ", " also ", ". ", " plus "]
NEUTRAL = ["what's the plan", "show me today", "how much is it", "where are we staying", "what time is dinner", "ok thanks",
           "can you check the booking", "hello", "any updates", "what's next",
           "we're at the hotel", "we're on the way", "is it ready", "we are here", "anything else for today", "big thanks"]

# natural sentences written separately, never produced by the generator (used only for evaluation)
NATURAL_TEST = [
    ("We barely slept on the train and my knees hurt", ["tired"]),
    ("Grandma is worn out, can we keep today light?", ["tired", "relaxed"]),
    ("The kids are climbing the walls, they need something fun", ["restless_kids"]),
    ("It's 42 degrees, we can't be outside", ["hot"]),
    ("We're starving, anything local and tasty?", ["foodie"]),
    ("Feeling adventurous, bored of forts", ["adventurous"]),
    ("Our anniversary is tonight, something special for two", ["romantic"]),
    ("Everyone slept well and is ready for a big day", ["energetic"]),
    ("I'd love to understand the history of this place", ["cultural"]),
    ("Can we just have a calm afternoon away from the crowds", ["relaxed"]),
    ("The toddler is cranky and it's really hot", ["restless_kids", "hot"]),
    ("Exhausted but hungry", ["tired", "foodie"]),
    ("What time does the safari start?", []),
    ("Show me tomorrow's plan", []),
    ("We want thrills today!", ["adventurous"]),
    ("Please somewhere with AC, the heat is unbearable", ["hot"]),
]


def corpus(n: int = 6000, seed: int = 3):
    rnd = random.Random(seed)
    moods = list(PHRASES)
    X, Y = [], []
    for _ in range(n):
        r = rnd.random()
        if r < 0.1:
            X.append(rnd.choice(PREFIX) + rnd.choice(NEUTRAL))
            Y.append([])
            continue
        k = 1 if r < 0.7 else 2
        picked = rnd.sample(moods, k)
        parts = [rnd.choice(PHRASES[m]) for m in picked]
        text = rnd.choice(PREFIX) + rnd.choice(JOIN).join(parts)
        if rnd.random() < 0.3:
            text += rnd.choice(["", "!", ".", " lol", " please", " :("])
        X.append(text)
        Y.append(picked)
    return X, Y
