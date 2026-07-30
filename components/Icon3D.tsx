"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

/**
 * SVG를 실제 3D로 압출(extrude)해 천천히 회전·부유시키는 아이콘.
 * 지금 있는 /icon-*.svg 를 그대로 입체화한다.
 *
 * ★ 나중에 glb 모델을 받으면: 이 파일의 <Extruded>만 <primitive object={gltf.scene}>로
 *   교체하면 됨 (호출부 MiniOrb는 그대로).
 */
function Extruded({ url, color }: { url: string; color: string }) {
  const data = useLoader(SVGLoader, url);
  const spin = useRef<THREE.Group>(null);

  const { geometries, offset, scale } = useMemo(() => {
    const geos: THREE.ExtrudeGeometry[] = [];
    const box = new THREE.Box3();
    for (const path of data.paths) {
      const shapes = SVGLoader.createShapes(path);
      for (const shape of shapes) {
        const g = new THREE.ExtrudeGeometry(shape, {
          depth: 4,
          bevelEnabled: true,
          bevelThickness: 0.9,
          bevelSize: 0.6,
          bevelSegments: 2,
        });
        g.computeBoundingBox();
        if (g.boundingBox) box.union(g.boundingBox);
        geos.push(g);
      }
    }
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    // XY 기준 정규화(깊이 제외) → 프레임을 꽉 채우되 비율 유지.
    const maxDim = Math.max(size.x, size.y) || 1;
    return { geometries: geos, offset: center, scale: 2.35 / maxDim };
  }, [data]);

  useFrame((state) => {
    if (!spin.current) return;
    const t = state.clock.elapsedTime;
    // 완전 회전(X)은 평면 아이콘이 옆에서 사라짐 → 좌우 스웨이로 항상 정면 향하며 3D 흔들림.
    spin.current.rotation.y = Math.sin(t * 0.9) * 0.5; // ±0.5rad(~28°) 스웨이
    spin.current.rotation.x = Math.sin(t * 0.7) * 0.12; // 살짝 끄덕
    spin.current.position.y = Math.sin(t * 1.2) * 0.06; // 부유 bob
  });

  return (
    <group ref={spin}>
      {/* SVG는 y가 아래로 증가 → y 뒤집고, 중심 정렬 + 스케일 */}
      <group scale={[scale, -scale, scale]} position={[-offset.x * scale, offset.y * scale, 0]}>
        {geometries.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.35}
              metalness={0.45}
              roughness={0.28}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

interface Props {
  src: string;
  color?: string;
  size?: number;
}

export function Icon3D({ src, color = "#a9b6ff", size = 64 }: Props) {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 30, near: 0.1, far: 100 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 4, 5]} intensity={1.7} />
        <directionalLight position={[-4, -2, 2]} intensity={0.6} color="#7f82ff" />
        <Suspense fallback={null}>
          <Extruded url={src} color={color} />
        </Suspense>
      </Canvas>
    </div>
  );
}
