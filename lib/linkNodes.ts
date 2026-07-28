/**
 * 파티클 구체에 띄울 링크 노드 정의 + 사용자 편집(즐겨찾기) 스토어.
 *
 * 아이콘 전략:
 *  1) 유명 브랜드 → Simple Icons 단색 SVG를 브랜드색으로 렌더(네온 톤)
 *  2) 실패/무명 사이트 → 구글 파비콘 서비스로 폴백(어떤 URL이든 아이콘 확보)
 */
export interface LinkNode {
  id: string;
  label: string;
  url: string;
  /** simple-icons 슬러그(추정 가능하면). 없거나 실패하면 파비콘 사용. */
  slug?: string;
  color: string; // 브랜드/네온 색
  /** 파비콘 폴백 URL (항상 채워둔다). */
  favicon: string;
}

const STORAGE_KEY = "omni.vision.links.v1";
const NEON = "#7dd3fc"; // 무명 사이트 기본 네온색

// 도메인 → 브랜드(슬러그·색) 매핑. 여기 있으면 단색 네온 아이콘으로 승격.
const BRANDS: Record<string, { slug: string; color: string }> = {
  "google.com": { slug: "google", color: "#4285F4" },
  "youtube.com": { slug: "youtube", color: "#FF0000" },
  "discord.com": { slug: "discord", color: "#5865F2" },
  "instagram.com": { slug: "instagram", color: "#E4405F" },
  "chatgpt.com": { slug: "openai", color: "#10A37F" },
  "openai.com": { slug: "openai", color: "#10A37F" },
  "notion.so": { slug: "notion", color: "#FFFFFF" },
  "github.com": { slug: "github", color: "#F0F6FC" },
  "x.com": { slug: "x", color: "#FFFFFF" },
  "twitter.com": { slug: "x", color: "#FFFFFF" },
  "reddit.com": { slug: "reddit", color: "#FF4500" },
  "twitch.tv": { slug: "twitch", color: "#9146FF" },
  "spotify.com": { slug: "spotify", color: "#1DB954" },
  "netflix.com": { slug: "netflix", color: "#E50914" },
  "figma.com": { slug: "figma", color: "#F24E1E" },
  "slack.com": { slug: "slack", color: "#4A154B" },
  "naver.com": { slug: "naver", color: "#03C75A" },
  "kakao.com": { slug: "kakaotalk", color: "#FFCD00" },
  "linkedin.com": { slug: "linkedin", color: "#0A66C2" },
  "threads.net": { slug: "threads", color: "#FFFFFF" },
  "tiktok.com": { slug: "tiktok", color: "#FFFFFF" },
};

function faviconUrl(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
}

function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
}

/**
 * 사용자가 붙여넣은 URL(+선택 이름) → LinkNode. 잘못된 입력이면 null.
 * 브랜드면 단색 슬러그로, 아니면 SLD를 슬러그로 추정하고 실패 시 파비콘.
 */
export function deriveLink(input: string, label?: string): LinkNode | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const parts = host.split(".");
  const base = parts.length >= 2 ? parts.slice(-2).join(".") : host; // google.com
  const sld = parts.length >= 2 ? parts[parts.length - 2] : parts[0]; // google
  const brand = BRANDS[host] || BRANDS[base];

  return {
    id: uid(),
    label: (label && label.trim()) || sld.charAt(0).toUpperCase() + sld.slice(1),
    url: u.href,
    slug: brand?.slug ?? sld, // SLD를 슬러그로 시도 → 실패하면 파비콘
    color: brand?.color ?? NEON,
    favicon: faviconUrl(host),
  };
}

/** 기본 시드 (첫 실행 시). */
export const DEFAULT_LINKS: LinkNode[] = [
  { id: "google", label: "Google", url: "https://google.com", slug: "google", color: "#4285F4", favicon: faviconUrl("google.com") },
  { id: "discord", label: "Discord", url: "https://discord.com", slug: "discord", color: "#5865F2", favicon: faviconUrl("discord.com") },
  { id: "youtube", label: "YouTube", url: "https://youtube.com", slug: "youtube", color: "#FF0000", favicon: faviconUrl("youtube.com") },
  { id: "instagram", label: "Instagram", url: "https://instagram.com", slug: "instagram", color: "#E4405F", favicon: faviconUrl("instagram.com") },
  { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com", slug: "openai", color: "#10A37F", favicon: faviconUrl("chatgpt.com") },
  { id: "notion", label: "Notion", url: "https://notion.so", slug: "notion", color: "#FFFFFF", favicon: faviconUrl("notion.so") },
];

// 하위호환: 기존에 LINK_NODES를 참조하던 코드용.
export const LINK_NODES = DEFAULT_LINKS;

/** 저장된 링크 로드. 없으면 기본 시드. (클라이언트에서만 호출) */
export function loadLinks(): LinkNode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LINKS;
}

export function saveLinks(list: LinkNode[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/**
 * Simple Icons SVG를 받아 지정 색으로 칠한 뒤 HTMLImageElement로 변환.
 * 실패하면 null.
 */
export function loadIcon(slug: string, color: string): Promise<HTMLImageElement | null> {
  const url = `https://cdn.jsdelivr.net/npm/simple-icons@13/icons/${slug}.svg`;
  return fetch(url)
    .then((r) => (r.ok ? r.text() : Promise.reject()))
    .then((svg) => {
      const colored = svg
        .replace("<svg", `<svg fill="${color.replace("#", "%23")}"`)
        .replace(/fill="[^"]*"/g, (m, i) => (i < 80 ? `fill="${color}"` : m));
      const blob = new Blob([colored], { type: "image/svg+xml" });
      const objUrl = URL.createObjectURL(blob);
      return new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = objUrl;
      });
    })
    .catch(() => null);
}

/** 파비콘 이미지 로드. 실패하면 null. */
function loadFavicon(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // 캔버스 오염 방지(그리기용)
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * 노드의 아이콘을 로드한다.
 *  1) 브랜드 단색 아이콘(slug) 시도 → 성공 시 네온 톤
 *  2) 실패하면 파비콘 폴백 → 어떤 사이트든 아이콘 확보
 */
export async function loadNodeIcon(node: LinkNode): Promise<HTMLImageElement | null> {
  if (node.slug) {
    const branded = await loadIcon(node.slug, node.color);
    if (branded) return branded;
  }
  return loadFavicon(node.favicon);
}
