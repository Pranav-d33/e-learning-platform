// Downloads Noto Emoji SVGs (Apache 2.0, github.com/googlefonts/noto-emoji) for every
// picture key, and copies in-repo custom drawings. Run: npm run assets:pictures
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PICTURE_SOURCES } from "../src/lib/early/pictures";

const OUT = path.join(process.cwd(), "public", "pictures");
const CUSTOM = path.join(process.cwd(), "scripts", "custom-pictures");
const BASE = "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/svg";

function notoName(emoji: string): string {
  const cps = [...emoji].map((c) => c.codePointAt(0)!).filter((cp) => cp !== 0xfe0f);
  return `emoji_u${cps.map((cp) => cp.toString(16).padStart(4, "0")).join("_")}.svg`;
}

await mkdir(OUT, { recursive: true });
const failures: string[] = [];
await Promise.all(
  Object.entries(PICTURE_SOURCES).map(async ([key, emoji]) => {
    const dest = path.join(OUT, `${key}.svg`);
    if (emoji === "custom") return copyFile(path.join(CUSTOM, `${key}.svg`), dest);
    const res = await fetch(`${BASE}/${notoName(emoji)}`);
    if (!res.ok) return void failures.push(`${key} (${notoName(emoji)}: HTTP ${res.status})`);
    await writeFile(dest, await res.text());
  }),
);
if (failures.length) {
  console.error("Missing pictures:\n" + failures.join("\n"));
  process.exit(1);
}
console.log(`Wrote ${Object.keys(PICTURE_SOURCES).length} pictures to public/pictures`);
