import { expect, type Page } from "@playwright/test";

/** Draws polylines given in the 200×200 glyph grid onto the tracing canvas with the mouse. */
export async function drawOnBoard(page: Page, strokes: [number, number][][]) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("No tracing canvas");
  const at = ([gx, gy]: [number, number]) => [box.x + (gx / 200) * box.width, box.y + (gy / 200) * box.height] as const;
  for (const pts of strokes) {
    await page.mouse.move(...at(pts[0]));
    await page.mouse.down();
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      for (let t = 1; t <= 10; t++) await page.mouse.move(...at([x0 + ((x1 - x0) * t) / 10, y0 + ((y1 - y0) * t) / 10]));
    }
    await page.mouse.up();
  }
}

export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // Dev-only framework insights are not app errors.
    if (m.type() === "error" && !/Next\.js encountered|instant navigation|Download the React DevTools/i.test(m.text())) errors.push(m.text());
  });
  return {
    expectNone: () => expect(errors, errors.join("\n")).toEqual([]),
  };
}
