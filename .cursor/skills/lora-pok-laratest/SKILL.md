---
name: lora-pok-laratest
description: Automatically run Laravel tests whenever test files are modified across all Laravel versions
---

# LoraPok LaraTest

## Overview

This skill automatically runs Laravel tests whenever test files are modified, working seamlessly across all Laravel versions. It detects the test folder automatically and executes tests using Laravel's built-in testing capabilities. The primary goal is to provide immediate feedback on test results after making changes to test files, helping developers catch issues early in the development cycle.

**Announce at start:** "I'm using the LoraPok LaraTest skill to automatically execute tests when test files are modified in your Laravel project."

## Guidelines

### When to Use This Skill
- You want immediate feedback when editing test files in any Laravel version
- You're working with a PHP Laravel project that uses standard testing conventions
- You want to ensure test files are properly structured to trigger auto-run functionality
- You're debugging issues with the auto-run functionality
- You need cross-version compatibility with Laravel testing

### How It Works
The skill triggers when files in the test directory are edited. It automatically detects the standard `tests/` directory in Laravel projects and executes tests accordingly using Laravel's native `php artisan test` command. It works with all Laravel versions that support this command.

### Supported Operations
- **View existing test files**: Shows contents of test files in the project's test directory
- **Create new test files**: Helps create test files that will trigger auto-run functionality
- **Edit existing test files**: Assists in editing test files to ensure auto-run triggers properly
- **Check test runner configuration**: Examines the test runner setup and configuration
- **Debug issues**: Helps troubleshoot when auto-run isn't working
- **Version compatibility check**: Verifies compatibility across all Laravel versions

### File Patterns
The skill monitors files matching:
- `{project-root}/tests/*` - Standard Laravel test directory structure
- Supports both `Feature` and `Unit` test directories
- Works with any test file naming convention used in Laravel
- Automatically detects test directory regardless of Laravel version

### Command Execution
When triggered, the skill executes:
```bash
php artisan test {test-class-name}
```

With intelligent timeout handling to prevent hanging while maintaining compatibility across all Laravel versions.

## Examples

### Example 1: Viewing Existing Test Files
```bash
# To see what test files exist
find tests/ -name "*.php" -type f

# To view contents of a specific test file
cat tests/Feature/UserTest.php
```

### Example 2: Creating a New Test File
```bash
# Create a new test file that will trigger auto-run
touch tests/Feature/NewFeatureTest.php

# Add basic test structure compatible with all Laravel versions
echo "<?php\n\nuse Tests\TestCase;\n\nclass NewFeatureTest extends TestCase {\n\n    public function testExample()\n    {\n        \$this->assertTrue(true);\n    }\n\n}" > tests/Feature/NewFeatureTest.php
```

### Example 3: Editing an Existing Test File
```bash
# Make an edit to trigger auto-run
echo "\n\n    public function testUpdatedFeature()\n    {\n        \$this->assertEquals(2, 1+1);\n    }" >> tests/Feature/UserTest.php
```

### Example 4: Checking the Test Runner Configuration
```bash
# Check PHP artisan test availability across all Laravel versions
php artisan test --help

# Verify test directory structure
ls -R tests/

# Test running a command manually with specific file
php artisan test tests/Feature/UserTest.php

# Check Laravel version for compatibility
php artisan --version
```

### Example 5: Debugging Auto-Run Issues
```bash
# Check if the test directory exists
ls -la tests/

# Verify PHP artisan test works across Laravel versions
php artisan test

# Test running the command manually with specific file
php artisan test tests/Feature/UserTest.php

# Check PHP version compatibility
php -v

# Verify Laravel version compatibility
php artisan --version
```

### Example 6: Version Compatibility Check
```bash
# Check Laravel version
php artisan --version

# Test with different Laravel versions
# For Laravel 8+
php artisan test

# For Laravel 9+
php artisan test --phpunit=10.0

# For Laravel 10+
php artisan test --phpunit=10.4
```

## Remember

- **Laravel compatibility**: Works with all Laravel versions that support `php artisan test`
- **Automatic test directory detection**: Intelligently detects the standard `tests/` directory regardless of Laravel version
- **Timeout handling**: Smart timeout management ensures the skill doesn't hang indefinitely
- **Naming conventions**: Follows Laravel's standard test file naming conventions
- **Immediate feedback**: Auto-running tests provides instant feedback on test results after edits
- **No external dependencies**: Uses Laravel's built-in testing capabilities only
- **Cross-version support**: Works seamlessly across all Laravel versions from 5.x to latest
- **Configuration-free**: No additional configuration needed - detects and works automatically