function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildTimeOptions(min, max, stepMinutes) {
  const start = timeToMinutes(min);
  const end = timeToMinutes(max);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) return [];

  const options = [];
  for (let cursor = start; cursor <= end; cursor += stepMinutes) {
    options.push(minutesToTime(cursor));
  }
  return options;
}

export default function TimeSelect({
  value,
  onChange,
  min = "00:00",
  max = "23:45",
  stepMinutes = 15,
  className = "",
  "data-testid": testId,
  required = false,
  disabled = false,
}) {
  const options = buildTimeOptions(min, max, stepMinutes);
  const safeOptions = value && !options.includes(value) ? [...options, value].sort() : options;

  return (
    <select
      required={required}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      data-testid={testId}
      className={className}
    >
      {safeOptions.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}
