#!/usr/bin/env bun
/**
 * End-to-end tests for LiveMorph
 * Tests HTML morphing, CSS reload, and state preservation
 *
 * Set CHROMIUM_PATH env var to override browser location.
 * If not set, uses Playwright's bundled browser.
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || undefined;
const TEST_DIR = join(process.cwd(), 'test');

// Test results
let passed = 0;
let failed = 0;

function log(msg) {
  console.log(msg);
}

function pass(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, error) {
  failed++;
  console.log(`  ✗ ${name}`);
  console.log(`    Error: ${error}`);
}

// Helper to modify a file and trigger reload
function modifyFile(filename, search, replace) {
  const filepath = join(TEST_DIR, filename);
  const content = readFileSync(filepath, 'utf-8');
  const newContent = content.replace(search, replace);
  writeFileSync(filepath, newContent);
  return () => writeFileSync(filepath, content); // Return restore function
}

async function runTests() {
  log('Starting LiveMorph E2E Tests\n');
  log('Launching browser...');

  const launchOptions = { headless: true };
  if (CHROMIUM_PATH) {
    launchOptions.executablePath = CHROMIUM_PATH;
  }
  const browser = await chromium.launch(launchOptions);

  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate and wait for connection
  log('Navigating to test page...');
  await page.goto('http://localhost:3000/test/');

  try {
    await page.waitForSelector('#status:has-text("Connected")', { timeout: 10000 });
    pass('LiveMorph connects to server');
  } catch (e) {
    fail('LiveMorph connects to server', e.message);
    await browser.close();
    return;
  }

  log('\n--- HTML Morphing Tests ---');

  // Test: Input state preservation
  {
    const testValue = 'Hello LiveMorph!';
    const input = page.locator('#test-input');
    await input.fill(testValue);

    const restore = modifyFile('index.html',
      '<p id="content">This is the original content.</p>',
      '<p id="content">MODIFIED content</p>'
    );

    try {
      await page.waitForSelector('#content:has-text("MODIFIED")', { timeout: 5000 });
      const value = await input.inputValue();
      if (value === testValue) {
        pass('Input state preserved during HTML morph');
      } else {
        fail('Input state preserved during HTML morph', `Expected "${testValue}", got "${value}"`);
      }
    } catch (e) {
      fail('Input state preserved during HTML morph', e.message);
    } finally {
      restore();
      await page.waitForSelector('#content:has-text("original")', { timeout: 5000 }).catch(() => {});
    }
  }

  // Test: Tab (radio button) state preservation
  {
    await page.locator('label[for="tab2"]').click();

    const restore = modifyFile('index.html',
      '<p id="content">This is the original content.</p>',
      '<p id="content">Tab test mod</p>'
    );

    try {
      await page.waitForSelector('#content:has-text("Tab test")', { timeout: 5000 });
      const isChecked = await page.locator('#tab2').isChecked();
      if (isChecked) {
        pass('Tab selection preserved during HTML morph');
      } else {
        fail('Tab selection preserved during HTML morph', 'Tab 2 was not checked after morph');
      }
    } catch (e) {
      fail('Tab selection preserved during HTML morph', e.message);
    } finally {
      restore();
      await page.waitForSelector('#content:has-text("original")', { timeout: 5000 }).catch(() => {});
      // Reset tab
      await page.locator('label[for="tab1"]').click();
    }
  }

  // Test: Details open state preservation
  {
    const details = page.locator('#details1');
    await details.locator('summary').click();

    const restore = modifyFile('index.html',
      '<p id="content">This is the original content.</p>',
      '<p id="content">Details test mod</p>'
    );

    try {
      await page.waitForSelector('#content:has-text("Details test")', { timeout: 5000 });
      const isOpen = await details.evaluate(el => el.hasAttribute('open'));
      if (isOpen) {
        pass('Details open state preserved during HTML morph');
      } else {
        fail('Details open state preserved during HTML morph', 'Details element was closed after morph');
      }
    } catch (e) {
      fail('Details open state preserved during HTML morph', e.message);
    } finally {
      restore();
      await page.waitForSelector('#content:has-text("original")', { timeout: 5000 }).catch(() => {});
    }
  }

  // Test: Multi-step form state
  {
    await page.locator('#name').fill('John Doe');
    await page.locator('#email').fill('john@example.com');
    await page.locator('label[for="step2"]').first().click();
    await page.locator('#address').fill('123 Main St');

    const restore = modifyFile('index.html',
      '<p id="content">This is the original content.</p>',
      '<p id="content">Form test mod</p>'
    );

    try {
      await page.waitForSelector('#content:has-text("Form test")', { timeout: 5000 });

      const step2Checked = await page.locator('#step2').isChecked();
      const nameValue = await page.locator('#name').inputValue();
      const emailValue = await page.locator('#email').inputValue();
      const addressValue = await page.locator('#address').inputValue();

      if (step2Checked && nameValue === 'John Doe' && emailValue === 'john@example.com' && addressValue === '123 Main St') {
        pass('Multi-step form state preserved during HTML morph');
      } else {
        fail('Multi-step form state preserved during HTML morph',
          `step2: ${step2Checked}, name: ${nameValue}, email: ${emailValue}, address: ${addressValue}`);
      }
    } catch (e) {
      fail('Multi-step form state preserved during HTML morph', e.message);
    } finally {
      restore();
      await page.waitForSelector('#content:has-text("original")', { timeout: 5000 }).catch(() => {});
      // Reset form
      await page.locator('label[for="step1"]').first().click();
    }
  }

  log('\n--- Shadow DOM Tests ---');

  // Test: Declarative Shadow DOM content updates
  {
    // Wait for page to stabilize after previous tests
    await page.waitForSelector('#shadow-host', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(500); // Let shadow DOM initialize

    // Check initial shadow DOM content
    const shadowHost = page.locator('#shadow-host');

    // Get text from shadow root
    const initialText = await shadowHost.evaluate(el => {
      return el.shadowRoot?.querySelector('#shadow-text')?.textContent;
    });

    if (initialText !== 'Original shadow DOM content') {
      fail('Shadow DOM initial content', `Expected "Original shadow DOM content", got "${initialText}"`);
    } else {
      pass('Shadow DOM initial content rendered');
    }

    const restore = modifyFile('index.html',
      '<p id="shadow-text">Original shadow DOM content</p>',
      '<p id="shadow-text">UPDATED shadow DOM content</p>'
    );

    try {
      // Wait for shadow DOM to update
      await page.waitForFunction(() => {
        const host = document.getElementById('shadow-host');
        const text = host?.shadowRoot?.querySelector('#shadow-text')?.textContent;
        return text === 'UPDATED shadow DOM content';
      }, { timeout: 5000 });

      pass('Shadow DOM content updates on morph');
    } catch (e) {
      const currentText = await shadowHost.evaluate(el => {
        return el.shadowRoot?.querySelector('#shadow-text')?.textContent;
      });
      fail('Shadow DOM content updates on morph', `Shadow text is "${currentText}": ${e.message}`);
    } finally {
      restore();
      // Wait for restore
      await page.waitForFunction(() => {
        const host = document.getElementById('shadow-host');
        const text = host?.shadowRoot?.querySelector('#shadow-text')?.textContent;
        return text === 'Original shadow DOM content';
      }, { timeout: 5000 }).catch(() => {});
    }
  }

  log('\n--- CSS Reload Tests ---');

  // Test: CSS reload changes styles
  {
    const colorBox = page.locator('.color-box');
    const initialBg = await colorBox.evaluate(el => getComputedStyle(el).backgroundColor);

    const restore = modifyFile('styles.css',
      'background: #3498db;',
      'background: #e74c3c;'
    );

    try {
      // Wait for style to change
      await page.waitForFunction(
        (initial) => {
          const box = document.querySelector('.color-box');
          return getComputedStyle(box).backgroundColor !== initial;
        },
        initialBg,
        { timeout: 5000 }
      );
      pass('CSS changes applied without page reload');
    } catch (e) {
      fail('CSS changes applied without page reload', e.message);
    } finally {
      restore();
    }
  }

  log('\n--- JS Reload Tests ---');

  // Test: JS change triggers full page reload
  {
    // Fill input to detect page reload (will be cleared)
    await page.locator('#test-input').fill('Will be lost');

    const restore = modifyFile('test-script.js',
      "console.log('test-script.js loaded at:'",
      "console.log('MODIFIED test-script.js at:'"
    );

    try {
      // Wait for reload
      await page.waitForFunction(() => {
        const input = document.getElementById('test-input');
        return input && input.value === '';
      }, { timeout: 5000 });

      pass('JS change triggers full page reload');
    } catch (e) {
      // Check if it actually reloaded
      const inputValue = await page.locator('#test-input').inputValue();
      if (inputValue === '') {
        pass('JS change triggers full page reload');
      } else {
        fail('JS change triggers full page reload', e.message);
      }
    } finally {
      restore();
    }
  }

  await browser.close();

  // Summary
  log('\n========================================');
  log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
