export type UnitLabels = { singular: string; plural: string };

const DEFAULT_SINGULAR = "decision";

export function getUnitLabels(raw?: string | null): UnitLabels {
  const trimmed = raw?.trim();
  const singular = trimmed && trimmed.length > 0 ? trimmed : DEFAULT_SINGULAR;
  return { singular, plural: buildPluralLabel(singular) };
}

export function formatUnitCount(count: number, raw?: string | null): string {
  const labels = getUnitLabels(raw);
  const isSingular = Math.abs(count) === 1;
  return `${count} ${isSingular ? labels.singular : labels.plural}`;
}

export function buildRangeLabel(start: number, end: number, raw?: string | null): string {
  const labels = getUnitLabels(raw);
  const capitalized = capitalize(labels.singular);
  return `${capitalized} ${start}–${end}`;
}

function buildPluralLabel(label: string): string {
  const words = label.split(" ");
  const lastWord = words.pop();
  if (!lastWord) return `${DEFAULT_SINGULAR}s`;

  if (lastWord.toLowerCase().endsWith("s")) {
    words.push(lastWord);
    return words.join(" ");
  }

  words.push(`${lastWord}s`);
  return words.join(" ");
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
