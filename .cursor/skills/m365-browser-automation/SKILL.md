---
name: m365-browser-automation
description: >
  Automates Microsoft 365, Entra, and Intune portals via Puppeteer.
  Use when automating M365 admin login, Entra user/role management,
  license assignment, or Intune script deployment via browser.
  Covers login flow pitfalls, iframe navigation, Graph API fallbacks,
  and session management.
---

# Microsoft 365 / Entra Browser Automation Skill

## Critical Rules

### 1. Login Page DOM IDs (Never Guess)
```
#i0116  → Email input
#i0118  → Password input
#idSIButton9 → Next / Sign in / Yes button (reused across steps)
```

### 2. Always Use `evaluate()` for Clicks
```js
// ❌ WRONG — hangs if element isn't "actionable"
await element.click();

// ✅ CORRECT — executes in page context, never hangs
await page.evaluate(el => el.click(), element);
```

### 3. Login Flow Must Be Sequential (5s+ waits)
```
Step 1: Type email into #i0116 → click #idSIButton9 → wait 5s
Step 2: Type password into #i0118 → click #idSIButton9 → wait 5s
Step 3: "Stay signed in?" → click #idSIButton9 (Yes) → wait 10-15s
```

### 4. Clear Input Fields Before Typing
```js
// ❌ WRONG — appends to existing text, corrupts value
await input.type('value');

// ✅ CORRECT — clear first, then type
await page.evaluate(el => { el.value = ''; el.focus(); }, input);
await input.type('value', { delay: 40 });
```

### 5. Entra Uses Deep Iframes
```js
// Always search ALL frames
for (const f of page.frames()) {
    try {
        const el = await f.$('selector');
        if (el) {
            // Use f.evaluate(), NOT page.evaluate()
            await f.evaluate(el => el.click(), el);
        }
    } catch(e) {}
}
```

### 6. Graph API > UI for Admin Tasks
Extract bearer token from browser, then use REST API:
```js
const token = await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage)) {
        const v = sessionStorage.getItem(key);
        if (v && v.includes('eyJ')) {
            try { const j = JSON.parse(v); if (j.secret) return j.secret; } catch(e) {}
        }
    }
});
// Then: curl -H "Authorization: Bearer $token" https://graph.microsoft.com/v1.0/...
```

### 7. No `page.waitForTimeout()`
```js
// ❌ Does not exist
await page.waitForTimeout(5000);

// ✅ Use this instead
await new Promise(r => setTimeout(r, 5000));
```

### 8. Keyboard Goes Through `page`, Not Frame
```js
// ❌ frame.keyboard does not exist
await frame.keyboard.press('Enter');

// ✅ Always use page
await page.keyboard.press('Enter');
```

### 9. Sessions Don't Cross Microsoft Subdomains
Each portal needs separate auth:
- `entra.microsoft.com`
- `admin.microsoft.com`
- `intune.microsoft.com`

Use `--user-data-dir=/tmp/some-profile` for persistent cookies.

### 10. Check Licenses Before Intune
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  https://graph.microsoft.com/v1.0/subscribedSkus | jq '.value'
```
Empty `[]` = no licenses = Intune will 404. Must activate a trial first.

## Reference: Robust Login Template
```js
const puppeteer = require('puppeteer-core');
const SCREENSHOTS = '/path/to/screenshots';
const EMAIL = 'user@tenant.onmicrosoft.com';
const PASSWORD = 'password';

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
    const res = await fetch('http://127.0.0.1:9222/json/version');
    const data = await res.json();
    const browser = await puppeteer.connect({ browserWSEndpoint: data.webSocketDebuggerUrl });
    const page = (await browser.pages())[0];

    await page.goto('https://admin.microsoft.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(6000);

    // Email
    const emailEl = await page.$('#i0116');
    await page.evaluate(el => { el.value = ''; el.focus(); }, emailEl);
    await emailEl.type(EMAIL, { delay: 40 });
    await wait(500);
    await page.evaluate(el => el.click(), await page.$('#idSIButton9'));
    await wait(5000);

    // Password
    const pwdEl = await page.$('#i0118');
    await page.evaluate(el => { el.value = ''; el.focus(); }, pwdEl);
    await pwdEl.type(PASSWORD, { delay: 40 });
    await wait(500);
    await page.evaluate(el => el.click(), await page.$('#idSIButton9'));
    await wait(5000);

    // Stay signed in? → Yes
    const yesBtn = await page.$('#idSIButton9');
    if (yesBtn) await page.evaluate(el => el.click(), yesBtn);
    await wait(15000);

    console.log("Final URL:", page.url());
    await browser.disconnect();
})();
```
