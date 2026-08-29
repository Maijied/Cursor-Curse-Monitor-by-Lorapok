# Bus PHPUnit Test Template

See: `app/tests/TESTING-GUIDE.md`

```bash
./test                              # all (beautify + logging ON by default)
./test Nabil                        # short class name
./test Nabil --filter testMethod    # one method
./test --no-beautify                # skip header beautifier
./test --no-log                     # skip log files
./test new MyFeatureTest "desc"     # scaffold
./test list Api                     # find classes
```

Logs: `storage/logs/tests/Test-{ClassName}-YYYY-MM-DD.log`  
Full suite: `storage/logs/tests/Test-BusTestSuite-YYYY-MM-DD.log` + per-class logs
