/**
 * Picture key → emoji used as the source artwork. scripts/fetch-pictures.ts downloads
 * the matching Noto Emoji SVG (Apache 2.0) into /public/pictures so pictures look the
 * same on every device. "custom" entries are drawn in-repo (scripts/custom-pictures).
 */
export const PICTURE_SOURCES: Record<string, string> = {
  apple: "🍎", ant: "🐜", ball: "⚽", banana: "🍌", bird: "🐦", cat: "🐈", cow: "🐄", cup: "☕",
  dog: "🐕", duck: "🦆", door: "🚪", egg: "🥚", elephant: "🐘", fish: "🐟", flower: "🌸",
  goat: "🐐", grapes: "🍇", gift: "🎁", hat: "🎩", hen: "🐔", horse: "🐎", insect: "🐞",
  "ice-cream": "🍦", juice: "🧃", jeans: "👖", kite: "🪁", key: "🔑", king: "👑", lion: "🦁",
  leaf: "🍃", lamp: "🪔", monkey: "🐒", moon: "🌙", milk: "🥛", nest: "🪺", nose: "👃",
  octopus: "🐙", orange: "🍊", pen: "🖊️", pig: "🐖", parrot: "🦜", queen: "👸", question: "❓",
  rabbit: "🐇", rain: "🌧️", ring: "💍", sun: "☀️", star: "⭐", sock: "🧦", tiger: "🐯",
  tree: "🌳", tap: "🚰", umbrella: "☂️", unicorn: "🦄", van: "🚐", violin: "🎻", watch: "⌚",
  watermelon: "🍉", window: "🪟", box: "📦", "x-ray": "🩻", "yo-yo": "🪀", yarn: "🧶",
  yellow: "🟡", zebra: "🦓", zero: "0️⃣",
  pomegranate: "custom", mango: "🥭", potato: "🥔", rainbow: "🌈", engine: "🚂", brick: "🧱",
  sugarcane: "custom", owl: "🦉", finger: "☝️", camel: "🐪", one: "1️⃣", glasses: "👓",
  dew: "💧", tools: "🛠️", woman: "👩", pigeon: "🕊️", lotus: "🪷", toy: "🧸", house: "🏠",
  clock: "⏰", spoon: "🥄", lizard: "🦎", ship: "🚢", shoe: "👟", tomato: "🍅", cap: "🧢",
};

export function pictureUrl(key: string): string {
  return `/pictures/${key}.svg`;
}
