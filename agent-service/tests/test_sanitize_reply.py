from app.agent import sanitize_reply


def test_known_glyphs_get_ascii_substitutes():
    assert sanitize_reply("cost is ₹60000 — enjoy") == "cost is Rs.60000 - enjoy"
    assert sanitize_reply("Udaipur → Jaipur") == "Udaipur -> Jaipur"
    assert sanitize_reply("It’s a “great” trip") == 'It\'s a "great" trip'


def test_unknown_non_ascii_is_dropped_not_shipped_broken():
    # Some mis-tokenized glyph outside the known-substitution table (the
    # model's confirmed mojibake failure mode) should be dropped, not shipped
    # to the UI as broken bytes.
    assert sanitize_reply("cost is ☃ today") == "cost is today"


def test_missing_space_before_rs_is_restored():
    assert sanitize_reply("totalRs.60,000") == "total Rs.60,000"


def test_plain_ascii_is_left_alone():
    assert sanitize_reply("Day 1 in Udaipur: City Palace walk, Rs.900.") == "Day 1 in Udaipur: City Palace walk, Rs.900."
