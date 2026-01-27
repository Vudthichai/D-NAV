import test from "node:test";
import assert from "node:assert/strict";

import { normalizePdfText } from "../lib/pdf/normalizePdfText";
import type { RawPdfPage } from "../lib/pdf/extractPdfText";

test("normalizePdfText removes repeated headers/footers and dehyphenates wraps", () => {
  const pages: RawPdfPage[] = [
    {
      page: 1,
      lines: ["D-NAV Quarterly Update", "Page 1", "We will manu-", "facturing ramp in Q1 2025.", "Footer"],
    },
    {
      page: 2,
      lines: ["D-NAV Quarterly Update", "Page 2", "Operations update begins.", "Footer"],
    },
  ];

  const result = normalizePdfText(pages);
  const pageOneText = result.pages[0].text;

  assert.ok(!pageOneText.includes("D-NAV Quarterly Update"));
  assert.ok(!pageOneText.includes("Page 1"));
  assert.ok(pageOneText.includes("manufacturing ramp in Q1 2025."));
});
