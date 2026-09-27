from app.intent import parse


def test_disruptions():
    assert parse("We're stuck in traffic, running 30 min late") == {"intent": "late", "minutes": 30, "day": None}
    assert parse("It's pouring on day 2")["intent"] == "rain" and parse("It's pouring on day 2")["day"] == 2
    assert parse("will it rain tomorrow? what's the forecast")["intent"] == "weather"


def test_booking_and_money():
    assert parse("Book the trip, full payment") == {"intent": "book", "pay": "full"}
    assert parse("please book it with a deposit")["pay"] == "deposit"
    assert parse("I want to pay the balance")["intent"] == "pay_balance"
    assert parse("show my tickets")["intent"] == "tickets"
    assert parse("go with option B")["option"] == "B"


def test_mood_and_plan_edits():
    assert parse("the kids are cranky")["intent"] == "mood"
    assert parse("skip the zipline")["intent"] == "remove"
    assert parse("cheaper hotel please")["intent"] == "hotel_down"
    assert parse("hello")["intent"] == "help"
