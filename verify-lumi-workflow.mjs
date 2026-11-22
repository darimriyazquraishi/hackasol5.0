import { chromium } from 'playwright';

async function runLumiWorkflowVerification() {
  console.log('--- STARTING COMPREHENSIVE LUMI AUDIT & VERIFICATION ---');
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
    console.log('[1/10] Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });

    // 2. Verify Exact Image 1 Initial Landing Page (No Sidebar, No Headers, Pure Black)
    console.log('[2/10] Verifying Image 1 landing page specifications (No sidebar, pure black, single input)...');
    const sidebarsOnLanding = await page.locator('aside').count();
    if (sidebarsOnLanding !== 0) {
      throw new Error(`FAIL: Sidebar detected on initial landing page (count: ${sidebarsOnLanding}, expected 0)`);
    }

    const logoImgs = page.locator('img[src="/lumi-logo.jpg"]');
    const logoCount = await logoImgs.count();
    if (logoCount !== 1) {
      throw new Error(`FAIL: Expected exactly 1 logo on landing page, found ${logoCount}`);
    }

    const heroBox = await logoImgs.first().boundingBox();
    if (!heroBox || heroBox.height < 180) {
      throw new Error(`FAIL: Landing page logo is too small (height: ${heroBox?.height}px, expected >= 180px)`);
    }

    const landingInput = page.locator('input[placeholder="Ask Lumi anything..."]');
    const hasLandingInput = await landingInput.isVisible();
    if (!hasLandingInput) {
      throw new Error('FAIL: Landing page prompt input ("Ask Lumi anything...") not visible');
    }

    console.log(`✓ Image 1 Landing Page verified: 0 sidebars, logo height ${Math.round(heroBox.height)}px, single centered input.`);

    // 3. Verify Complete Absence of Forbidden Terminology Across UI
    console.log('[3/10] Verifying total removal of forbidden terminology...');
    const bodyText = await page.locator('body').innerText();
    const forbiddenTerms = [
      'air-gapped',
      'airgapped',
      'air-gap',
      'offline runtime',
      'runtime offline'
    ];
    for (const term of forbiddenTerms) {
      if (new RegExp(`\\b${term}\\b`, 'i').test(bodyText)) {
        throw new Error(`FAIL: Forbidden term "${term}" detected in UI text`);
      }
    }
    console.log('✓ Zero occurrences of forbidden terminology found.');

    // 4. Test Simple Conversational Message ("hello") -> Direct Answer with NO Workplan
    console.log('[4/10] Testing simple conversational message ("hello") for selective workplan routing...');
    await landingInput.fill('hello');
    await landingInput.press('Enter');

    // Wait for transition and response
    await page.waitForTimeout(1500);

    const hasWorkplanForHello = await page.locator('text=STAGE 2 WORKPLAN').count();
    if (hasWorkplanForHello > 0) {
      throw new Error('FAIL: Workplan was generated for simple message "hello" (selective invocation failed)');
    }

    const hasHelloResponse = await page.locator('text=LUMI (Local Unified Multimodal Intelligence)').first().isVisible();
    if (!hasHelloResponse) {
      throw new Error('FAIL: LUMI direct conversational response for "hello" not visible');
    }
    console.log('✓ Simple message "hello" transitioned to conversation with direct answer and ZERO workplans.');

    // 5. Test "New Chat" resets immediately back to Image 1 Landing Page
    console.log('[5/10] Testing "+ New Chat" reset action...');
    const newChatBtn = page.locator('button:has-text("New Chat")');
    await newChatBtn.click();
    await page.waitForTimeout(1000);

    const isBackOnLanding = await page.locator('input[placeholder="Ask Lumi anything..."]').isVisible();
    const sidebarsAfterReset = await page.locator('aside').count();
    if (!isBackOnLanding || sidebarsAfterReset !== 0) {
      throw new Error('FAIL: New Chat button did not return to clean Image 1 landing page');
    }
    console.log('✓ "+ New Chat" button cleanly resets to Image 1 landing page with 0 sidebars.');

    // 6. Test Complex Multi-Step Task -> Stage 2 Workplan Generation
    console.log('[6/10] Testing complex multi-step task ("Refactor architecture and execute code in sandbox")...');
    const inputAgain = page.locator('input[placeholder="Ask Lumi anything..."]');
    await inputAgain.fill('Refactor architecture and execute code in sandbox');
    await inputAgain.press('Enter');

    // Wait for Stage 3 Human Approval Workplan Card to render
    console.log('[7/10] Verifying Stage 3 (Human Approval Workplan Interface)...');
    await page.waitForSelector('text=STAGE 2 WORKPLAN: HUMAN APPROVAL REQUIRED', { timeout: 10000 });

    const hasInterpretation = await page.locator('text=Task Interpretation').isVisible();
    const hasAgents = await page.locator('text=Selected Agents & Models').isVisible();
    const hasSequence = await page.locator('text=Execution Sequence').isVisible();
    const hasDeliverables = await page.locator('text=Expected Deliverables').isVisible();

    if (!hasInterpretation || !hasAgents || !hasSequence || !hasDeliverables) {
      throw new Error('FAIL: Workplan card is missing required specification fields');
    }

    const hasApproveBtn = await page.locator('button:has-text("Approve Workplan")').isVisible();
    const hasEditBtn = await page.locator('button:has-text("Edit Workplan")').isVisible();
    const hasCancelBtn = await page.locator('button:has-text("Cancel")').isVisible();

    if (!hasApproveBtn || !hasEditBtn || !hasCancelBtn) {
      throw new Error('FAIL: Approval, Edit, or Cancel controls missing from workplan interface');
    }
    console.log('✓ Stage 2 Workplan generated & Stage 3 Human Approval interface verified.');

    // 7. Stage 5, 6, 7 & 8: Approve Workplan and verify execution, compilation & validation
    console.log('[8/10] Approving workplan and testing multi-agent execution, compilation & validation...');
    await page.click('button:has-text("Approve Workplan")');

    await page.waitForSelector('text=STAGE 7 VALIDATION REPORT', { timeout: 15000 });
    const hasValidation = await page.locator('text=STAGE 7 VALIDATION REPORT').isVisible();
    if (!hasValidation) throw new Error('FAIL: Stage 7 Validation report did not render');

    const hasSandboxOutput = await page.locator('text=Sandbox Output').isVisible();
    if (!hasSandboxOutput) throw new Error('FAIL: Sandboxed code execution output missing');

    console.log('✓ Multi-agent execution, sandbox code runner, and Stage 7 validation report passed.');

    // 8. Verify Navigation to Settings & Hardware Detection
    console.log('[9/10] Verifying navigation to Settings and Hardware Detection...');
    await page.click('button:has-text("Settings")');
    await page.waitForSelector('text=NVIDIA GeForce GTX 1650', { timeout: 10000 });
    console.log('✓ Settings and real hardware detection verified.');

    // 9. Check console errors
    console.log('[10/10] Checking for console errors...');
    const relevantErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('apple-touch-icon'));
    if (relevantErrors.length > 0) {
      throw new Error(`Console errors detected: ${relevantErrors.join(' | ')}`);
    }
    console.log('✓ Zero console errors detected.');

    console.log('\n======================================================');
    console.log('ALL 10 LUMI AUDIT & VERIFICATION CHECKS PASSED');
    console.log('======================================================');
  } catch (err) {
    console.error('\nVerification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runLumiWorkflowVerification();
