import type { PropAppearance } from "../transform-model";
import { SceneryArt } from "./SceneryArt";
import type { Background, Asset } from "../model";
import type { Crop, PropName } from "../art-model";

export function RasterArt({
  asset,
  width = 190,
  height = 245,
  crop,
  cover = false,
}: {
  asset: Asset;
  width?: number;
  height?: number;
  crop?: Crop;
  cover?: boolean;
}) {
  const c = crop ?? { left: 0, top: 0, width: 1, height: 1 };
  const sw = asset.sourceWidth ?? 1000;
  const sh = asset.sourceHeight ?? 1000;
  if (
    !asset.sourceWidth &&
    c.left === 0 &&
    c.top === 0 &&
    c.width === 1 &&
    c.height === 1
  )
    return (
      <image
        href={asset.dataUrl}
        x={-width / 2}
        y={-height}
        width={width}
        height={height}
        preserveAspectRatio={cover ? "xMidYMid slice" : "xMidYMax meet"}
      />
    );
  return (
    <svg
      x={-width / 2}
      y={-height}
      width={width}
      height={height}
      viewBox={`${c.left * sw} ${c.top * sh} ${c.width * sw} ${c.height * sh}`}
      preserveAspectRatio={cover ? "xMidYMid slice" : "xMidYMax meet"}
      overflow="hidden"
    >
      <image
        href={asset.dataUrl}
        width={sw}
        height={sh}
        preserveAspectRatio="none"
      />
    </svg>
  );
}
export function PropArt({
  name,
  openness = 0,
  appearance,
}: {
  name: PropName;
  openness?: number;
  appearance?: PropAppearance;
}) {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {name === "chair" ? (
        <g fill="#bd9065" stroke="#866847" strokeWidth="5">
          <path d="M-39-7v-97h12v55h58v42M-34-106h65v49h-65Z" />
          <path d="M-35-44h74v14h-74Z" />
          <path d="M27-30v23" />
        </g>
      ) : name === "table" ? (
        <g fill="#cb9d67" stroke="#8e6c4e" strokeWidth="5">
          <path d="M-56-68H56v15H-56Z" />
          <path d="M-44-52v49m88-49V-3" />
          {appearance === "messy" && <g strokeWidth="3">
            <path d="M-49-69l5-18 26 3-4 16z" fill="#f8e1ab" />
            <path d="M-3-69l3-22 20 3 4 19z" fill="#aa9ad3" />
            <path d="M29-69l9-13 11 8-5 7z" fill="#e7a78f" />
            <path d="M-18-72h8m36 4h5" stroke="#746963" />
          </g>}
        </g>
      ) : name === "book" ? (
        <g>
          <path
            d="M-50-70q28-13 50 0 22-13 50 0v65q-28-13-50 0-22-13-50 0Z"
            fill="#fff4d9"
            stroke="#7d86b8"
            strokeWidth="7"
          />
          <path
            d="M0-68v61m-39-43 29 1m-29 13 29 1m21-15 28-2m-28 16 28-2"
            stroke="#9e9ab6"
            strokeWidth="3"
          />
        </g>
      ) : name === "flower" ? (
        <g>
          <path
            d="M0-8v-58m0 41c-32 0-35-21-35-21s29-2 35 21m0-10c30 0 33-22 33-22S9-59 0-35"
            fill="#82b88d"
            stroke="#5d9b70"
            strokeWidth="4"
          />
          <g fill="#efab8b">
            <ellipse cy="-80" rx="13" ry="21" />
            <ellipse cx="-21" cy="-62" rx="21" ry="13" />
            <ellipse cx="21" cy="-62" rx="21" ry="13" />
            <ellipse cy="-44" rx="13" ry="21" />
          </g>
          <circle cy="-62" r="13" fill="#edc966" />
        </g>
      ) : name === "tree" ? (
        <g>
          <path d="M-9 0v-104H9V0" fill="#a37b59" />
          <path
            d="M-62-75c-42-30-14-83 14-76 7-48 83-48 93 0 38-10 67 53 22 76-19 29-50 23-65 13-23 15-50 9-64-13"
            fill="#81b28e"
          />
          <circle cx="-25" cy="-118" r="7" fill="#efb87a" />
          <circle cx="29" cy="-99" r="7" fill="#efb87a" />
        </g>
      ) : name === "toy" ? (
        <g>
          <circle
            cy="-47"
            r="43"
            fill="#e9b95c"
            stroke="#fff3d5"
            strokeWidth="5"
          />
          <path
            d="M-37-66q36 27 75 0M-38-27q37-25 76 0M0-89v84"
            fill="none"
            stroke="#c8785a"
            strokeWidth="7"
          />
        </g>
      ) : name === "door" ? (
        <g>
          <path
            d="M-42 0v-154h84V0Z"
            fill="#535d7b"
            stroke="#fff6e5"
            strokeWidth="9"
          />
          <g
            transform={`translate(-42 0) scale(${1 - openness * 0.85} 1) translate(42 0)`}
          >
            <path
              d="M-42 0v-154h84V0Z"
              fill="#aeb6d0"
              stroke="#fff6e5"
              strokeWidth="4"
            />
            <rect
              x="-28"
              y="-137"
              width="56"
              height="67"
              rx="5"
              fill="#d4e6db"
            />
            <circle cx="24" cy="-52" r="5" fill="#f0d38c" />
          </g>
        </g>
      ) : name === "sign" ? (
        <g>
          <path d="M-5 0v-85H5V0" fill="#a27b58" />
          <path
            d="M-65-133H65v59H-65Z"
            fill="#fff3cf"
            stroke="#b29563"
            strokeWidth="5"
          />
          <path
            d="M-42-105H33m-13-13 14 13-14 13"
            stroke="#6f9d89"
            strokeWidth="7"
            fill="none"
          />
        </g>
      ) : <SceneryArt name={name} appearance={appearance} />}
    </g>
  );
}
export function BackgroundArt({ background }: { background: Background }) {
  if (["meadow", "playground", "classroom", "moonlight"].includes(background))
    return null;
  const indoor = background === "bedroom";
  const beach = background === "beach";
  const magical = background === "magical";
  return (
    <g>
      <rect
        width="800"
        height="450"
        fill={indoor ? "#e4dbee" : magical ? "#d9d4ef" : "#d2e9e4"}
      />
      <rect
        y="285"
        width="800"
        height="165"
        fill={beach ? "#efdbac" : indoor ? "#c5b29e" : "#a9c994"}
      />
      {!indoor && (
        <>
          <circle cx="675" cy="70" r="33" fill="#f3d080" />
          <path d="M110 74q0-35 32-27 17-26 39-8 34-4 37 35Z" fill="#f4f8e9" />
        </>
      )}
      {background === "house" && (
        <g>
          <path d="M65 275V142l142-92 142 92v133Z" fill="#f3d1ae" />
          <path
            d="m45 146 162-110 162 110"
            stroke="#c4866e"
            strokeWidth="24"
            fill="none"
          />
          <rect x="165" y="184" width="75" height="92" rx="5" fill="#a3b1ce" />
          <rect
            x="93"
            y="165"
            width="45"
            height="44"
            fill="#dae9da"
            stroke="#fff3df"
            strokeWidth="7"
          />
          <rect
            x="270"
            y="165"
            width="45"
            height="44"
            fill="#dae9da"
            stroke="#fff3df"
            strokeWidth="7"
          />
          <path d="M0 301h800" stroke="#f0e7cf" strokeWidth="8" />
        </g>
      )}
      {indoor && (
        <g>
          <rect
            x="70"
            y="46"
            width="165"
            height="170"
            rx="5"
            fill="#c2dae4"
            stroke="#fff7e8"
            strokeWidth="12"
          />
          <path d="M150 46v170m-80-85h165" stroke="#fff7e8" strokeWidth="8" />
          <path
            d="M470 278V158h244v120"
            stroke="#a18778"
            strokeWidth="13"
            fill="#f1d0c0"
          />
          <path d="M465 213h258v71H465Z" fill="#b6b4d7" />
          <rect x="487" y="175" width="79" height="37" rx="14" fill="#fff1df" />
          <ellipse cx="365" cy="364" rx="235" ry="57" fill="#d3c2d4" />
          <path
            d="m393 55 11 24 26 3-20 19 5 28-22-13-23 13 5-28-20-19 27-3Z"
            fill="#e3bd70"
          />
        </g>
      )}
      {(background === "forest" || background === "garden") && (
        <g>
          {[80, 207, 626, 754].map((x, i) => (
            <g
              key={x}
              transform={`translate(${x} ${background === "forest" ? 300 : 270}) scale(${background === "forest" ? 0.95 : 0.62})`}
            >
              <PropArt name="tree" />
              {i % 2 === 0 && <circle cx="18" cy="-126" r="5" fill="#e8b99e" />}
            </g>
          ))}
          {background === "garden" &&
            [75, 155, 620, 710].map((x) => (
              <g key={x} transform={`translate(${x} 365) scale(.55)`}>
                <PropArt name="flower" />
              </g>
            ))}
        </g>
      )}
      {beach && (
        <g>
          <path d="M0 180h800v143q-210-35-412 0T0 323Z" fill="#91c8ca" />
          <path
            d="M0 292q194-24 390 0t410-5"
            stroke="#eef5e1"
            strokeWidth="8"
            fill="none"
          />
          <path d="M149 335V170" stroke="#b69671" strokeWidth="7" />
          <path d="M47 183q101-170 202 0Z" fill="#e4a88d" />
          <path d="M149 183V71" stroke="#f4dbb4" strokeWidth="8" />
        </g>
      )}
      {background === "town" && (
        <g>
          {[40, 230, 455, 650].map((x, i) => (
            <g key={x}>
              <rect
                x={x}
                y={105 + (i % 2) * 30}
                width="140"
                height={180 - (i % 2) * 30}
                rx="5"
                fill={["#d6b6a0", "#c8c1db", "#a7c4b9", "#e7c991"][i]}
              />
              {[0, 1].map((j) => (
                <rect
                  key={j}
                  x={x + 20 + j * 62}
                  y={135 + (i % 2) * 30}
                  width="38"
                  height="50"
                  rx="4"
                  fill="#e6eee2"
                />
              ))}
            </g>
          ))}
          <rect y="288" width="800" height="162" fill="#c8c8bf" />
          <path
            d="M0 355h800"
            stroke="#f5ead0"
            strokeWidth="6"
            strokeDasharray="45 30"
          />
        </g>
      )}
      {magical && (
        <g>
          <path
            d="M0 280Q160 150 300 280q190-160 500-40v210H0Z"
            fill="#acb8cc"
          />
          <path d="M0 350q250-130 500 50L800 300v150H0Z" fill="#c9b8db" />
          {[100, 260, 570, 710].map((x, i) => (
            <g key={x} transform={`translate(${x} ${220 + (i % 2) * 50})`}>
              <path d="M-8 70V0H8v70" fill="#c292a4" />
              <path d="M-50 5Q0-80 50 5Z" fill="#efe0ad" />
              <circle cx="-10" cy="-15" r="7" fill="#f9eddd" />
            </g>
          ))}
          {[110, 310, 475, 605].map((x) => (
            <path
              key={x}
              d={`m${x} 80 5 14 14 5-14 5-5 14-5-14-14-5 14-5Z`}
              fill="#fff0bf"
            />
          ))}
        </g>
      )}
    </g>
  );
}
