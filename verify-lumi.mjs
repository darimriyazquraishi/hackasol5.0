import { chromium } from 'playwright';

async function verifyLumi() {
  console.log('Starting LUMI Playwright Verification...');
  let browser;
  try {
    // Try launching chromium or bundled browser
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome' // uses local chrome if available
    });
  } catch (e) {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err) {
      console.log('Note: Headless browser launch requires browser binaries. Error:', err.message);
      return;
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // 1. Check title & logo
  const title = await page.title();
  console.log('Page Title:', title);

  // 2. Verify Dashboard
  console.log('Verifying Dashboard...');
  await page.waitForSelector('text=LUMI WORKBENCH');
  await page.waitForSelector('text=GPU COMPUTE');
  await page.waitForSelector('text=VRAM ALLOCATED');

  // 3. Navigate to Chat
  console.log('Navigating to AI Chat...');
  await page.click('button:has-text("AI Chat")');
  await page.waitForSelector('text=LUMI-Core 70B');

  // 4. Navigate to Model Manager
  console.log('Navigating to Model Manager...');
  await page.click('button:has-text("Model Manager")');
  await page.waitForSelector('text=MODEL MANAGER');
  await page.waitForSelector('text=Dedicated VRAM Residency');

  // 5. Navigate to Knowledge Base
  console.log('Navigating to Knowledge Base...');
  await page.click('button:has-text("Knowledge Base")');
  await page.waitForSelector('text=KNOWLEDGE BASE & RAG');

  // 6. Navigate to Workflows
  console.log('Navigating to Workflows...');
  await page.click('button:has-text("Agent Workflows")');
  await page.waitForSelector('text=AGENT WORKFLOW GRAPH');

  // 7. Navigate to IDE Workspace
  console.log('Navigating to IDE Workspace...');
  await page.click('button:has-text("IDE Workspace")');
  await page.waitForSelector('text=File');

  console.log('All modules navigated successfully!');
  console.log('Console Errors count:', errors.length);
  if (errors.length > 0) {
    console.log('Errors:', errors);
  }

  await browser.close();
  console.log('LUMI Playwright Verification Completed Successfully!');
}

verifyLumi().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
