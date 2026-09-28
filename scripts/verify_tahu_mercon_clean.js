const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/1ca03e93-2b75-45a8-a75b-cea5c4e38d27';

  try {
    // Login via API login toko
    const loginRes = await page.request.post('http://localhost:5001/api/auth/login', {
      data: {
        email: 'owner@tahumercon.com',
        password: '123456'
      }
    });
    const loginData = await loginRes.json();
    console.log('Login response:', loginData.status, loginData.data?.user?.name, loginData.data?.user?.tenant?.name);

    const token = loginData.data?.token;
    const user = loginData.data?.user;

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify(user));
      window.location.hash = '';
    }, { token, user });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Buka menu Bahan Baku & Stok
    const stockGroupBtn = page.locator('aside button:has-text("Bahan Baku & Stok")').first();
    if (await stockGroupBtn.count() > 0) {
      await stockGroupBtn.click();
      await page.waitForTimeout(500);
    }
    const stockBtn = page.locator('aside button:has-text("Stok Bahan Baku")').first();
    if (await stockBtn.count() > 0) {
      await stockBtn.click();
      await page.waitForTimeout(2000);
    }

    const screenshotPath = path.join(artifactDir, '38_tahu_mercon_clean_inventory.png');
    await page.screenshot({ path: screenshotPath });
    console.log('Saved clean Tahu Mercon screenshot to:', screenshotPath);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
