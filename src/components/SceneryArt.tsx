import type { PropName } from "../art-model";
import type { PropAppearance } from "../transform-model";

export function SceneryArt({ name, appearance }: { name: PropName; appearance?: PropAppearance }) {
  switch (name) {
    case "slide": return <g strokeWidth="6">
      <path d="M-62-4l18-111m-2 76h26m-23-23h27m-24-23h28" fill="none" stroke="#497a89" />
      <path d="M-27-115c25 0 41 17 49 50C31-24 47-13 81-11v10C33 0 9-12-2-57c-6-28-12-41-31-41z" fill="#f1b365" stroke="#ac6355" />
      <path d="M-45-113v-22q0-14 14-14h22q13 0 13 13v17" fill="none" stroke="#477d81" />
      <path d="M-20-106q26 5 37 48" fill="none" stroke="#ffe3a4" strokeWidth="4" />
    </g>;
    case "swing-set": return <g>
      <path d="M-79-4l28-133h101L79-4m-134-130h110" fill="none" stroke="#4d767f" strokeWidth="9" />
      <path d="M-36-132v85m25-85v85m22-85v85m25-85v85" fill="none" stroke="#59637b" strokeWidth="3" />
      <rect x="-43" y="-49" width="39" height="12" rx="5" fill="#eda76f" />
      <rect x="4" y="-49" width="39" height="12" rx="5" fill="#e4c16b" />
      <circle cx="-51" cy="-137" r="7" fill="#a7d0c0" /><circle cx="50" cy="-137" r="7" fill="#a7d0c0" />
    </g>;
    case "bench": return <g stroke="#785d59" strokeWidth="5">
      <path d="M-55-34l-5 31m116-31 5 31m-112-47v-25m102 25v-25" fill="none" />
      <rect x="-62" y="-75" width="124" height="29" rx="7" fill="#e7b181" />
      <path d="M-57-60h114" stroke="#a66e59" strokeWidth="3" />
      <rect x="-68" y="-43" width="136" height="15" rx="7" fill="#bd8b6f" />
    </g>;
    case "flower-pot": return <g>
      {appearance === "seed" ? <ellipse cy="-52" rx="6" ry="3.5" fill="#87634d" /> :
        appearance === "sprout" ? <path d="M0-46v-23m0 8q-18 0-20-12 14-2 20 12m0 0q7-19 20-13-4 12-20 13"
          stroke="#50865d" fill="#a4c77c" strokeWidth="3" /> :
          <path d="M1-39v-51m0 29q-33 0-37-22 26-1 37 22m0-3q24-24 39-16-5 24-39 22" fill="#8ab887" stroke="#5b8b72" strokeWidth="4" /> }
      <path d="M-29-44h58L19-3h-38z" fill="#d48d70" stroke="#a26061" strokeWidth="4" />
      <rect x="-34" y="-49" width="68" height="12" rx="5" fill="#f1b392" />
      {appearance !== "seed" && appearance !== "sprout" && <>
        <circle cx="1" cy="-91" r="15" fill="#e8a7b5" /><circle cx="1" cy="-91" r="7" fill="#f8de8f" />
      </>}
    </g>;
    case "garden-bed": return <g>
      <path d="M-69-37l20-27h100l18 27v26l-138 2z" fill="#ba8267" stroke="#8a6251" strokeWidth="4" />
      <path d="M-59-39l14-19h92l13 19z" fill="#8b635b" />
      <path d="M-39-46v-18m39 18v-26m39 26v-18" fill="none" stroke="#5b966f" strokeWidth="5" />
      <path d="M-39-60q-17-6-18-17 17 0 18 17 16-6 19-16-17 0-19 16M0-66q-17-3-20-16 17-1 20 16 14-7 17-18-17 2-17 18m39 9q-15-6-17-17 15 0 17 17 13-5 16-16-14 0-16 16" fill="#8ec491" />
      <path d="M-61-25h122" stroke="#e2b68a" strokeWidth="4" />
    </g>;
    case "watering-can": return <g stroke="#547a86" strokeWidth="5">
      <path d="M22-47q39-30 38 3-1 25-33 19M-22-33L-56-62l-12 10 42 42" fill="#a9ced0" />
      <rect x="-34" y="-54" width="71" height="52" rx="17" fill="#79b4ba" />
      <path d="M-59-61l-13 13m50-1h48" stroke="#cfebe1" />
      <circle cx="0" cy="-28" r="9" fill="#f3d58a" stroke="none" />
    </g>;
    case "toy-wagon": return <g stroke="#895e65" strokeWidth="5">
      <path d="M50-19l31-43 17 9" fill="none" />
      <rect x="-58" y="-52" width="115" height="36" rx="9" fill={appearance ? "#cc5c86" : "#db8e84"} />
      <path d="M-47-39h95" stroke="#f4c9ab" />
      <circle cx="-33" cy="-11" r="11" fill="#556581" />
      {appearance === "loose-wheel" ? <>
        <circle cx="33" cy="-15" r="5" fill="#f4cf83" stroke="none" />
        <ellipse cx="61" cy="-6" rx="9" ry="12" transform="rotate(-24 61 -6)" fill="#556581" />
        <path d="M53-26l5-5m9 8 8-3" stroke="#fff3c7" strokeWidth="4" />
      </> : <circle cx="33" cy="-11" r="11" fill="#556581" />}
      {appearance === "fixed-wheel" && <circle cx="33" cy="-11" r="3.5" fill="#f4cf83" stroke="none" />}
    </g>;
    case "shelf": return <g stroke="#8c6561" strokeWidth="5">
      <rect x="-53" y="-135" width="106" height="132" rx="9" fill="#d6a780" />
      <path d="M-45-123h90v104h-90z" fill="#aa775f" stroke="none" />
      <path d="M-47-86h94m-94 37h94m-94 34h94" stroke="#f2cb9b" />
      {appearance === "messy" ? <>
        <path d="M-40-105l23 10m1-19 15 15m14 4 27-9M-38-52l26-8m11-12 13 15m4-4 22 4"
          stroke="#f4d193" strokeWidth="8" />
        <circle cx="20" cy="-30" r="10" fill="#96c1b2" stroke="none" />
      </> : <>
        <path d="M-32-91v-25m12 25v-25m13 25v-18m-24 53v-20m15 20v-21" stroke="#91beb3" />
        <path d="M24-90v-25M3-56l9-20m20 20v-20" stroke="#efd18d" />
      </>}
      <rect x="-31" y="-41" width="63" height="19" rx="4" fill="#ca918a" stroke="none" />
    </g>;
    case "paper-bridge": return <g stroke="#6f5c8a" strokeWidth="4">
      <path d="M-75-5l10-31 31 8 10 23zM24-5l10-23 31-8 10 31z" fill="#b9a4da" />
      {appearance === "unfinished" ? <path d="M-71-34l42-17 13 13-39 12m87 0 39-8"
        stroke="#b07557" strokeWidth="7" fill="none" /> : <>
        <path d="M-72-35l17-17H55l17 17-17 12H-55z" fill="#f4c787" />
        <path d="M-56-34H56M-44-48v8m22-8v8m22-8v8m22-8v8m22-8v8" stroke="#b07557" strokeWidth="2" />
      </>}
    </g>;
    case "toolbox": return <g stroke="#805d6a" strokeWidth="5">
      <path d="M-17-50v-16h34v16" fill="none" />
      <rect x="-53" y="-52" width="106" height="49" rx="9" fill="#a388b1" />
      <path d="M-50-30h100" stroke="#755f88" />
      <rect x="-11" y="-35" width="22" height="14" rx="4" fill="#f0cf8b" stroke="none" />
    </g>;
    case "traffic-sign": return <g>
      <path d="M0 0v-115" stroke="#6a7084" strokeWidth="9" />
      <path d="M0-145l37 36-37 36-37-36z" fill="#f2ce7b" stroke="#9c7960" strokeWidth="5" />
      <path d="M-15-109h30m-15-15v30" stroke="#766077" strokeWidth="5" />
    </g>;
    case "picnic-basket": return <g stroke="#996a59" strokeWidth="5">
      <path d="M-30-42v-9q0-31 30-31t30 31v9" fill="none" />
      <path d="M-50-39h100L36-4h-72z" fill="#e2ad7b" />
      <path d="M-41-22h82m-61-13 7 27m23-27-7 27" stroke="#b98461" strokeWidth="3" />
      <rect x="-54" y="-47" width="108" height="13" rx="5" fill="#f4cd94" />
    </g>;
    case "recycling-bin": return <g>
      <path d="M-33-71h66L27-4h-54z" fill="#81ac96" stroke="#547e73" strokeWidth="5" />
      <rect x="-39" y="-81" width="78" height="15" rx="6" fill="#608e85" />
      <path d="M-7-46l8-10 9 13m5 6 6 13H6m-7 0h-14l6-12" fill="none" stroke="#f8ecca" strokeWidth="4" />
    </g>;
    default: return null;
  }
}
