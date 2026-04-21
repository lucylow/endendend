import open from "open";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/open-browser.mjs <url>");
  process.exit(1);
}

await open(url);
