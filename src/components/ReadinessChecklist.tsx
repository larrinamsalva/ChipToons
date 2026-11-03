import { useEffect, useState } from "react";
import { productionReadiness } from "../readiness";
import type { ReadinessIssue } from "../readiness";
import type { Project } from "../model";
export function ReadinessChecklist({
  project,
  limit,
  supported,
  saveStatus,
  onReview,
}: {
  project: Project;
  limit: number;
  supported: boolean;
  saveStatus: string;
  onReview: (issue: ReadinessIssue) => void;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]),
    [low, setLow] = useState(false),
    issues = productionReadiness(project, limit, supported),
    shown = issues.filter((i) => !dismissed.includes(i.id));
  useEffect(() => {
    let alive = true;
    void navigator.storage
      ?.estimate?.()
      .then((s) => {
        if (alive)
          setLow(!!s.quota && s.quota - (s.usage ?? 0) < 15 * 1024 * 1024);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section
      className="readiness-checklist"
      aria-label="Production readiness checklist"
    >
      <h3>A quick check before your movie</h3>
      <ul className="readiness-summary">
        <li>
          {issues.some((i) => i.id.startsWith("limit:"))
            ? "Review whole-scene export limits"
            : "✓ Whole-scene segment plan"}
        </li>
        <li>
          {supported ? "✓ Browser encoder available" : "Review browser support"}
        </li>
        <li>
          {saveStatus === "Saved on this device"
            ? "✓ Local save complete"
            : `Local save: ${saveStatus}`}
        </li>
        <li>
          {issues.some((i) => i.blocking)
            ? "Review the items that need attention below"
            : "✓ No blocking content problems found"}
        </li>
      </ul>
      {(low || saveStatus === "Save failed") && (
        <p className="media-notice" role="status">
          Storage may be full or running low. Download a portable project before
          adding media or closing the studio. Retry local saving from the
          editor.
        </p>
      )}
      <details open={issues.some((i) => i.blocking)}>
        <summary>
          {shown.length
            ? `${shown.length} suggestions to review`
            : "Suggestions reviewed"}
        </summary>
        <ul className="readiness-items">
          {shown.map((i) => (
            <li key={i.id}>
              <strong>
                {i.title}
                {i.blocking ? " · needs attention" : " · optional"}
              </strong>
              <p>{i.detail}</p>
              <div className="animation-actions">
                <button
                  className="button secondary small"
                  onClick={() => onReview(i)}
                >
                  {i.action === "browser" || i.action === "backup"
                    ? "Download portable backup"
                    : `Review ${i.sceneIndex === undefined ? i.action : `scene ${i.sceneIndex + 1}`}`}
                </button>
                {!i.blocking && (
                  <button
                    className="button text small"
                    onClick={() => setDismissed((d) => [...d, i.id])}
                  >
                    Keep my choice
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </details>
      {dismissed.length > 0 && (
        <button className="button text small" onClick={() => setDismissed([])}>
          Show reviewed suggestions
        </button>
      )}
    </section>
  );
}
