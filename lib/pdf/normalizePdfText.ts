const BULLET_LINE = /^([\-•*]|\d+[\).])\s+/;
const HEADING_LINE = /^[A-Z0-9][A-Z0-9\s\-:]{3,}$/;

const shouldJoinLine = (previous: string, next: string): boolean => {
  if (!previous) return false;
  if (BULLET_LINE.test(next)) return false;
  if (HEADING_LINE.test(previous) && previous.length < 60) return false;
  if (/[.!?]$/.test(previous)) return false;
  if (/[:;]$/.test(previous)) return false;
  if (/\)$/.test(previous)) return false;
  if (/^\d{1,2}\/$/.test(previous)) return false;
  return /^[a-z(]/.test(next);
};

export function normalizePdfText(raw: string): string {
  const sanitized = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \f\v]+/g, " ");

  const dehyphenated = sanitized.replace(/(\w)-\n(\w)/g, "$1$2");
  const lines = dehyphenated.split("\n");
  const merged: string[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (merged.length > 0 && merged[merged.length - 1] !== "") {
        merged.push("");
      }
      return;
    }

    if (merged.length === 0) {
      merged.push(trimmed);
      return;
    }

    const previous = merged[merged.length - 1];
    if (shouldJoinLine(previous, trimmed)) {
      merged[merged.length - 1] = `${previous} ${trimmed}`.replace(/\s{2,}/g, " ");
      return;
    }

    merged.push(trimmed);
  });

  return merged.join("\n").replace(/\n{2,}/g, "\n").trim();
}
