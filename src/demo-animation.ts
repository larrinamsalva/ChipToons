import type { Project, SceneElement } from "./model";
import { uid } from "./model";
import type { ElementValues, ElementKeyframe } from "./animation-model";
import { elementBase } from "./timeline";

// Original silent inclusion story. Creation allocates IDs; sampling is pure.
export function animateInclusion(project: Project) {
  project.scenes.forEach((scene, index) => {
    function act(
      element: SceneElement,
      moments: [number, Partial<ElementValues>][],
    ) {
      const base = elementBase(element);
      const keyframes: ElementKeyframe[] = moments.map(([time, patch]) => ({
        ...base,
        ...patch,
        id: uid(),
        time,
        easing: "ease-in-out",
      }));
      element.animation = { keyframes, blink: true, idle: "breathe" };
      // Explicit tracks take precedence; retain the old preset in the base data.
    }
    const [pip, sunny] = scene.elements;
    if (!pip || !sunny) return;
    if (index === 0) {
      act(pip, [
        [0, { heart: "warm", heartStrength: 0.2 }],
        [
          2,
          {
            emotion: "surprised",
            pose: "pointing",
            heart: "warm",
            heartStrength: 0.3,
          },
        ],
        [4, { emotion: "worried", pose: "standing", mouth: "talking" }],
        [
          7,
          {
            emotion: "calm",
            mouth: "smile",
            heart: "calm",
            heartStrength: 0.4,
          },
        ],
        [10, { emotion: "calm", heart: "calm", heartStrength: 0.4 }],
      ]);
      act(sunny, [
        [0, { emotion: "happy" }],
        [2, { emotion: "sad", heart: "sad", heartStrength: 0.25 }],
        [6, { emotion: "sad", heart: "sad", heartStrength: 0.25 }],
        [10, { emotion: "sad", heart: "sad", heartStrength: 0.25 }],
      ]);
    } else if (index === 1) {
      act(pip, [
        [0, { pose: "standing", emotion: "worried" }],
        [
          1,
          {
            pose: "walking",
            gesture: "walk",
            emotion: "calm",
            heart: "warm",
            heartStrength: 0.3,
          },
        ],
        [
          5,
          {
            x: 440,
            pose: "standing",
            gesture: "none",
            mouth: "smile",
            emotion: "happy",
            heart: "helping",
            heartStrength: 0.7,
          },
        ],
        [
          7,
          {
            x: 440,
            pose: "waving",
            gesture: "wave",
            mouth: "talking",
            emotion: "happy",
            heart: "helping",
            heartStrength: 0.8,
          },
        ],
        [
          10,
          {
            x: 440,
            pose: "standing",
            mouth: "smile",
            emotion: "happy",
            heart: "warm",
            heartStrength: 0.7,
          },
        ],
      ]);
      act(sunny, [
        [0, { emotion: "sad", heart: "sad", heartStrength: 0.2 }],
        [4, { emotion: "sad", heart: "sad", heartStrength: 0.2 }],
        [
          7,
          {
            emotion: "surprised",
            mouth: "open",
            heart: "warm",
            heartStrength: 0.4,
          },
        ],
        [
          10,
          {
            emotion: "happy",
            mouth: "smile",
            heart: "warm",
            heartStrength: 0.6,
          },
        ],
      ]);
      scene.cameraAnimation = {
        keyframes: [
          { id: uid(), time: 0, x: 400, y: 225, zoom: 1, easing: "linear" },
          {
            id: uid(),
            time: 6,
            x: 475,
            y: 240,
            zoom: 1.2,
            easing: "ease-in-out",
          },
          {
            id: uid(),
            time: 10,
            x: 450,
            y: 235,
            zoom: 1.1,
            easing: "ease-in-out",
          },
        ],
      };
    } else if (index === 2) {
      act(pip, [
        [
          0,
          {
            x: 390,
            pose: "waving",
            gesture: "wave",
            mouth: "smile",
            heart: "calm",
            heartStrength: 0.3,
          },
        ],
        [
          3,
          {
            x: 390,
            pose: "pointing",
            mouth: "talking",
            heart: "helping",
            heartStrength: 0.65,
          },
        ],
        [
          7,
          {
            x: 390,
            pose: "standing",
            emotion: "happy",
            mouth: "smile",
            heart: "together",
            heartStrength: 0.85,
          },
        ],
        [
          10,
          { x: 390, emotion: "happy", heart: "together", heartStrength: 0.85 },
        ],
      ]);
      act(sunny, [
        [0, { emotion: "sad", heart: "sad", heartStrength: 0.2 }],
        [
          3,
          {
            emotion: "calm",
            mouth: "talking",
            heart: "calm",
            heartStrength: 0.45,
          },
        ],
        [
          7,
          {
            emotion: "happy",
            mouth: "smile",
            heart: "together",
            heartStrength: 0.85,
          },
        ],
        [10, { emotion: "happy", heart: "together", heartStrength: 0.85 }],
      ]);
    } else {
      [pip, sunny].forEach((element, i) =>
        act(element, [
          [
            0,
            {
              emotion: "happy",
              mouth: "smile",
              heart: "together",
              heartStrength: 0.4,
            },
          ],
          [
            2,
            {
              y: element.y - 18,
              rotation: i ? 6 : -6,
              emotion: "excited",
              pose: "waving",
              gesture: "wave",
              heart: "together",
              heartStrength: 0.7,
            },
          ],
          [
            4,
            {
              emotion: "excited",
              mouth: "talking",
              heart: "helping",
              heartStrength: 0.85,
            },
          ],
          [
            6,
            {
              y: element.y - 12,
              rotation: i ? -5 : 5,
              emotion: "happy",
              heart: "together",
              heartStrength: 0.9,
            },
          ],
          [
            scene.duration,
            {
              emotion: "happy",
              mouth: "smile",
              heart: "warm",
              heartStrength: 0.65,
            },
          ],
        ]),
      );
    }
    if (index === 0 || index === 4)
      scene.backgroundAnimation = {
        enabled: true,
        style: "drift",
        keyframes: [],
      };
  });
}
