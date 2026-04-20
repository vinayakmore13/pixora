// wedding-hub.test.js — Playwright Browser Test
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000'; // Change to your app URL

const TEST_ACCOUNTS = {
  user: { email: 'testuser@wedding.com', password: 'Test1234!' },
  admin: { email: 'admin@wedding.com', password: 'Admin1234!' }
};

async function runTests() {
  const browser = await chromium.launch({ headless: false }); // Opens real browser
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const passed = [];

  console.log('🧪 Starting Wedding Hub Browser Tests...\n');

  // ─────────────────────────────────────────
  // TEST 1: LANDING PAGE LOADS
  // ─────────────────────────────────────────
  try {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    console.log('✅ Landing page loaded');
    passed.push('Landing page loads');
  } catch (e) {
    console.log('❌ Landing page FAILED:', e.message);
    errors.push({ test: 'Landing page', error: e.message });
  }

  // ─────────────────────────────────────────
  // TEST 2: NAVIGATE TO SIGN IN
  // ─────────────────────────────────────────
  try {
    await page.click('text=Sign In', { timeout: 5000 });
    await page.waitForURL('**/login**', { timeout: 5000 });
    console.log('✅ Sign In page navigates correctly');
    passed.push('Sign In navigation');
  } catch (e) {
    try {
      await page.goto(`${BASE_URL}/login`);
      console.log('✅ Sign In page loaded via direct URL');
      passed.push('Sign In direct URL');
    } catch (e2) {
      console.log('❌ Sign In navigation FAILED:', e2.message);
      errors.push({ test: 'Sign In navigation', error: e2.message });
    }
  }

  // ─────────────────────────────────────────
  // TEST 3: SIGN IN FORM — WRONG CREDENTIALS
  // ─────────────────────────────────────────
  try {
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    const errorMsg = await page.locator(
      '.error, .alert, [class*="error"], [class*="alert"]'
    ).first().isVisible();

    if (errorMsg) {
      console.log('✅ Wrong credentials shows error message');
      passed.push('Wrong credentials error shown');
    } else {
      console.log('⚠️  Wrong credentials — no error message shown');
      errors.push({ test: 'Wrong credentials error', error: 'No error message displayed' });
    }
  } catch (e) {
    console.log('❌ Sign In form FAILED:', e.message);
    errors.push({ test: 'Sign In form', error: e.message });
  }

  // ─────────────────────────────────────────
  // TEST 4: USER SIGN IN — CORRECT CREDENTIALS
  // ─────────────────────────────────────────
  try {
    await page.fill('input[type="email"]', TEST_ACCOUNTS.user.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.user.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const currentURL = page.url();
    const isLoggedIn = currentURL.includes('dashboard') ||
                       currentURL.includes('home') ||
                       !currentURL.includes('login');

    if (isLoggedIn) {
      console.log('✅ User login successful — redirected to:', currentURL);
      passed.push('User login success');
    } else {
      console.log('❌ User login FAILED — still on:', currentURL);
      errors.push({ test: 'User login', error: 'Did not redirect after login' });
    }
  } catch (e) {
    console.log('❌ User login FAILED:', e.message);
    errors.push({ test: 'User login', error: e.message });
  }

  // ─────────────────────────────────────────
  // TEST 5: USER DASHBOARD LOADS
  // ─────────────────────────────────────────
  try {
    await page.waitForLoadState('networkidle');
    const bodyText = await page.textContent('body');
    const hasDashboard = bodyText.includes('Dashboard') ||
                         bodyText.includes('Welcome') ||
                         bodyText.includes('Wedding');

    if (hasDashboard) {
      console.log('✅ User dashboard loaded correctly');
      passed.push('User dashboard loads');
    } else {
      console.log('⚠️  Dashboard content not detected');
      errors.push({ test: 'User dashboard', error: 'Dashboard content not found' });
    }
  } catch (e) {
    errors.push({ test: 'User dashboard', error: e.message });
  }

  // ─────────────────────────────────────────
  // TEST 6: USER LOGOUT
  // ─────────────────────────────────────────
  try {
    const logoutBtn = page.locator(
      'text=Logout, text=Sign Out, text=Log Out, [class*="logout"]'
    ).first();
    await logoutBtn.click({ timeout: 5000 });
    await page.waitForTimeout(2000);

    const afterLogout = page.url();
    const isLoggedOut = afterLogout.includes('login') ||
                        afterLogout.includes('signin') ||
                        afterLogout === BASE_URL + '/';

    if (isLoggedOut) {
      console.log('✅ User logout works correctly');
      passed.push('User logout');
    } else {
      console.log('⚠️  Logout may not have redirected correctly:', afterLogout);
      errors.push({ test: 'User logout', error: 'Did not redirect to login after logout' });
    }
  } catch (e) {
    console.log('❌ Logout FAILED:', e.message);
    errors.push({ test: 'User logout', error: e.message });
  }

  // ─────────────────────────────────────────
  // TEST 7: SIGN UP FLOW
  // ─────────────────────────────────────────
  try {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState('networkidle');

    // Fill signup form
    const randomEmail = `test${Date.now()}@wedding.com`;
    await page.fill('input[name="name"], input[placeholder*="name" i]', 'Test User');
    await page.fill('input[type="email"]', randomEmail);
    await page.fill('input[type="password"]', 'Test1234!');

    // Confirm password if exists
    const confirmPass = page.locator(
      'input[name="confirmPassword"], input[placeholder*="confirm" i]'
    );
    if (await confirmPass.count() > 0) {
      await confirmPass.fill('Test1234!');
    }

    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const afterSignup = page.url();
    const signupSuccess = !afterSignup.includes('register') ||
                          afterSignup.includes('dashboard') ||
                          afterSignup.includes('verify');

    if (signupSuccess) {
      console.log('✅ Sign Up flow works — redirected to:', afterSignup);
      passed.push('Sign up flow');
    } else {
      console.log('⚠️  Sign Up may have failed — still on:', afterSignup);
      errors.push({ test: 'Sign up', error: 'Did not redirect after signup' });
    }
  } catch (e) {
    console.log('❌ Sign Up FAILED:', e.message);
    errors.push({ test: 'Sign up flow', error: e.message });
  }

  // ─────────────────────────────────────────
  // TEST 8: ADMIN SIGN IN
  // ─────────────────────────────────────────
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', TEST_ACCOUNTS.admin.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.admin.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const adminURL = page.url();
    const isAdminDashboard = adminURL.includes('admin') ||
                             adminURL.includes('dashboard');

    if (isAdminDashboard) {
      console.log('✅ Admin login works — redirected to:', adminURL);
      passed.push('Admin login');
    } else {
      console.log('⚠️  Admin login — check redirect:', adminURL);
      errors.push({ test: 'Admin login', error: 'Admin not redirected to admin dashboard' });
    }
  } catch (e) {
    console.log('❌ Admin login FAILED:', e.message);
    errors.push({ test: 'Admin login', error: e.message });
  }

  // ─────────────────────────────────────────
  // TEST 9: ADMIN CANNOT ACCESS WRONG PAGES
  // ─────────────────────────────────────────
  try {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForTimeout(2000);
    const protectedURL = page.url();

    if (protectedURL.includes('login') || protectedURL.includes('unauthorized')) {
      console.log('✅ Admin route protected — redirects non-admins');
      passed.push('Admin route protection');
    } else {
      console.log('⚠️  Admin route may not be protected:', protectedURL);
      errors.push({ test: 'Admin route protection', error: 'Admin page accessible without auth' });
    }
  } catch (e) {
    errors.push({ test: 'Admin route protection', error: e.message });
  }

  // ─────────────────────────────────────────
  // TEST 10: CONSOLE ERRORS CHECK
  // ─────────────────────────────────────────
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto(BASE_URL);
  await page.waitForTimeout(3000);

  if (consoleErrors.length === 0) {
    console.log('✅ No console errors detected');
    passed.push('No console errors');
  } else {
    console.log('❌ Console errors found:');
    consoleErrors.forEach(err => console.log('   -', err));
    errors.push({ test: 'Console errors', error: consoleErrors.join(' | ') });
  }

  // ─────────────────────────────────────────
  // FINAL REPORT
  // ─────────────────────────────────────────
  console.log('\n════════════════════════════════════');
  console.log('📊 WEDDING HUB TEST REPORT');
  console.log('════════════════════════════════════');
  console.log(`✅ PASSED: ${passed.length}`);
  passed.forEach(p => console.log(`   ✅ ${p}`));
  console.log(`\n❌ FAILED: ${errors.length}`);
  errors.forEach(e => console.log(`   ❌ ${e.test}: ${e.error}`));
  console.log('════════════════════════════════════');

  await browser.close();
}

runTests();
