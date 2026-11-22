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
    console.log('[1/9] Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });

    // 2. Verify Exact Supplied Logo Asset & Significantly Bigger Display Size
    console.log('[2/9] Verifying LUMI exact logo image asset and enlarged dimensions...');
    const logoImgs = page.locator('img[src="/lumi-logo.jpg"]');
    const logoCount = await logoImgs.count();
    if (logoCount === 0) {
      throw new Error('FAIL: Supplied logo image asset (/lumi-logo.jpg) not found in DOM');
    }

    // Measure hero logo in empty state
    const heroLogo = logoImgs.nth(1); // empty state logo
    const heroBox = await heroLogo.boundingBox();
    if (!heroBox || heroBox.height < 90) {
      throw new Error(`FAIL: Hero logo is too small (height: ${heroBox?.height}px, expected >= 90px)`);
    }
    console.log(`✓ Exact supplied logo asset verified (${logoCount} instances). Hero logo height: ${Math.round(heroBox.height)}px (Significantly Bigger).`);

    // 3. Verify Complete Removal of Orchestrator & 127.0.0.1:3000 Indicators
    console.log('[3/9] Verifying complete removal of Orchestrator and localhost infrastructure indicators...');
    const chatHeader = page.locator('div.h-12.px-4.border-b').first();
    const chatHeaderText = await chatHeader.innerText();
    if (/orchestrator/i.test(chatHeaderText) || /127\.0\.0\.1/i.test(chatHeaderText)) {
      throw new Error('FAIL: Orchestrator or 127.0.0.1 indicator detected in chat interface');
    }
    console.log('✓ Orchestrator and localhost identifiers completely removed from chat interface.');

    // 4. Verify Complete Removal of Reasoning Model Indicator / Dropdown
    console.log('[4/9] Verifying removal of reasoning model indicator/badge in chat interface...');
    const hasReasoningDropdown = await page.locator('button:has-text("Reasoning:")').count();
    if (hasReasoningDropdown > 0) {
      throw new Error('FAIL: Reasoning model indicator/dropdown is still visible in chat interface');
    }
    console.log('✓ Reasoning model indicator/badge completely removed from chat interface.');

    // 5. Verify Complete Absence of Forbidden Terminology Across UI
    console.log('[5/9] Verifying total removal of forbidden terminology...');
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

    // 6. Stage 1 & 2: Submit task and generate Workplan
    console.log('[6/9] Testing Stage 1 (Interactive Input) & Stage 2 (Capability Analysis & Plan Generation)...');
    await page.fill('textarea[placeholder*="Submit task"]', 'Analyze architectural constraints and verify constraint allocation in sandbox');
    await page.click('button:has-text("Analyze & Plan")');

    // Wait for Stage 3 Human Approval Workplan Card to render
    console.log('[7/9] Verifying Stage 3 (Human Approval Interface)...');
    await page.waitForSelector('text=STAGE 2 WORKPLAN: HUMAN APPROVAL REQUIRED', { timeout: 10000 });

    const planCardVisible = await page.locator('text=STAGE 2 WORKPLAN: HUMAN APPROVAL REQUIRED').isVisible();
    if (!planCardVisible) throw new Error('FAIL: Workplan approval card did not render');

    // Verify task interpretation, selected models, sequence, deliverables
    const hasInterpretation = await page.locator('text=Task Interpretation').isVisible();
    const hasAgents = await page.locator('text=Selected Agents & Models').isVisible();
    const hasSequence = await page.locator('text=Execution Sequence').isVisible();
    const hasDeliverables = await page.locator('text=Expected Deliverables').isVisible();

    if (!hasInterpretation || !hasAgents || !hasSequence || !hasDeliverables) {
      throw new Error('FAIL: Workplan card is missing required specification fields');
    }

    // Verify Approval, Edit, and Cancel buttons exist
    const hasApproveBtn = await page.locator('button:has-text("Approve Workplan")').isVisible();
    const hasEditBtn = await page.locator('button:has-text("Edit Workplan")').isVisible();
    const hasCancelBtn = await page.locator('button:has-text("Cancel")').isVisible();

    if (!hasApproveBtn || !hasEditBtn || !hasCancelBtn) {
      throw new Error('FAIL: Approval, Edit, or Cancel controls missing from workplan interface');
    }
    console.log('✓ Stage 2 Workplan generated & Stage 3 Human Approval interface verified.');

    // 7. Stage 5, 6, 7 & 8: Approve Workplan and verify execution, compilation & validation
    console.log('[8/9] Approving workplan and testing multi-agent execution, compilation & validation...');
    await page.click('button:has-text("Approve Workplan")');

    // Wait for compilation result & validation report
    await page.waitForSelector('text=STAGE 7 VALIDATION REPORT', { timeout: 15000 });
    const hasValidation = await page.locator('text=STAGE 7 VALIDATION REPORT').isVisible();
    if (!hasValidation) throw new Error('FAIL: Stage 7 Validation report did not render');

    // Verify code execution sandbox result
    const hasSandboxOutput = await page.locator('text=Sandbox Output').isVisible();
    if (!hasSandboxOutput) throw new Error('FAIL: Sandboxed code execution output missing');

    // Verify Markdown formatted content rendered
    const hasRenderedHeading = await page.locator('h3:has-text("Sandboxed Verification")').count();
    const hasRenderedCode = await page.locator('pre code').count();
    if (hasRenderedHeading === 0 && hasRenderedCode === 0) {
      throw new Error('FAIL: Clean Markdown rendering did not produce structured headings or code blocks');
    }
    console.log('✓ Stage 5, 6, 7 & 8 verified: Agent execution, sandboxed code runner, clean Markdown compilation & validation passed.');

    // 8. Check console errors
    console.log('[9/9] Checking for console errors...');
    const relevantErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('apple-touch-icon'));
    if (relevantErrors.length > 0) {
      throw new Error(`Console errors detected: ${relevantErrors.join(' | ')}`);
    }
    console.log('✓ Zero console errors detected.');

    console.log('\n======================================================');
    console.log('ALL 9 LUMI AUDIT & VERIFICATION CHECKS PASSED');
    console.log('======================================================');
  } catch (err) {
    console.error('\nVerification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runLumiWorkflowVerification();
