"""ORM models. Field names follow the spec; a few extra columns (noted inline) support the demo."""
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120))
    group_type: Mapped[str] = mapped_column(String(20), default="couple")  # solo/couple/family/large_group
    accessibility_flags: Mapped[list] = mapped_column(JSON, default=list)
    home_currency: Mapped[str] = mapped_column(String(8), default="INR")


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    location: Mapped[dict] = mapped_column(JSON)  # {"lat", "lng", "key", "name"}
    time_window_start: Mapped[datetime] = mapped_column(DateTime)
    time_window_end: Mapped[datetime] = mapped_column(DateTime)
    budget_envelope: Mapped[float] = mapped_column(Float)
    intent_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    intent_parsed_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class Itinerary(Base):
    __tablename__ = "itineraries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    trip_date: Mapped[date] = mapped_column(Date)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("sessions.id"), nullable=True)  # extra


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    itinerary_id: Mapped[int] = mapped_column(ForeignKey("itineraries.id"))
    type: Mapped[str] = mapped_column(String(20))  # booked/suggested/gap
    start_time: Mapped[datetime] = mapped_column(DateTime)
    end_time: Mapped[datetime] = mapped_column(DateTime)
    experience_id: Mapped[int | None] = mapped_column(ForeignKey("experiences.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="confirmed")  # confirmed/pending/disrupted/replaced
    # extra: display + routing context
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    location_key: Mapped[str | None] = mapped_column(String(60), nullable=True)
    # extra: the idle window this experience was placed into, so replans re-solve the original slot
    slot_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    slot_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    booking_ref: Mapped[str | None] = mapped_column(String(20), nullable=True)
    price_paid: Mapped[float | None] = mapped_column(Float, nullable=True)


class Vendor(Base):
    __tablename__ = "vendors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    contact_channel: Mapped[str] = mapped_column(String(120), default="whatsapp")
    status: Mapped[str] = mapped_column(String(20), default="open")  # open/closed/full
    onboarding_source: Mapped[str] = mapped_column(String(40), default="seed")


class Experience(Base):
    __tablename__ = "experiences"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    category_tags: Mapped[list] = mapped_column(JSON, default=list)
    price: Mapped[float] = mapped_column(Float)
    duration_min: Mapped[int] = mapped_column(Integer)
    location: Mapped[dict] = mapped_column(JSON)  # {"lat", "lng", "key", "name"}
    accessibility_attributes: Mapped[dict] = mapped_column(JSON, default=dict)
    group_suitability: Mapped[list] = mapped_column(JSON, default=list)
    opening_hours: Mapped[dict] = mapped_column(JSON, default=dict)  # {"open": "HH:MM", "close": "HH:MM"}
    indoor_outdoor: Mapped[str] = mapped_column(String(10), default="indoor")  # indoor/outdoor/mixed
    capacity_left: Mapped[int] = mapped_column(Integer, default=10)
    # extra: cached trust score (recomputed on seed / review insert, never per request)
    trust_score: Mapped[float] = mapped_column(Float, default=0.0)
    trust_meta: Mapped[dict] = mapped_column(JSON, default=dict)


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    experience_id: Mapped[int] = mapped_column(ForeignKey("experiences.id"))
    rating: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime)


class Bundle(Base):
    __tablename__ = "bundles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"))
    experience_ids: Mapped[list] = mapped_column(JSON)
    total_price: Mapped[float] = mapped_column(Float)


class DisruptionEvent(Base):
    __tablename__ = "disruption_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    itinerary_item_id: Mapped[int] = mapped_column(ForeignKey("itinerary_items.id"))
    trigger_type: Mapped[str] = mapped_column(String(20))  # unavailable/weather/time_shrink/budget_shrink
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    resolution_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/accepted/dismissed
    # extra: plain-language reason, the constraints to re-solve against, and the computed alternatives
    reason: Mapped[str] = mapped_column(Text, default="")
    context: Mapped[dict] = mapped_column(JSON, default=dict)
    alternatives: Mapped[list] = mapped_column(JSON, default=list)


class DemandSignal(Base):
    __tablename__ = "demand_signals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_id_or_area: Mapped[str] = mapped_column(String(60))  # "vendor:3" or "area:johari_bazaar"
    query_tag: Mapped[str] = mapped_column(String(60))
    count: Mapped[int] = mapped_column(Integer, default=0)
    date: Mapped[date] = mapped_column(Date)


class TravelTime(Base):
    """Static precomputed travel-time lookup table (no external maps API)."""
    __tablename__ = "travel_times"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    from_key: Mapped[str] = mapped_column(String(60))
    to_key: Mapped[str] = mapped_column(String(60))
    minutes: Mapped[int] = mapped_column(Integer)


class AppState(Base):
    """Single-row demo state: weather flag, demo clock, active session/itinerary."""
    __tablename__ = "app_state"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    weather_bad: Mapped[bool] = mapped_column(default=False)
    demo_now: Mapped[str] = mapped_column(String(5), default="11:30")
    active_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active_session_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active_itinerary_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
