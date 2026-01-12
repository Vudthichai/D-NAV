import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

export const runtime = "nodejs";

const PDF_MARGIN = "0.5in";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const buildOrigin = (request: NextRequest) => {
  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (proto && host) {
    return `${proto}://${host}`;
  }
  return request.nextUrl.origin;
};

const buildPrintUrl = (request: NextRequest) => {
  const origin = buildOrigin(request);
  const printUrl = new URL("/reports/print", origin);
  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.set("render", "pdf");
  printUrl.search = params.toString();
  return printUrl.toString();
};

const buildFilename = (searchParams: URLSearchParams) => {
  const timeframe = searchParams.get("window") ?? "all";
  const dataset = searchParams.get("dataset");
  const parts = ["dnav-report", dataset, timeframe].filter(Boolean).map((part) => slugify(part as string));
  return `${parts.join("-")}.pdf`;
};

export async function GET(request: NextRequest) {
  const printUrl = buildPrintUrl(request);
  const filename = buildFilename(request.nextUrl.searchParams);
  let browser: Awaited<ReturnType<typeof playwrightChromium.launch>> | null = null;

  try {
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(printUrl, { waitUntil: "networkidle" });
    await page.waitForSelector(".report-print-page");
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(150);

    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: PDF_MARGIN,
        right: PDF_MARGIN,
        bottom: PDF_MARGIN,
        left: PDF_MARGIN,
      },
      scale: 1,
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to render report PDF", error);
    return NextResponse.json({ error: "Failed to render report PDF" }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
