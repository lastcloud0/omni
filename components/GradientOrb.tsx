"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type GradientOrbConfig = {
  background?: string;
  hue?: number;
  rotationSpeed?: number;
  noiseScale?: number;
  innerRadius?: number;
};

const defaults: Required<GradientOrbConfig> = {
  background: "#00000000",
  hue: 0,
  rotationSpeed: 0.3,
  noiseScale: 0.65,
  innerRadius: 0.1,
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// 원본 셰이더 + iAudio(음성 레벨) uniform 추가 → 말할 때 밝기·크기 반응.
const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float iTime;
  uniform vec3 iResolution;
  uniform float hue;
  uniform float rot;
  uniform float noiseScale;
  uniform float innerRadius;
  uniform float iAudio;
  varying vec2 vUv;

  vec3 rgb2yiq(vec3 c){return vec3(dot(c,vec3(0.299,0.587,0.114)),dot(c,vec3(0.596,-0.274,-0.322)),dot(c,vec3(0.211,-0.523,0.312)));}
  vec3 yiq2rgb(vec3 c){return vec3(c.x+0.956*c.y+0.621*c.z,c.x-0.272*c.y-0.647*c.z,c.x-1.106*c.y+1.703*c.z);}
  vec3 adjustHue(vec3 color,float hueDeg){float r=radians(hueDeg);vec3 y=rgb2yiq(color);float ca=cos(r),sa=sin(r);y.yz=vec2(y.y*ca-y.z*sa,y.y*sa+y.z*ca);return yiq2rgb(y);}

  vec3 hash33(vec3 p3){p3=fract(p3*vec3(0.1031,0.11369,0.13787));p3+=dot(p3,p3.yxz+19.19);return -1.0+2.0*fract(vec3(p3.x+p3.y,p3.x+p3.z,p3.y+p3.z)*p3.zyx);}
  float snoise3(vec3 p){const float K1=0.333333333;const float K2=0.166666667;vec3 i=floor(p+(p.x+p.y+p.z)*K1);vec3 d0=p-(i-(i.x+i.y+i.z)*K2);vec3 e=step(vec3(0.0),d0-d0.yzx);vec3 i1=e*(1.0-e.zxy);vec3 i2=1.0-e.zxy*(1.0-e);vec3 d1=d0-(i1-K2);vec3 d2=d0-(i2-K1);vec3 d3=d0-0.5;vec4 h=max(0.6-vec4(dot(d0,d0),dot(d1,d1),dot(d2,d2),dot(d3,d3)),0.0);vec4 n=h*h*h*h*vec4(dot(d0,hash33(i)),dot(d1,hash33(i+i1)),dot(d2,hash33(i+i2)),dot(d3,hash33(i+1.0)));return dot(vec4(31.316),n);}

  vec4 extractAlpha(vec3 c){float a=max(max(c.r,c.g),c.b);return vec4(c.rgb/(a+1e-5),a);}
  const vec3 baseColor0=vec3(0.239,0.353,1.0);
  const vec3 baseColor1=vec3(0.616,0.0,1.0);
  const vec3 baseColor2=vec3(1.0,0.373,0.122);
  const vec3 baseColor3=vec3(0.0,0.0,0.0);
  float light1(float i,float a,float d){return i/(1.0+d*a);}
  float light2(float i,float a,float d){return i/(1.0+d*d*a);}

  vec4 draw(vec2 uv){
    vec3 color0=adjustHue(baseColor0,hue);
    vec3 color1=adjustHue(baseColor1,hue);
    vec3 color2=adjustHue(baseColor2,hue);
    vec3 color3=adjustHue(baseColor3,hue);
    float len=length(uv);
    float invLen=len>0.0?1.0/len:0.0;
    // 음성 레벨이 맥동을 키움
    float pulse=sin(iTime*1.5)*0.02 + iAudio*0.12;
    float n0=snoise3(vec3(uv*noiseScale,iTime*0.5))*0.5+0.5;
    float r0=mix(mix(innerRadius+pulse,1.0,0.4),mix(innerRadius+pulse,1.0,0.6),n0);
    float d0=distance(uv,(r0*invLen)*uv);
    float v0=light1(1.0,10.0,d0);
    v0*=smoothstep(r0*1.05,r0,len);
    float cl=cos(atan(uv.y,uv.x)+iTime*2.0)*0.5+0.5;
    float a=iTime*-1.0;
    vec2 pos=vec2(cos(a),sin(a))*r0;
    float d=distance(uv,pos);
    float v1=light2(1.5,5.0,d);
    v1*=light1(1.0,50.0,d0);
    float v2=smoothstep(1.0,mix(innerRadius,1.0,n0*0.5),len);
    float v3=smoothstep(innerRadius,mix(innerRadius,1.0,0.5),len);
    vec3 col=mix(color1,color2,cl);
    col=mix(col,color0,n0);
    col=mix(color3,col,v0);
    col=(col+v1)*v2*v3;
    col*=1.0+iAudio*0.5; // 말할 때 더 밝게
    col=clamp(col,0.0,1.0);
    return extractAlpha(col);
  }

  void main(){
    vec2 center=iResolution.xy*0.5;
    float size=min(iResolution.x,iResolution.y);
    vec2 uv=(vUv*iResolution.xy-center)/size*2.0;
    float s=sin(rot),c=cos(rot);
    uv=vec2(c*uv.x-s*uv.y,s*uv.x+c*uv.y);
    vec4 col=draw(uv);
    gl_FragColor=vec4(col.rgb*col.a,col.a);
  }
`;

function GradientScene({
  config,
  audioRef,
}: {
  config: Required<GradientOrbConfig>;
  audioRef?: React.MutableRefObject<number>;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size, viewport } = useThree();
  const rotRef = useRef(0);
  const lastTimeRef = useRef(0);
  const audioSmooth = useRef(0);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector3(size.width, size.height, 1) },
      hue: { value: config.hue },
      rot: { value: 0 },
      noiseScale: { value: config.noiseScale },
      innerRadius: { value: config.innerRadius },
      iAudio: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config]
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    const t = state.clock.elapsedTime;
    const dt = t - lastTimeRef.current;
    lastTimeRef.current = t;
    rotRef.current += dt * config.rotationSpeed;
    const target = audioRef?.current ?? 0;
    audioSmooth.current += (target - audioSmooth.current) * 0.2;
    const u = materialRef.current.uniforms;
    u.iTime.value = t;
    u.hue.value = config.hue;
    u.rot.value = rotRef.current;
    u.iAudio.value = audioSmooth.current;
    u.iResolution.value.set(size.width * viewport.dpr, size.height * viewport.dpr, size.width / size.height);
  });

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

export function GradientOrb({
  config: configOverrides,
  className = "",
  audioRef,
}: {
  config?: GradientOrbConfig;
  className?: string;
  /** 0..1 음성 레벨 — 오브 맥동/밝기 반응. */
  audioRef?: React.MutableRefObject<number>;
}) {
  const configKey = JSON.stringify(configOverrides);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const config = useMemo(() => ({ ...defaults, ...configOverrides }), [configKey]);

  return (
    <div className={`h-full w-full ${className}`}>
      <Canvas gl={{ antialias: true, alpha: true }}>
        <GradientScene config={config} audioRef={audioRef} />
      </Canvas>
    </div>
  );
}

export default GradientOrb;
