import { test } from "vitest";
import { writeFileSync } from "node:fs";
import { stagePoint } from "./interaction-motion";
import { cameraAt, sceneFramesAt } from "./timeline";
import { transformExample } from "./transform-examples";
import { visualTeachingExample } from "./focus-examples";

test("local diagnostic", () => {
  const expected = visualTeachingExample(transformExample("wagon"), "wagon");
  const [repair] = expected.scenes;
  const wagon = repair.elements.find(item => item.prop === "toy-wagon")!;
  writeFileSync("/tmp/ct18-points.json",JSON.stringify([8, 8.2, 8.4, 8.5, 8.65, 8.8, 8.85, 8.9, 8.92, 9.0, 9.6, 9.77, 9.9, 10, 10.1, 10.25].map(at => {
    const frame = sceneFramesAt(expected, repair, at).get(wagon.id)!;
    const camera = cameraAt(repair, at);
    return [at, ...[[61, -6], [33, -11]].map(([x, y]) => {
      const point = stagePoint(wagon, frame, { x, y });
      return [400 + (point.x - camera.x) * camera.zoom, 225 + (point.y - camera.y) * camera.zoom];
    })];
  })));
});
