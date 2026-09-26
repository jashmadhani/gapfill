from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow():
    return datetime.utcnow()


class AppState(Base):
    """Single row: demo clock, forecast and which tour the traveler app is showing."""
    __tablename__ = "app_state"
    id: Mapped[int] = mapped_column(primary_key=True)
    demo_date: Mapped[date] = mapped_column(Date)
    demo_time: Mapped[str] = mapped_column(String(5), default="11:30")
    active_tour_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rain: Mapped[list] = mapped_column(JSON, default=list)  # [{"dest": "jaipur", "date": "2026-09-27"}]


class Destination(Base):
    __tablename__ = "destinations"
    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    region: Mapped[str] = mapped_column(String(80))
    tagline: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    ideal_nights: Mapped[int] = mapped_column(Integer, default=2)
    airport: Mapped[bool] = mapped_column(Boolean, default=False)
    rail: Mapped[bool] = mapped_column(Boolean, default=True)
    best_months: Mapped[str] = mapped_column(String(40), default="Oct–Mar")


class Vendor(Base):
    """Hotels, transport providers and activity operators the tour operator works with."""
    __tablename__ = "vendors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(16))  # hotel | transport | activity
    dest_key: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phone: Mapped[str] = mapped_column(String(32), default="")
    contact: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(16), default="open")  # open | closed
    commission_pct: Mapped[float] = mapped_column(Float, default=10)


class Offering(Base):
    """A bookable component: an activity, a hotel (per room-night) or a transport product."""
    __tablename__ = "offerings"
    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"))
    kind: Mapped[str] = mapped_column(String(16))  # activity | hotel | transport
    dest_key: Mapped[str | None] = mapped_column(String(32), nullable=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    duration_min: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[float] = mapped_column(Float)  # activity: per person · hotel: per room-night · transport: rate (see mode)
    open: Mapped[str] = mapped_column(String(5), default="00:00")
    close: Mapped[str] = mapped_column(String(5), default="23:59")
    closed_weekdays: Mapped[list] = mapped_column(JSON, default=list)  # 0 = Monday
    indoor_outdoor: Mapped[str] = mapped_column(String(8), default="indoor")
    rating: Mapped[float] = mapped_column(Float, default=4.3)
    rating_count: Mapped[int] = mapped_column(Integer, default=50)
    lat: Mapped[float] = mapped_column(Float, default=0)
    lng: Mapped[float] = mapped_column(Float, default=0)
    kid_friendly: Mapped[bool] = mapped_column(Boolean, default=True)
    step_free: Mapped[bool] = mapped_column(Boolean, default=False)
    tier: Mapped[str | None] = mapped_column(String(16), nullable=True)  # hotels: budget | standard | premium | luxury
    mode: Mapped[str | None] = mapped_column(String(16), nullable=True)  # transport: car | train | flight
    capacity: Mapped[int] = mapped_column(Integer, default=20)
    status: Mapped[str] = mapped_column(String(16), default="open")  # open | closed | full
    amenities: Mapped[list] = mapped_column(JSON, default=list)
    # physical / crowd profile used by the ML models (activities only)
    category: Mapped[str | None] = mapped_column(String(16), nullable=True)
    intensity: Mapped[float] = mapped_column(Float, default=2)
    stairs: Mapped[float] = mapped_column(Float, default=0.3)
    walk_km: Mapped[float] = mapped_column(Float, default=1.5)
    seating: Mapped[float] = mapped_column(Float, default=0.3)
    shade: Mapped[float] = mapped_column(Float, default=0.3)
    min_age: Mapped[int] = mapped_column(Integer, default=0)
    popularity: Mapped[float] = mapped_column(Float, default=0.1)  # Google reviews, in lakh
    best_time: Mapped[str] = mapped_column(String(12), default="all")
    source: Mapped[str] = mapped_column(String(16), default="curated")  # curated | kaggle


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    city: Mapped[str] = mapped_column(String(60), default="")
    segment: Mapped[str] = mapped_column(String(20), default="couple")
    interests: Mapped[list] = mapped_column(JSON, default=list)


class Coordinator(Base):
    __tablename__ = "coordinators"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(32), default="")
    base: Mapped[str] = mapped_column(String(32), default="jaipur")
    languages: Mapped[list] = mapped_column(JSON, default=list)


class Tour(Base):
    __tablename__ = "tours"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(160))
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    coordinator_id: Mapped[int | None] = mapped_column(ForeignKey("coordinators.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft | booked | cancelled | reviewed
    start_date: Mapped[date] = mapped_column(Date)
    days: Mapped[int] = mapped_column(Integer)
    prefs: Mapped[dict] = mapped_column(JSON, default=dict)
    group: Mapped[dict] = mapped_column(JSON, default=dict)  # {name, adults, children, members: []}
    route: Mapped[list] = mapped_column(JSON, default=list)  # [{dest, nights, first_day}]
    notes: Mapped[list] = mapped_column(JSON, default=list)  # optimisation notes
    checklist: Mapped[dict] = mapped_column(JSON, default=dict)
    review: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    booked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TourItem(Base):
    __tablename__ = "tour_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), index=True)
    day: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(16))  # activity | hotel | transport | fee | rest
    offering_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vendor_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    dest_key: Mapped[str | None] = mapped_column(String(32), nullable=True)
    from_key: Mapped[str | None] = mapped_column(String(32), nullable=True)
    start_min: Mapped[int] = mapped_column(Integer, default=0)
    end_min: Mapped[int] = mapped_column(Integer, default=0)
    nights: Mapped[int] = mapped_column(Integer, default=0)
    qty: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float, default=0)
    price: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(16), default="planned")  # planned | booked | disrupted | replaced | cancelled
    booking_ref: Mapped[str | None] = mapped_column(String(24), nullable=True)
    vendor_status: Mapped[str | None] = mapped_column(String(16), nullable=True)  # pending | confirmed | declined
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    kind: Mapped[str] = mapped_column(String(16), default="payment")  # payment | refund
    method: Mapped[str] = mapped_column(String(20), default="upi")
    note: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ChangeEvent(Base):
    """A disruption or requested change, its impact analysis, and the recovery options offered."""
    __tablename__ = "change_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), index=True)
    trigger_type: Mapped[str] = mapped_column(String(24))
    label: Mapped[str] = mapped_column(String(80))
    reason: Mapped[str] = mapped_column(Text)
    impact: Mapped[dict] = mapped_column(JSON, default=dict)
    options: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | accepted | dismissed
    chosen: Mapped[str | None] = mapped_column(String(16), nullable=True)
    source: Mapped[str] = mapped_column(String(16), default="system")  # system | traveler | operator | vendor
    resolved_by: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Task(Base):
    """Coordination work for the operator: vendor confirmations, cancellations, callbacks, payment follow-ups."""
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    tour_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    vendor_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    coordinator_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    kind: Mapped[str] = mapped_column(String(16))  # confirm | cancel | notify | callback | payment
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    offering_id: Mapped[int] = mapped_column(Integer, index=True)
    tour_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    author: Mapped[str] = mapped_column(String(80), default="Traveler")
    rating: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    tour_id: Mapped[int] = mapped_column(Integer, index=True)
    role: Mapped[str] = mapped_column(String(12))  # user | assistant
    text: Mapped[str] = mapped_column(Text)
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Feedback(Base):
    """Real traveler signals that retrain the satisfaction model: ratings, swaps, skips, additions."""
    __tablename__ = "feedback"
    id: Mapped[int] = mapped_column(primary_key=True)
    tour_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    offering_id: Mapped[int] = mapped_column(Integer, index=True)
    member: Mapped[str] = mapped_column(String(80), default="")
    age: Mapped[int] = mapped_column(Integer, default=35)
    rating: Mapped[float] = mapped_column(Float)
    signal: Mapped[str] = mapped_column(String(16))  # review | added | swap_in | swap_out | removed
    features: Mapped[list] = mapped_column(JSON, default=list)  # the exact model input at the time
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
