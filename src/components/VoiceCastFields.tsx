import { VOICE_FIELDS } from "../script-model";
import type { VoiceNotes } from "../script-model";

export function VoiceCastFields({ notes, onChange }: {
  notes?: VoiceNotes; onChange: (next: VoiceNotes) => void;
}) {
  return <details className="director-voice-notes">
    <summary>Voice cast notes</summary>
    <p>Use notes you choose to enter for your own performers and voices.</p>
    <div className="form-grid">
      {(Object.entries(VOICE_FIELDS) as [keyof VoiceNotes, string][]).map(([key, label]) =>
        <label key={key}>{label}
          <input type="text" maxLength={300} value={notes?.[key] ?? ""}
            onChange={event => onChange({ ...notes, [key]: event.target.value })} />
        </label>)}
    </div>
  </details>;
}
