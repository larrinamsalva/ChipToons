import type { DrawObject, DrawingDocument } from "./art-model";
export function paintDrawing(
  ctx: CanvasRenderingContext2D,
  doc: DrawingDocument,
  selected?: string,
) {
  ctx.clearRect(0, 0, 600, 400);
  for (const o of doc.objects) {
    ctx.save();
    ctx.translate(o.x + o.width / 2, o.y + o.height / 2);
    ctx.rotate((o.rotation * Math.PI) / 180);
    ctx.translate(-o.width / 2, -o.height / 2);
    ctx.globalCompositeOperation = o.eraser ? "destination-out" : "source-over";
    ctx.strokeStyle = o.stroke;
    ctx.fillStyle = o.fill === "transparent" ? "transparent" : o.fill;
    ctx.lineWidth = o.lineWidth;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath();
    if (o.kind === "stroke") {
      o.points.forEach((p, i) =>
        i
          ? ctx.lineTo(p.x * o.width, p.y * o.height)
          : ctx.moveTo(p.x * o.width, p.y * o.height),
      );
      if (o.points.length === 1) {
        ctx.arc(o.width / 2, o.height / 2, o.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = o.stroke;
        ctx.fill();
      } else ctx.stroke();
    } else {
      if (o.kind === "rectangle") ctx.rect(0, 0, o.width, o.height);
      else if (o.kind === "circle" || o.kind === "ellipse")
        ctx.ellipse(
          o.width / 2,
          o.height / 2,
          o.width / 2,
          o.height / 2,
          0,
          0,
          Math.PI * 2,
        );
      else if (o.kind === "line") {
        ctx.moveTo(0, 0);
        ctx.lineTo(o.width, o.height);
      } else {
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          const r = i % 2 ? 0.43 : 1;
          const x = o.width / 2 + ((Math.cos(a) * o.width) / 2) * r;
          const y = o.height / 2 + ((Math.sin(a) * o.height) / 2) * r;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.closePath();
      }
      if (o.fill !== "transparent" && o.kind !== "line") ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  const o = doc.objects.find((o) => o.id === selected);
  if (o) {
    ctx.save();
    ctx.translate(o.x + o.width / 2, o.y + o.height / 2);
    ctx.rotate((o.rotation * Math.PI) / 180);
    ctx.strokeStyle = "#346bba";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(
      -o.width / 2 - 5,
      -o.height / 2 - 5,
      o.width + 10,
      o.height + 10,
    );
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.fillRect(o.width / 2 - 5, o.height / 2 - 5, 10, 10);
    ctx.strokeRect(o.width / 2 - 5, o.height / 2 - 5, 10, 10);
    ctx.restore();
  }
}
export function hitDrawing(o: DrawObject, x: number, y: number) {
  const a = (-o.rotation * Math.PI) / 180;
  const dx = x - o.x - o.width / 2;
  const dy = y - o.y - o.height / 2;
  return (
    Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) <= o.width / 2 + 10 &&
    Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) <= o.height / 2 + 10
  );
}
