import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { conditionLabel, getWeather } from "@/lib/places/open-meteo";
import { getPlaceSummary } from "@/lib/places/wikipedia";

/** Everything the Browse tab's place detail page shows, from free sources
 * only: current + 5-day weather (Open-Meteo) and a summary/image/background
 * (Wikipedia). No paid API involved. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const name = req.nextUrl.searchParams.get("name")?.trim();
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "name, lat and lng are required" }, { status: 400 });
  }

  const [weather, summary] = await Promise.all([getWeather(lat, lng).catch(() => null), getPlaceSummary(name).catch(() => null)]);

  return NextResponse.json({
    name,
    location: { lat, lng },
    weather: weather && {
      currentTempC: weather.currentTempC,
      currentCondition: conditionLabel(weather.currentConditionCode),
      forecast: weather.dailyDates.map((date, i) => ({
        date,
        highC: weather.dailyHighC[i],
        lowC: weather.dailyLowC[i],
        condition: conditionLabel(weather.dailyConditionCode[i]),
      })),
    },
    summary: summary?.extract ?? null,
    imageUrl: summary?.imageUrl ?? null,
    sourceUrl: summary?.pageUrl ?? null,
  });
}
