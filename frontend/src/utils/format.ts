const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T12:00:00`));
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) {
    return formatDate(start);
  }

  return `${formatDate(start)} — ${formatDate(end)}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTimeFormatter.format(date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-MX").format(value);
}

export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1_048_576) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1_048_576).toFixed(1)} MB`;
}
