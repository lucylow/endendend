import open from "open";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/open-browser.mjs <url>");
  process.exit(1);
}

try {
  await open(url);
} catch (err) {
  console.error("Failed to open browser:", err instanceof Error ? err.message : err);
  process.exit(1);
}
