/**
 * 파티클 구체에 띄울 링크 노드 정의.
 * 아이콘은 Simple Icons(jsdelivr CDN, 단색 SVG)를 브랜드색으로 렌더.
 */
export interface LinkNode {
  id: string;
  label: string;
  url: string;
  slug: string; // simple-icons 슬러그
  color: string; // 브랜드 색
}

export const LINK_NODES: LinkNode[] = [
  { id: "google", label: "Google", url: "https://google.com", slug: "google", color: "#4285F4" },
  { id: "discord", label: "Discord", url: "https://discord.com", slug: "discord", color: "#5865F2" },
  { id: "youtube", label: "YouTube", url: "https://youtube.com", slug: "youtube", color: "#FF0000" },
  { id: "instagram", label: "Instagram", url: "https://instagram.com", slug: "instagram", color: "#E4405F" },
  { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com", slug: "openai", color: "#10A37F" },
  { id: "notion", label: "Notion", url: "https://notion.so", slug: "notion", color: "#FFFFFF" },
];

/**
 * Simple Icons SVG를 받아 지정 색으로 칠한 뒤 캔버스에 그릴 수 있는
 * HTMLImageElement로 변환한다. 실패하면 null.
 */
export function loadIcon(slug: string, color: string): Promise<HTMLImageElement | null> {
  const url = `https://cdn.jsdelivr.net/npm/simple-icons@13/icons/${slug}.svg`;
  return fetch(url)
    .then((r) => (r.ok ? r.text() : Promise.reject()))
    .then((svg) => {
      // 단색 path에 브랜드색 입히기
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
