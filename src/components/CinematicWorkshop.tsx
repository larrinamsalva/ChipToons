import type { SceneryDepth } from "../art-model";
import { workshopLayerTransform } from "../cinematic-workshop";
import type { GroundShadow } from "../cinematic-workshop";
import type { CameraValues } from "../animation-model";

export function WorkshopDepthDefs({ prefix }: { prefix: string }) {
  return <>
    <linearGradient id={`${prefix}-workshop-wood`} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
      <stop stopColor="#916848" /><stop offset=".25" stopColor="#c3a07b" />
      <stop offset=".7" stopColor="#b68c62" /><stop offset="1" stopColor="#76533d" />
    </linearGradient>
    <linearGradient id={`${prefix}-workshop-edge`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop stopColor="#b88d61" /><stop offset="1" stopColor="#604938" />
    </linearGradient>
    <radialGradient id={`${prefix}-workshop-contact`}>
      <stop offset="0" stopColor="#30261f" stopOpacity=".62" />
      <stop offset=".42" stopColor="#30261f" stopOpacity=".36" />
      <stop offset="1" stopColor="#30261f" stopOpacity="0" />
    </radialGradient>
  </>;
}

export function WorkshopDepthLayer({ depth, camera, calm, prefix }: {
  depth: SceneryDepth; camera: CameraValues; calm: boolean; prefix: string;
}) {
  return <g data-workshop-depth={depth} transform={workshopLayerTransform(depth, camera, calm)}
    pointerEvents="none" aria-hidden="true">
    {depth === "behind" && <>
      <path d="M0 0H800V25H0Z" fill={`url(#${prefix}-workshop-wood)`} />
      <path d="M0 25H47L60 287H0ZM760 25H800V287H747Z" fill={`url(#${prefix}-workshop-wood)`} />
      <path d="M47 25H54L67 287H60ZM740 25H747L760 287H753Z" fill="#fff6db" opacity=".24" />
      <rect x="88" y="63" width="270" height="181" rx="12" fill="#72513c" opacity=".2" />
      <path d="M498 50H705V241L696 250H499Z" fill="#6a5c4c" opacity=".17" />
      <path d="M64 266H746V284H64Z" fill="#aa815d" opacity=".4" />
      <path d="M64 267H746" stroke="#fff7dc" strokeWidth="3" opacity=".55" />
    </>}
    {depth === "alongside" && <>
      <path d="M0 290H800V299H0Z" fill="#684d39" opacity=".22" />
      <path d="M0 299H800" stroke="#fff0cd" strokeWidth="2" opacity=".4" />
      <g fill="none" stroke="#71513d" strokeWidth="1.4" opacity=".17">
        <path d="M305 299L139 450M365 299L306 450M432 299L486 450M495 299L662 450M553 299L800 424M249 299L0 424" />
        <path d="M0 330H800M0 377H800M0 441H800" />
      </g>
      <path d="M0 300H800V316Q398 301 0 319Z" fill="#f6d7a5" opacity=".13" />
    </>}
    {depth === "front" && <>
      <path d="M-50 443Q94 421 174 454H-50ZM667 457Q745 421 850 441V490H667Z"
        fill="#4d3c30" opacity=".16" />
      <path d="M-35 447L49 431L78 446V491H-35ZM749 442L814 429L844 447V491H749Z"
        fill={`url(#${prefix}-workshop-edge)`} />
      <path d="M-35 447L49 431L78 446L-7 461ZM749 442L814 429L844 447L780 460Z"
        fill="#d4ad7f" />
      <path d="M49 435L76 448M752 445L779 460" stroke="#f0d0a2" strokeWidth="2" opacity=".6" />
    </>}
  </g>;
}

export function WorkshopGrounding({ shadows, prefix, offset, elementId }: {
  shadows: GroundShadow[]; prefix: string; offset: { x: number; y: number }; elementId: string;
}) {
  if (!shadows.length) return null;
  return <g data-ground-shadow={elementId} pointerEvents="none" aria-hidden="true">
    {shadows.map(shadow => <ellipse key={shadow.id} data-shadow-contact={shadow.id}
      cx={shadow.x + offset.x} cy={shadow.y + offset.y} rx={shadow.rx} ry={shadow.ry}
      fill={`url(#${prefix}-workshop-contact)`} opacity={shadow.opacity} />)}
  </g>;
}
