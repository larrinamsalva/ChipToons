export function MediaNumber({
  label,
  value,
  min = 0,
  max,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        key={value}
        aria-label={label}
        type="number"
        defaultValue={Number(value.toFixed(3))}
        min={min}
        max={max}
        step={step}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (!e.target.value || !Number.isFinite(n) || n < min || n > max) {
            e.target.value = String(value);
            return;
          }
          if (n !== value) onChange(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = String(value);
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
