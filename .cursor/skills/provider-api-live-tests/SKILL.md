# Provider API Live Tests

Use when adding or updating PHPUnit tests that hit **shohozlive** (read-only) and probe **outbound provider APIs** without INSERT/UPDATE.

## Reference implementation

- **Support:** `app/tests/TestEngine/lib/ApiProviderLiveProbe.php` — PDO, config merge, HTTP probes
- **Test class:** `app/tests/ApiProviderLiveIntegrationTest.php` — **canonical boxed summary table**
- **CLI script:** `app/tests/TestEngine/toolkit/verify-active-api-providers.php`
- **Style reference:** `app/tests/MultiSaleShohozCommissionTest.php` (Input/Output docblocks)

## Required file structure

Every live-integration test file MUST include:

### 1. Test Output block (after requires)

```php
/**
 * Test Output
 * -----------
 * PHPUnit 4.8.36 by Sebastian Bergmann and contributors.
 *
 * ................
 *
 * Time: ~29 s, Memory: ~17.75MB
 *
 * OK (15 tests, 42 assertions)
 *
 * Command:
 *   ./scripts/run-tests.sh YourTestClass
 */
```

Update this block after each green run (see **Refresh header** below).

### 2. Boxed summary table in class docblock (REQUIRED design)

Use **Unicode box-drawing** with a **fixed display width**. Align with `mb_strlen()` — `━` is 3 bytes but 1 display column; never use `strlen()` for borders.

**Rules:**
- **Table width:** 95 display columns on every row
- **Column widths:** `#` (4) · Test method (42) · What it proves (30) · Status (8)
- **Horizontal rules:** full-width `┣━━…━━┫` only (no `┯┿┷` — they break with UTF-8)
- **Section rows:** `┃    │ ▸ Section … │                                │          ┃`
- **Data rows:** `┃ NN │ testMethod … │ description …                  │ PASS     ┃`
- **Status:** `PASS`, `FAIL`, or `SKIP` padded to 8 columns
- **Truncate** long names with `…` (one display character)

```bash
php scripts/generate-test-summary-table.php "YourTestClass" <<'EOF'
section	Live database (read-only SELECT)
01	testFoo	one-line proof	PASS
section	Guards
99	testThisSuiteIsReadOnly	no INSERT/UPDATE in file	PASS
EOF
```

Paste output into the class docblock (` * ` prefix on each line).

**Canonical example:** `app/tests/ApiProviderLiveIntegrationTest.php` (lines 31–62).

### 3. Input/Output on every test method

```php
/**
 * Input:  what goes in (tables, config keys, HTTP endpoint)
 * Output: what is asserted
 */
public function testSomething() { ... }
```

### 4. Read-only guard test

Add `testThisSuiteIsReadOnly()` that calls:

```php
apiProviderLiveProbe_assertReadOnlySource(__FILE__);
```

Place anchor comment `// Live DB helpers (read-only SELECT only)` before any private helpers that run SQL.

## Live DB rules

- Credentials: `app/config/envlocal/database.php` only — **never commit**
- Queries: `SELECT` only on `shohozlive` / `nabillive`
- Skip class in `setUpBeforeClass` if envlocal missing: `apiProviderLiveProbe_getPdo()` throws `RuntimeException`
- Do **not** instantiate provider classes for API checks (side effects) — use `apiProviderLiveProbe_verifyProvider()`

## HTTP probe rules

- Auth + one lightweight GET/POST per provider (cities, routes, token)
- No booking, seat block, or sync calls
- Config: `apiProviderLiveProbe_loadConfig(true)` for credential checks; `loadConfig(false)` for HTTP probes (production base URLs)

## Run tests

```bash
# All live integration tests (needs docker php + envlocal)
./scripts/run-tests.sh ApiProviderLiveIntegrationTest

# Quick CLI table (same probes, no PHPUnit)
docker exec php php /var/www/Ticket/bus/app/tests/TestEngine/toolkit/verify-active-api-providers.php
```

## Refresh header after green run

Headers update **automatically** when you use `./scripts/run-tests.sh`:

```bash
./scripts/run-tests.sh ApiProviderLiveIntegrationTest
./scripts/run-tests.sh NabilProviderTripIdTest
./scripts/run-tests.sh    # beautifies all *Test.php headers after full suite
```

Manual run (e.g. after raw `phpunit`):

```bash
phpunit app/tests/FooTest.php 2>&1 | tee /tmp/out.txt
./scripts/TestCaseBeautifier.sh FooTest /tmp/out.txt
```

`TestCaseBeautifier.sh` updates the **Test Output** block and converts markdown tables to the **boxed** format (or updates boxed Status column).

## Adding a new provider probe

1. Add `case 'provider-name':` in `apiProviderLiveProbe_verifyProvider()` in `ApiProviderLiveProbe.php`
2. Add `testProviderNameApiAuthAndProbeOnLive()` in `ApiProviderLiveIntegrationTest.php`
3. Add numbered row to the boxed summary table (correct section)
4. Run tests and refresh header

## When generating a new test file

Always produce:
1. Test Output block
2. **Boxed** summary table (not markdown `| col |` pipes)
3. Section groups (`▸ Live database`, `▸ Live API`, `▸ Guards`, etc.)
4. Input/Output on every `test*` method
5. `testThisSuiteIsReadOnly` as the last numbered row in Guards section
