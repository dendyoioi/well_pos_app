const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/dendyaditya/.gemini/antigravity-ide/brain/f134b0b0-2764-4d8a-9fd7-27d152fce5f8';
const BASE_URL = 'http://localhost:5173';

async function runQaTests() {
  console.log('🚀 Starting Well POS Automated QA Test Suite...');
  const testResults = {
    passed: [],
    failed: [],
    observations: [],
    screenshots: {}
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // Listen to console logs & errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error]: ${msg.text()}`);
      testResults.observations.push(`Console Error: ${msg.text()}`);
    }
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Landing Page Visual & Element Inspection (Desktop)
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Landing Page Desktop Inspection ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Check title
    const title = await page.title();
    console.log(`Page title: "${title}"`);
    if (title.includes('POS Toko')) {
      testResults.observations.push(`Title tag in index.html masih default/lama: "${title}". Sebaiknya konsisten "Well POS - Sistem Kasir & Logistik Cloud Multi-Outlet".`);
    }

    // Check logo and brand
    const brandText = await page.locator('nav').innerText();
    if (brandText.includes('Well POS') && brandText.includes('v2.5 Cloud')) {
      testResults.passed.push('Brand name "Well POS" and badge "v2.5 Cloud" verified in Top Navigation.');
    } else {
      testResults.failed.push('Brand name / badge not found in Top Navigation.');
    }

    // Check CTA buttons in nav
    const loginBtnNav = page.locator('nav button:has-text("Login Merchant")');
    const registerBtnNav = page.locator('nav button:has-text("Daftar Gratis")');
    if (await loginBtnNav.isVisible() && await registerBtnNav.isVisible()) {
      testResults.passed.push('Top navigation action buttons (Login Merchant & Daftar Gratis) visible.');
    } else {
      testResults.failed.push('Top navigation buttons missing.');
    }

    // Check Hero Section elements
    const h1Text = await page.locator('h1').innerText();
    console.log(`H1 Headline: "${h1Text.replace(/\n/g, ' ')}"`);
    if (h1Text.includes('Satu Platform Kasir Cerdas')) {
      testResults.passed.push('Hero H1 headline verified.');
    } else {
      testResults.failed.push('Hero H1 headline mismatch.');
    }

    // Check Trust highlights
    const highlights = await page.locator('main .grid > div').allInnerTexts();
    console.log(`Trust highlights count: ${highlights.length}`);
    if (highlights.length === 4) {
      testResults.passed.push(`4 Trust highlights verified: ${highlights.map(h => h.split('\n')[0]).join(', ')}`);
    } else {
      testResults.failed.push(`Expected 4 trust highlights, got ${highlights.length}`);
    }

    // Capture Desktop Landing Page screenshot
    const ssDesktop = path.join(ARTIFACT_DIR, 'screenshot_landing_desktop.png');
    await page.screenshot({ path: ssDesktop, fullPage: true });
    testResults.screenshots.desktop = ssDesktop;
    console.log(`Saved screenshot: ${ssDesktop}`);

    // -------------------------------------------------------------
    // TEST 2: Responsive Check (Mobile Viewport)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Landing Page Mobile Viewport (375x812) ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    const ssMobile = path.join(ARTIFACT_DIR, 'screenshot_landing_mobile.png');
    await page.screenshot({ path: ssMobile, fullPage: true });
    testResults.screenshots.mobile = ssMobile;
    console.log(`Saved screenshot: ${ssMobile}`);

    // Check if CTAs are responsive and visible on mobile
    const heroRegisterBtn = page.locator('button:has-text("Daftar Akun Baru & Buka Toko")');
    const heroLoginBtn = page.locator('main button:has-text("Login Merchant")');
    if (await heroRegisterBtn.isVisible() && await heroLoginBtn.isVisible()) {
      testResults.passed.push('Mobile viewport: Hero CTAs are properly stacked and visible.');
    } else {
      testResults.failed.push('Mobile viewport: Hero CTAs cut off or hidden.');
    }

    // Reset viewport back to desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // TEST 3: Navigation Flow (To Login Page and Back)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Navigation Flow (Landing <-> Login) ---');
    await loginBtnNav.click();
    await page.waitForTimeout(500);

    const loginHeader = await page.locator('h1').innerText();
    console.log(`Login view header: "${loginHeader}"`);
    if (loginHeader.includes('Mesin Kasir Terminal') || loginHeader.includes('Portal Pemilik Toko')) {
      testResults.passed.push('Navigation to Login Page successful.');
    } else {
      testResults.failed.push('Failed navigating to Login Page.');
    }

    // Check "Kembali ke Website"
    const backBtn = page.locator('button:has-text("Kembali ke Website")');
    if (await backBtn.isVisible()) {
      testResults.passed.push('"Kembali ke Website" button present on Login Page.');
      await backBtn.click();
      await page.waitForTimeout(500);
      const returnedH1 = await page.locator('h1').innerText();
      if (returnedH1.includes('Satu Platform Kasir Cerdas')) {
        testResults.passed.push('Successfully navigated back to Landing Page.');
      } else {
        testResults.failed.push('Return button did not take user back to Landing Page.');
      }
    } else {
      testResults.failed.push('"Kembali ke Website" button missing on Login Page.');
    }

    // -------------------------------------------------------------
    // TEST 4: Registration Modal Structure & Elements
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Registration Modal Structure ---');
    await registerBtnNav.click();
    await page.waitForTimeout(500);

    // Modal title check
    const modalTitle = page.locator('h3:has-text("Daftar Akun Merchant Baru")');
    if (await modalTitle.isVisible()) {
      testResults.passed.push('Registration modal opens with title "Daftar Akun Merchant Baru".');
    } else {
      testResults.failed.push('Registration modal title not found.');
    }

    // Check Industry buttons
    const fnbBtn = page.locator('button:has-text("F&B")');
    const retailBtn = page.locator('button:has-text("Retail")');
    const servicesBtn = page.locator('button:has-text("Services")');

    const fnbClass = await fnbBtn.getAttribute('class');
    const isRetailDisabled = await retailBtn.isDisabled();
    const isServicesDisabled = await servicesBtn.isDisabled();

    if (fnbClass.includes('border-emerald') && isRetailDisabled && isServicesDisabled) {
      testResults.passed.push('Industry vertical selector: F&B active by default, Retail & Services disabled with "Segera Hadir".');
    } else {
      testResults.failed.push('Industry vertical selector state incorrect.');
    }

    // Check input fields
    const businessInput = page.locator('input[placeholder*="Kopi Senja"]');
    const ownerInput = page.locator('input[placeholder*="Dendy Aditya"]');
    const emailInput = page.locator('input[type="email"]');
    const phoneInput = page.locator('input[type="tel"]');
    const passwordInput = page.locator('input[type="password"]');

    if (await businessInput.isVisible() && await ownerInput.isVisible() &&
        await emailInput.isVisible() && await phoneInput.isVisible() &&
        await passwordInput.isVisible()) {
      testResults.passed.push('All 5 registration input fields are rendered.');
    } else {
      testResults.failed.push('One or more registration input fields are missing.');
    }

    // Take screenshot of open modal
    const ssModal = path.join(ARTIFACT_DIR, 'screenshot_registration_modal.png');
    await page.screenshot({ path: ssModal });
    testResults.screenshots.modal = ssModal;
    console.log(`Saved screenshot: ${ssModal}`);

    // -------------------------------------------------------------
    // TEST 5: Negative Testing - Invalid WhatsApp Phone Number
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Negative Validation (Invalid Phone) ---');
    await businessInput.fill('Kopi Uji QA');
    await ownerInput.fill('Tester QA');
    await emailInput.fill('tester.qa@example.com');
    await phoneInput.fill('0215551234'); // Invalid: landline / not mobile 08
    await passwordInput.fill('password123');

    const submitBtn = page.locator('button[type="submit"]:has-text("Daftar Sekarang")');
    await submitBtn.click();
    await page.waitForTimeout(400);

    const errorBanner = page.locator('div.bg-rose-50');
    if (await errorBanner.isVisible()) {
      const errText = await errorBanner.innerText();
      console.log(`Phone validation error caught: "${errText}"`);
      if (errText.includes('Nomor WhatsApp tidak valid')) {
        testResults.passed.push(`Client-side phone validation successfully blocked invalid number with error: "${errText}"`);
      }
    } else {
      testResults.failed.push('Invalid phone number was not rejected by validation!');
    }

    const ssPhoneErr = path.join(ARTIFACT_DIR, 'screenshot_phone_validation_error.png');
    await page.screenshot({ path: ssPhoneErr });
    testResults.screenshots.phoneError = ssPhoneErr;

    // -------------------------------------------------------------
    // TEST 6: Positive Testing - Successful Registration
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Positive Registration Flow ---');
    const uniqueEmail = `qa.merchant.${Date.now()}@wellpos-sandbox.id`;
    const businessName = `Kopi Cerdas QA ${Math.floor(100 + Math.random() * 900)}`;
    const ownerName = 'Aditya Pratama Tester';
    const validPhone = '081298765432';

    await businessInput.fill(businessName);
    await ownerInput.fill(ownerName);
    await emailInput.fill(uniqueEmail);
    await phoneInput.fill(validPhone);
    await passwordInput.fill('supersecret123');

    // Intercept network call
    const [registerResponse] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/saas/register')),
      submitBtn.click()
    ]);

    const regStatus = registerResponse.status();
    const regJson = await registerResponse.json();
    console.log(`POST /api/saas/register response [${regStatus}]:`, JSON.stringify(regJson, null, 2));

    if (regStatus === 201 && regJson.status === 'success') {
      testResults.passed.push(`Tenant registered successfully (Tenant ID: ${regJson.data?.tenant?.id}, Status: ${regJson.data?.tenant?.status})`);
    } else {
      testResults.failed.push(`Registration failed: ${regJson.message || 'Unknown error'}`);
    }

    await page.waitForTimeout(600);

    // Verify Success Modal UI
    const successGreeting = page.locator(`h4:has-text("Selamat Datang, ${ownerName}!")`);
    const statusPendingBadge = page.locator('span:has-text("Menunggu Approval Super Admin")');
    const goToLoginBtn = page.locator('button:has-text("Lanjut ke Login Merchant")');

    if (await successGreeting.isVisible() && await statusPendingBadge.isVisible() && await goToLoginBtn.isVisible()) {
      testResults.passed.push('Success state correctly rendered inside modal with tenant name and Pending status.');
    } else {
      testResults.failed.push('Success modal state did not display expected elements.');
    }

    const ssSuccess = path.join(ARTIFACT_DIR, 'screenshot_registration_success.png');
    await page.screenshot({ path: ssSuccess });
    testResults.screenshots.success = ssSuccess;
    console.log(`Saved screenshot: ${ssSuccess}`);

    // -------------------------------------------------------------
    // TEST 7: End-to-End Handshake - Login with Pending Account
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Handshake Login with Pending Account ---');
    await goToLoginBtn.click();
    await page.waitForTimeout(600);

    // Switch to Backoffice Tab
    const backofficeTab = page.locator('button:has-text("Portal Pemilik (Email)")');
    await backofficeTab.click();
    await page.waitForTimeout(300);

    const loginEmailInput = page.locator('input[type="email"]');
    const loginPassInput = page.locator('input[type="password"]');
    const loginSubmitBtn = page.locator('button[type="submit"]:has-text("Masuk ke Portal Pemilik")');

    await loginEmailInput.fill(uniqueEmail);
    await loginPassInput.fill('supersecret123');

    const [loginResponse] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/auth/login')),
      loginSubmitBtn.click()
    ]);

    const loginStatus = loginResponse.status();
    const loginJson = await loginResponse.json();
    console.log(`POST /api/auth/login response [${loginStatus}]:`, JSON.stringify(loginJson, null, 2));

    await page.waitForTimeout(600);

    // Check if Pending Approval Modal appears
    const pendingModalTitle = page.locator('h3:has-text("Akun Bisnis Sedang Ditinjau")');
    if (await pendingModalTitle.isVisible()) {
      testResults.passed.push('End-to-End handshake verified: Logging into a PENDING tenant gracefully shows "Akun Bisnis Sedang Ditinjau" modal.');
    } else {
      testResults.failed.push('Pending Approval modal did not show after login attempt.');
    }

    const ssPendingLogin = path.join(ARTIFACT_DIR, 'screenshot_pending_approval_login.png');
    await page.screenshot({ path: ssPendingLogin });
    testResults.screenshots.pendingLogin = ssPendingLogin;
    console.log(`Saved screenshot: ${ssPendingLogin}`);

    // Dismiss modal
    await page.locator('button:has-text("Mengerti & Kembali")').click();
    await page.waitForTimeout(300);

    // -------------------------------------------------------------
    // TEST 8: Negative Testing - Duplicate Email Registration
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Negative Duplicate Email Registration ---');
    // Return to landing page
    await page.locator('button:has-text("Kembali ke Website")').click();
    await page.waitForTimeout(500);

    // Open register modal
    await page.locator('nav button:has-text("Daftar Gratis")').click();
    await page.waitForTimeout(400);

    // Try registering with same email
    await page.locator('input[placeholder*="Kopi Senja"]').fill('Kopi Kloning');
    await page.locator('input[placeholder*="Dendy Aditya"]').fill('Kloning Owner');
    await page.locator('input[type="email"]').fill(uniqueEmail);
    await page.locator('input[type="tel"]').fill('081211112222');
    await page.locator('input[type="password"]').fill('password123');

    const [dupResponse] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/saas/register')),
      page.locator('button[type="submit"]:has-text("Daftar Sekarang")').click()
    ]);

    const dupStatus = dupResponse.status();
    const dupJson = await dupResponse.json();
    console.log(`POST /api/saas/register Duplicate response [${dupStatus}]:`, JSON.stringify(dupJson, null, 2));

    await page.waitForTimeout(400);
    const dupError = page.locator('div.bg-rose-50');
    if (await dupError.isVisible()) {
      const msg = await dupError.innerText();
      if (msg.includes('Email bisnis ini sudah terdaftar')) {
        testResults.passed.push(`Duplicate email registration properly rejected by server with 400: "${msg}"`);
      }
    } else {
      testResults.failed.push('Duplicate email registration was not caught by error banner.');
    }

    const ssDupErr = path.join(ARTIFACT_DIR, 'screenshot_duplicate_email_error.png');
    await page.screenshot({ path: ssDupErr });
    testResults.screenshots.duplicateError = ssDupErr;

    // -------------------------------------------------------------
    // TEST 9: Deep Linking Verification (#register & #pos)
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Deep Linking Verification ---');
    await page.goto(`${BASE_URL}/#register`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const deepRegisterVisible = await page.locator('h3:has-text("Daftar Akun Merchant Baru")').isVisible();
    if (deepRegisterVisible) {
      testResults.passed.push('Deep link `/#register` opens registration modal automatically.');
    } else {
      testResults.failed.push('Deep link `/#register` did not open modal.');
    }

  } catch (err) {
    console.error('❌ Test execution error:', err);
    testResults.failed.push(`Fatal test execution exception: ${err.message}`);
  } finally {
    await browser.close();
  }

  // Write summary results to json
  const resultsPath = path.join(ARTIFACT_DIR, 'test_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  console.log(`\n✅ QA Testing Finished! Results saved to ${resultsPath}`);
}

runQaTests();
