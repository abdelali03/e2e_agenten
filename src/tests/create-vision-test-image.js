const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  await page.goto(
    "file:///C:/Users/AAmine/Documents/ai-test-agent/public/vision-test.html"
  );
  await page.screenshot({ path: "C:/tmp/ai-test-agent-vision-test.png" });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
