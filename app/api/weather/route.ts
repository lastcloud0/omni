import { NextResponse } from "next/server";
import { getWeather } from "@/lib/weather";

export const runtime = "nodejs";

/**
 * 무료·무키 날씨 API (Open-Meteo).
 * GET /api/weather?city=서울
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get("city") || "").trim();
  if (!city) {
    return NextResponse.json({ error: "도시명이 필요합니다." }, { status: 400 });
  }
  const data = await getWeather(city);
  if (!data) {
    return NextResponse.json(
      { error: `'${city}' 날씨를 찾지 못했습니다.` },
      { status: 404 }
    );
  }
  return NextResponse.json(data);
}
