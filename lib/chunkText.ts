const normalizeParagraphs = (text: string): string[] =>
  text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export const chunkText = (text: string, maxChars = 12000): string[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const paragraphs = normalizeParagraphs(trimmed);
  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
    }
  };

  for (const paragraph of paragraphs) {
    if (!current) {
      if (paragraph.length <= maxChars) {
        current = paragraph;
        continue;
      }
    }

    if ((current + "\n\n" + paragraph).length <= maxChars) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }

    pushCurrent();

    if (paragraph.length <= maxChars) {
      current = paragraph;
    } else {
      for (let start = 0; start < paragraph.length; start += maxChars) {
        chunks.push(paragraph.slice(start, start + maxChars).trim());
      }
    }
  }

  pushCurrent();

  return chunks;
};
