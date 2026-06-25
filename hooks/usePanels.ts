"use client";

import { useCallback, useState } from "react";
import type { Panel } from "@/lib/types";

/**
 * 화면에 떠 있는 API 패널들을 관리한다. priority 내림차순으로 정렬되어
 * 우선순위가 높은 패널이 앞쪽(왼쪽 위)에 배치된다.
 *
 * open(): 같은 id가 있으면 갱신, 없으면 추가.
 * close(): 닫기. clear(): 전부 닫기 → 코어가 다시 커진다.
 */
export function usePanels() {
  const [panels, setPanels] = useState<Panel[]>([]);

  const open = useCallback((panel: Panel) => {
    setPanels((prev) => {
      const rest = prev.filter((p) => p.id !== panel.id);
      return [...rest, panel].sort((a, b) => b.priority - a.priority);
    });
  }, []);

  const close = useCallback((id: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => setPanels([]), []);

  return { panels, open, close, clear, hasPanels: panels.length > 0 };
}

/** 데모용 패널 팩토리 (실제 API 연동 전 자리표시자). */
export const DEMO_PANELS: Panel[] = [
  {
    id: "system",
    title: "SYSTEM STATUS",
    priority: 90,
    lines: [
      { label: "CPU", value: "32%" },
      { label: "MEMORY", value: "6.1 / 16 GB" },
      { label: "NETWORK", value: "ONLINE" },
    ],
  },
  {
    id: "weather",
    title: "WEATHER",
    priority: 60,
    lines: [
      { label: "SEOUL", value: "24°C" },
      { label: "STATUS", value: "CLEAR" },
      { label: "HUMIDITY", value: "48%" },
    ],
  },
  {
    id: "clock",
    title: "TIME",
    priority: 40,
    lines: [
      { label: "LOCAL", value: "—" },
      { label: "ZONE", value: "KST +09:00" },
    ],
  },
];
