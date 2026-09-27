"""Weather digital twin: live conditions per destination and a what-if simulator for how rain, heat, wind and
flooding cascade onto attractions, transport, hotels and group satisfaction.

Ported from the original backend/app/digital_twin.py. Live weather is real (Open-Meteo, cached 10 minutes). The
simulator is a transparent rule model with stated uncertainty, not a trained model. The "social signals" are
ILLUSTRATIVE templates chosen by the weather, not a live feed: there is no social-media integration, and every signal is
marked `illustrative: True` so the UI can say so. Applying a mitigation hands off to the disruption engine.
"""
import math
import random
import httpx
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

# Coordinates for target destinations
CITY_COORDS = {
    "Delhi": {"lat": 28.6139, "lon": 77.209},
    "Agra": {"lat": 27.1767, "lon": 78.0081},
    "Jaipur": {"lat": 26.9124, "lon": 75.7873},
    "Ranthambore": {"lat": 26.0173, "lon": 76.5026},
    "Pushkar": {"lat": 26.4899, "lon": 74.5511},
    "Jodhpur": {"lat": 26.2389, "lon": 73.0243},
    "Jaisalmer": {"lat": 26.9157, "lon": 70.9083},
    "Udaipur": {"lat": 24.5854, "lon": 73.7125},
    "Bikaner": {"lat": 28.0229, "lon": 73.3119},
    "Chittorgarh": {"lat": 24.8887, "lon": 74.6269},
    "Mount Abu": {"lat": 24.5926, "lon": 72.7156},
    "Bundi": {"lat": 25.4305, "lon": 75.6499},
}

# In-memory weather cache to avoid hitting Open-Meteo excessively
WEATHER_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 600

async def fetch_live_weather(city: str) -> Dict[str, Any]:
    """Fetch live weather from Open-Meteo for a given city."""
    coords = CITY_COORDS.get(city, CITY_COORDS["Jaipur"])
    cache_entry = WEATHER_CACHE.get(city)
    now_ts = datetime.now(timezone.utc).timestamp()
    
    if cache_entry and (now_ts - cache_entry["timestamp"] < CACHE_TTL_SECONDS):
        return cache_entry["data"]

    url = f"https://api.open-meteo.com/v1/forecast?latitude={coords['lat']}&longitude={coords['lon']}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m&hourly=precipitation_probability,rain&forecast_days=1"
    
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                current = data.get("current", {})
                code = current.get("weather_code", 0)
                
                # Weather code interpretation
                condition = "Clear"
                if code in [1, 2, 3]:
                    condition = "Partly Cloudy"
                elif code in [45, 48]:
                    condition = "Foggy"
                elif code in [51, 53, 55, 61, 63, 65, 80, 81, 82]:
                    condition = "Rainy"
                elif code in [95, 96, 99]:
                    condition = "Thunderstorm"

                result = {
                    "city": city,
                    "temperature": current.get("temperature_2m", 28.0),
                    "humidity": current.get("relative_humidity_2m", 65),
                    "precipitation_mm": current.get("rain", 0.0) or current.get("precipitation", 0.0),
                    "wind_speed": current.get("wind_speed_10m", 12.0),
                    "condition": condition,
                    "weather_code": code,
                    "coords": coords,
                    "is_live": True,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                WEATHER_CACHE[city] = {"data": result, "timestamp": now_ts}
                return result
    except Exception as e:
        pass  # fall through to the stated fallback below

    # Fallback default weather
    fallback = {
        "city": city,
        "temperature": 31.5,
        "humidity": 58,
        "precipitation_mm": 0.0,
        "wind_speed": 10.2,
        "condition": "Clear",
        "weather_code": 0,
        "coords": coords,
        "is_live": False,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    return fallback


def generate_social_signals(city: str, weather_condition: str, rain_mm: float, temp: float) -> List[Dict[str, Any]]:
    """Generate realistic live social signals & traveler posts based on real-world conditions."""
    posts = []

    if rain_mm > 15 or weather_condition in ["Rainy", "Thunderstorm"]:
        posts.extend([
            {
                "id": "soc_1",
                "handle": "@travel_guy_99",
                "platform": "Twitter/X",
                "avatar": "🌧️",
                "text": f"Heavy downpour near Amber Fort in #{city}! Waterlogging near entry gates. Expect delays.",
                "sentiment": "negative",
                "sentiment_score": -0.78,
                "confidence": 0.92,
                "topic": "Flood & Traffic",
                "timestamp": "12 mins ago",
                "location": city,
                "illustrative": True
            },
            {
                "id": "soc_2",
                "handle": "@jaipur_updates",
                "platform": "Public Feed",
                "avatar": "⚠️",
                "text": f"Traffic slow down on Highway due to heavy rain. Cab wait times up by 35 mins.",
                "sentiment": "negative",
                "sentiment_score": -0.65,
                "confidence": 0.88,
                "topic": "Transport Delay",
                "timestamp": "25 mins ago",
                "location": city,
                "illustrative": True
            },
            {
                "id": "soc_3",
                "handle": "@local_explorer",
                "platform": "Instagram",
                "avatar": "☕",
                "text": f"Rainy day coffee vibes in #{city}! Outdoor walking tours moving indoors to museums.",
                "sentiment": "neutral",
                "sentiment_score": 0.15,
                "confidence": 0.85,
                "topic": "Activity Shift",
                "timestamp": "40 mins ago",
                "location": city,
                "illustrative": True
            }
        ])
    elif temp > 38:
        posts.extend([
            {
                "id": "soc_4",
                "handle": "@nomad_diaries",
                "platform": "Twitter/X",
                "avatar": "🔥",
                "text": f"Extreme heat wave hitting #{city} today! 40°C+ at noon. Staying indoors until 4 PM.",
                "sentiment": "negative",
                "sentiment_score": -0.55,
                "confidence": 0.90,
                "topic": "Heat Warning",
                "timestamp": "18 mins ago",
                "location": city,
                "illustrative": True
            },
            {
                "id": "soc_5",
                "handle": "@tourist_guide",
                "platform": "Public Feed",
                "avatar": "🍦",
                "text": f"Hydration points setup near major heritage sites in #{city}. Shade spots packed.",
                "sentiment": "positive",
                "sentiment_score": 0.42,
                "confidence": 0.82,
                "topic": "Health & Shade",
                "timestamp": "32 mins ago",
                "location": city,
                "illustrative": True
            }
        ])
    else:
        posts.extend([
            {
                "id": "soc_6",
                "handle": "@wandering_soul",
                "platform": "Instagram",
                "avatar": "✨",
                "text": f"Perfect pleasant weather in #{city}! Clear skies and smooth sightseeing everywhere.",
                "sentiment": "positive",
                "sentiment_score": 0.89,
                "confidence": 0.95,
                "topic": "Pleasant Sightseeing",
                "timestamp": "5 mins ago",
                "location": city,
                "illustrative": True
            },
            {
                "id": "soc_7",
                "handle": "@tripguide_in",
                "platform": "Twitter/X",
                "avatar": "🚌",
                "text": f"All tourist buses and heritage entries running right on schedule in #{city}.",
                "sentiment": "positive",
                "sentiment_score": 0.76,
                "confidence": 0.91,
                "topic": "Normal Operations",
                "timestamp": "15 mins ago",
                "location": city,
                "illustrative": True
            }
        ])

    return posts


def simulate_digital_twin_impact(
    city: str,
    rain_mm: float,
    temp: float,
    storm_duration_hrs: float,
    flood_level: str,  # 'None', 'Low', 'Moderate', 'Severe'
    wind_speed: float
) -> Dict[str, Any]:
    """
    AI Simulation Engine for Digital Twin counterfactual what-if analysis.
    Models primary, secondary, and higher-order cascading effects on:
    - Outdoor/Indoor attraction accessibility & demand
    - Transport route delays & risk of cancellation
    - Hotel capacity & late check-in loads
    - Group satisfaction impact
    - Probabilistic prediction with uncertainty intervals
    """
    flood_mult = {"None": 1.0, "Low": 1.3, "Moderate": 1.8, "Severe": 2.5}.get(flood_level, 1.0)
    
    # 1. Primary Risk Computations
    outdoor_risk = min(99.0, (rain_mm * 2.8 + (temp > 40) * 30 + (wind_speed > 30) * 25) * flood_mult)
    indoor_demand_shift = min(85.0, (rain_mm * 1.9 + (temp > 38) * 20) * flood_mult)
    
    # Transport delay prediction (minutes) & cancellation probability (%)
    base_delay_min = (rain_mm * 3.5 + storm_duration_hrs * 4.2 + (wind_speed > 25) * 15) * flood_mult
    delay_prob = min(98.0, base_delay_min * 1.4)
    uncertainty_margin = round(min(12.0, 3.0 + delay_prob * 0.08), 1)
    
    cancellation_prob = min(95.0, max(0.0, (rain_mm - 20) * 2.2 + (flood_level == "Severe") * 50))
    
    # Hotel & Vendor load shifts
    hotel_late_checkin_risk = min(90.0, delay_prob * 0.75)
    vendor_capacity_stress = min(100.0, indoor_demand_shift * 0.8 + delay_prob * 0.3)
    
    # Group satisfaction impact penalty
    satisfaction_penalty = min(45.0, (outdoor_risk * 0.3 + delay_prob * 0.25 + (flood_level != "None") * 15))
    simulated_group_score = max(35.0, round(88.0 - satisfaction_penalty, 1))

    # 2. Cascading Entity Network Nodes
    entities = [
        {
            "id": "ent_attractions_outdoor",
            "name": f"{city} Outdoor Forts & Palaces",
            "category": "Attraction",
            "type": "Outdoor",
            "status": "Severely Affected" if outdoor_risk > 60 else ("Moderately Affected" if outdoor_risk > 30 else "Normal"),
            "risk_score": round(outdoor_risk, 1),
            "cascading_effect": "Visitors rerouted to indoor museums; ticket refunds expected." if outdoor_risk > 50 else "Standard operating conditions."
        },
        {
            "id": "ent_attractions_indoor",
            "name": f"{city} Museums & Craft Centers",
            "category": "Attraction",
            "type": "Indoor",
            "status": "High Surge" if indoor_demand_shift > 50 else "Normal",
            "risk_score": round(indoor_demand_shift, 1),
            "cascading_effect": "Capacity reaching 90%+ limit due to outdoor rain evacuations." if indoor_demand_shift > 50 else "Normal visitor density."
        },
        {
            "id": "ent_transport_hubs",
            "name": f"{city} Transit & Highway Corridors",
            "category": "Transport",
            "type": "Corridor",
            "status": "Critical Disruption" if delay_prob > 70 else ("Delayed" if delay_prob > 30 else "On Time"),
            "risk_score": round(delay_prob, 1),
            "cascading_effect": f"Average expected delay: {int(base_delay_min)} mins (±{uncertainty_margin} mins). Cab surges +{int(delay_prob*0.6)}%."
        },
        {
            "id": "ent_hotels",
            "name": f"{city} Partner Hotels & Stays",
            "category": "Hospitality",
            "type": "Stay",
            "status": "High Late Arrival Load" if hotel_late_checkin_risk > 50 else "Normal Operations",
            "risk_score": round(hotel_late_checkin_risk, 1),
            "cascading_effect": "Front desk hold policy auto-triggered for arriving groups." if hotel_late_checkin_risk > 50 else "Smooth check-ins."
        }
    ]

    # 3. Recommended Proactive Action Plan
    actions = []
    if outdoor_risk > 45:
        actions.append({
            "title": "Auto-Swap Outdoor to Indoor",
            "description": f"Swap outdoor sightseeing with indoor artisan workshops in {city}.",
            "impact": "Saves 3.5 hrs travel time and avoids weather discomfort."
        })
    if delay_prob > 40:
        actions.append({
            "title": "Buffer Transport Schedule",
            "description": f"Add 45-minute buffer time to transit connections in {city}.",
            "impact": f"Reduces missed activity probability from {int(delay_prob)}% to <10%."
        })
    if flood_level in ["Moderate", "Severe"]:
        actions.append({
            "title": "Notify Hotel for Late Hold",
            "description": "Send automated late arrival vouchers to partner hotels.",
            "impact": "Prevents room release or no-show fees."
        })
    if not actions:
        actions.append({
            "title": "Maintain Regular Itinerary",
            "description": "All system parameters are within optimal ranges.",
            "impact": "High traveler satisfaction predicted."
        })

    return {
        "simulation_parameters": {
            "city": city,
            "rain_mm": rain_mm,
            "temp": temp,
            "storm_duration_hrs": storm_duration_hrs,
            "flood_level": flood_level,
            "wind_speed": wind_speed
        },
        "probabilistic_predictions": {
            "outdoor_activity_risk_pct": round(outdoor_risk, 1),
            "indoor_demand_surge_pct": round(indoor_demand_shift, 1),
            "transport_delay_probability_pct": round(delay_prob, 1),
            "expected_delay_minutes": int(base_delay_min),
            "uncertainty_margin_mins": uncertainty_margin,
            "cancellation_risk_pct": round(cancellation_prob, 1),
            "hotel_late_checkin_risk_pct": round(hotel_late_checkin_risk, 1),
            "vendor_capacity_stress_pct": round(vendor_capacity_stress, 1),
            "simulated_group_satisfaction_score": simulated_group_score,
            "satisfaction_drop_points": round(satisfaction_penalty, 1)
        },
        "entities": entities,
        "recommended_actions": actions,
        "social_signals": generate_social_signals(city, "Rainy" if rain_mm > 10 else "Clear", rain_mm, temp),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
