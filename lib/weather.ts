/**
 * 무료·무키 날씨 (Open-Meteo). 서버에서 호출.
 */

const WMO: Record<number, string> = {
  0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림",
  45: "안개", 48: "짙은 안개",
  51: "약한 이슬비", 53: "이슬비", 55: "강한 이슬비",
  61: "약한 비", 63: "비", 65: "강한 비",
  71: "약한 눈", 73: "눈", 75: "강한 눈",
  80: "소나기", 81: "소나기", 82: "강한 소나기",
  95: "천둥번개", 96: "우박 동반 뇌우", 99: "강한 우박 뇌우",
};

// Open-Meteo 지오코딩은 한글 도시명을 인식 못 함 → 영문으로 변환.
const KO_CITY: Record<string, string> = {
  서울: "Seoul", 부산: "Busan", 인천: "Incheon", 대구: "Daegu",
  대전: "Daejeon", 광주: "Gwangju", 울산: "Ulsan", 세종: "Sejong",
  수원: "Suwon", 성남: "Seongnam", 고양: "Goyang", 용인: "Yongin",
  창원: "Changwon", 청주: "Cheongju", 전주: "Jeonju", 천안: "Cheonan",
  안산: "Ansan", 안양: "Anyang", 김해: "Gimhae", 포항: "Pohang",
  평택: "Pyeongtaek", 춘천: "Chuncheon", 강릉: "Gangneung", 원주: "Wonju",
  목포: "Mokpo", 여수: "Yeosu", 경주: "Gyeongju", 제주: "Jeju",
  도쿄: "Tokyo", 오사카: "Osaka", 뉴욕: "New York", 런던: "London",
  파리: "Paris", 베이징: "Beijing", 상하이: "Shanghai", 홍콩: "Hong Kong",
};

export interface Weather {
  city: string;
  country: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  code: number;
}

export async function getWeather(city: string): Promise<Weather | null> {
  const original = city.trim();
  if (!original) return null;
  // 한글 도시명이면 영문으로 변환해 검색 (표시는 원래 이름 유지).
  const q = KO_CITY[original] ?? original;
  const translated = q !== original;
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        q
      )}&count=1&language=en&format=json`
    );
    const geo = await geoRes.json();
    const place = geo.results?.[0];
    if (!place) return null;

    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`
    );
    const w = await wRes.json();
    const c = w.current;
    return {
      city: translated ? original : place.name, // 한글 입력이면 한글로 표시
      country: place.country || "",
      temperature: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      condition: WMO[c.weather_code] ?? "알 수 없음",
      code: c.weather_code,
    };
  } catch (e) {
    console.error("getWeather error:", e);
    return null;
  }
}

/** 날씨 의도 + 도시명 추출. 도시 못 찾으면 city=null. */
export function parseWeatherIntent(
  message: string,
  prevAssistant?: string
): { isWeather: boolean; city: string | null } {
  const isWeather = /날씨|기온|weather|temperature/i.test(message);
  // "서울 날씨", "부산 기온", "날씨 서울" 등에서 도시 추출
  let city: string | null = null;
  const m1 = message.match(/([가-힣A-Za-z]{2,})\s*(?:의)?\s*(?:날씨|기온|weather)/);
  const m2 = message.match(/(?:날씨|기온|weather)\s*(?:는|은)?\s*([가-힣A-Za-z]{2,})/);
  if (m1) city = m1[1];
  else if (m2) city = m2[1];

  // 직전에 OMNI가 지역을 물었고, 이번 메시지가 도시명만 온 경우 (예: "서울이야")
  if (!isWeather && prevAssistant && /지역|어디|도시|어느\s*곳/.test(prevAssistant)) {
    const cityOnly = message.match(/^([가-힣A-Za-z]{2,})(?:이야|야|요|입니다|예요)?$/);
    if (cityOnly) return { isWeather: true, city: cityOnly[1] };
  }
  // "오늘 날씨" 처럼 도시 없는 일반 표현은 흔한 군더더기 제외
  if (city && /^(오늘|지금|현재|내일|이번|요즘)$/.test(city)) city = null;

  return { isWeather, city };
}
