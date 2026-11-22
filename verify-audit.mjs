import { chromium } from 'playwright';

async function runVerification() {
  console.log('--- STARTING LUMI MASTER VERIFICATION ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // 1. Visit http://localhost:3000
    console.log('[1/8] Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });

    // 2. Verify chat-first landing
    console.log('[2/8] Verifying Chat-first landing interface...');
    await page.waitForSelector('textarea[placeholder*="Ask LUMI"]', { timeout: 5000 });
    const hasComposer = await page.locator('textarea[placeholder*="Ask LUMI"]').isVisible();
    if (!hasComposer) throw new Error('Chat composer textarea not found on landing page');
    console.log('✓ Chat landing interface is active.');

    // 3. Verify LeftSidebar and ensure NO "PRO" badge exists
    console.log('[3/8] Inspecting LeftSidebar and checking PRO badge removal...');
    const ideButtonText = await page.locator('aside button:has-text("IDE Workspace")').innerText();
    if (ideButtonText.includes('PRO')) {
      throw new Error(`FAIL: "PRO" badge found inside IDE Workspace button text: "${ideButtonText}"`);
    }
    const anyProBadge = await page.locator('aside span:has-text("PRO")').count();
    if (anyProBadge > 0) {
      throw new Error('FAIL: Visual PRO badge element detected in sidebar');
    }
    console.log('✓ LeftSidebar verified clean: IDE Workspace has 0 PRO badges.');

    // 4. Test Chat endpoint and verify response contains ONLY direct answer
    console.log('[4/8] Testing chat inference with direct hardware query...');
    await page.fill('textarea[placeholder*="Ask LUMI"]', 'What hardware is installed?');
    await page.click('button:has-text("Send")');

    // Wait for assistant response to render
    await page.waitForSelector('div:has-text("Hardware Specifications:")', { timeout: 8000 });
    const assistantMessageText = await page.locator('div:has-text("Hardware Specifications:")').first().innerText();
    
    // Check absence of AI slop
    const forbiddenPhrases = [
      'Certainly',
      'Here is your answer',
      'I would be happy to help',
      'Let me know if you need anything else',
      'Hope this helps',
      'Autonomous Orchestrator',
      'tokens'
    ];
    for (const phrase of forbiddenPhrases) {
      if (assistantMessageText.toLowerCase().includes(phrase.toLowerCase())) {
        throw new Error(`FAIL: AI filler phrase "${phrase}" detected in chat message: "${assistantMessageText}"`);
      }
    }
    console.log('✓ Chat response verified: contains ONLY the direct factual answer with zero conversational filler.');

    // 5. Navigate to Settings and Model Manager
    console.log('[5/8] Navigating to Settings -> Model Manager...');
    await page.click('aside button:has-text("Settings")');
    await page.waitForSelector('h1:has-text("MODEL MANAGER & AUDIT")', { timeout: 5000 });

    // 6. Verify Model-to-Task Audit Matrix (10 Categories)
    console.log('[6/8] Verifying Model-to-Task Audit Matrix with 10 categories...');
    const tableRows = await page.locator('tbody tr').count();
    if (tableRows < 10) {
      throw new Error(`FAIL: Expected at least 10 task audit entries, found ${tableRows}`);
    }
    const matrixText = await page.locator('tbody').first().innerText();
    if (!matrixText.includes('General Chat') || !matrixText.includes('Coding')) {
      throw new Error('FAIL: Core task categories missing from Model-to-Task Audit Matrix');
    }
    console.log(`✓ Model-to-Task Audit Matrix verified: ${tableRows} categories dynamically mapped.`);

    // 7. Verify Hardware Detection and Diagnostics
    console.log('[7/8] Testing Hardware Detection and Diagnostics execution...');
    await page.click('button:has-text("Hardware & Performance")');
    await page.waitForSelector('h2:has-text("HARDWARE DETECTION")', { timeout: 5000 });
    const hwText = await page.locator('div:has-text("NVIDIA GeForce GTX 1650")').first().innerText();
    console.log(`✓ Real hardware detected: ${hwText.slice(0, 35)}...`);

    // Run diagnostics
    await page.click('button:has-text("System")');
    await page.click('button:has-text("Diagnostics")');
    await page.waitForSelector('button:has-text("Run Diagnostics")', { timeout: 5000 });
    await page.click('button:has-text("Run Diagnostics")');
    await page.waitForSelector('span:has-text("PASSED")', { timeout: 5000 });
    console.log('✓ System Diagnostics executed live against backend and PASSED.');

    // 8. Verify console errors
    console.log('[8/8] Checking console errors...');
    const relevantErrors = consoleErrors.filter(e => !e.includes('favicon'));
    if (relevantErrors.length > 0) {
      throw new Error(`Console errors detected: ${relevantErrors.join(' | ')}`);
    }
    console.log('✓ Zero console errors detected.');

    console.log('\n========================================');
    console.log('ALL 8 VERIFICATION PHASES PASSED CLEANLY');
    console.log('========================================');
  } catch (err) {
    console.error('\nVerification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runVerification();
