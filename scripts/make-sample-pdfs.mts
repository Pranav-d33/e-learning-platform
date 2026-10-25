// Builds public/samples/*.pdf from the original demo reader text, so reviewers can test
// the real upload → extraction path. Run: npm run assets:samples
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DEMO_PAGES } from "../src/lib/tutor/demo-textbook";

const OUT = path.join(process.cwd(), "public", "samples");
const [W, H] = [420, 595]; // A5 portrait
const MARGIN = 42;

async function readerPdf() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Sunny Steps — Class 1 English Reader (demo sample)");
  pdf.setAuthor("AI Learning Platform prototype — original demo content");
  const body = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const { page: n, text } of DEMO_PAGES) {
    const page = pdf.addPage([W, H]);
    let y = H - MARGIN;
    const lines = text.split("\n");
    lines.forEach((raw, i) => {
      const heading = i < 2 && raw.trim().length > 0 && n > 1 ? true : i === 0;
      const font = heading ? bold : body;
      const size = heading ? (i === 0 ? 15 : 13) : 11;
      if (!raw.trim()) {
        y -= size * 0.9;
        return;
      }
      // greedy word wrap
      let line = "";
      for (const word of raw.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > W - MARGIN * 2) {
          page.drawText(line, { x: MARGIN, y, size, font });
          y -= size * 1.45;
          line = word;
        } else line = next;
      }
      if (line) {
        page.drawText(line, { x: MARGIN, y, size, font });
        y -= size * 1.45;
      }
    });
    page.drawText(String(n), { x: W / 2 - 3, y: 22, size: 9, font: body, color: rgb(0.4, 0.4, 0.4) });
  }
  return pdf.save();
}

/** Image-only pages (no text layer) — exercises the "looks scanned" error path. */
async function scannedPdf() {
  const pdf = await PDFDocument.create();
  for (let p = 0; p < 2; p++) {
    const page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.96, 0.95, 0.92) });
    for (let i = 0; i < 22; i++) {
      const width = 220 + ((i * 37) % 110);
      page.drawRectangle({ x: MARGIN, y: H - 70 - i * 22, width, height: 7, color: rgb(0.25, 0.25, 0.25), opacity: 0.55 });
    }
  }
  return pdf.save();
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "sunny-steps-demo-reader.pdf"), await readerPdf());
await writeFile(path.join(OUT, "scanned-sample.pdf"), await scannedPdf());
console.log("Wrote public/samples/sunny-steps-demo-reader.pdf and scanned-sample.pdf");
