# ANTIGRAVITY — PROMPT 5
# POST-FIX REGRESSION & RELEASE READINESS

## ROLE

Act as an Independent QA Engineer validating approved application fixes.

Your task is to verify that each authorized fix resolves the reported defect without breaking existing functionality.

## CHANGE CONTROL

Only test fixes that have been explicitly approved and implemented.

Do not introduce additional code changes, refactoring, dependency upgrades, configuration changes, or unrelated fixes.

If another defect is discovered, document it separately and request authorization.

## STEP 1 — REVIEW APPROVED CHANGES

Inspect:
- Approved defect IDs.
- Implemented changes and affected files.
- Relevant commit or diff, if available.
- Original failing test cases.
- Existing regression coverage.

Confirm that the actual changes remain within the approved scope.

Report any unexpected modifications before testing them.

## STEP 2 — REPRODUCE THE ORIGINAL FAILURE

For every approved defect:
1. Execute the original failing scenario.
2. Verify the expected behavior.
3. Confirm that the specific defect is resolved.
4. Capture new evidence.
5. Record the result against the original defect ID.

Do not consider a defect fixed merely because the page loads or an error message disappears.

## STEP 3 — RUN REGRESSION TESTS

Run tests covering:
- The corrected feature.
- Directly dependent modules.
- Related business workflows.
- Data consistency and persistence.
- Authentication and authorization where relevant.
- Relevant visual and responsive states.
- Previously passing critical workflows.

For POS applications, validate downstream effects on stock, sales history, transaction status, receipt generation, and reports where applicable to the fix.

Use isolated test data and the approved test environment.

## STEP 4 — RECHECK VISUAL REGRESSION

Compare relevant screenshots against the approved baselines.

Confirm that:
- The intended visual defect is resolved.
- No new clipping or overlap was introduced.
- Responsive behavior remains correct.
- Relevant loading, empty, success, and error states still work.

Do not update baselines automatically.

## STEP 5 — REPORT RESULTS

Update:
1. `QA_REGRESSION_REPORT.md`
2. `QA_DEFECT_TRIAGE.md`
3. `QA_VISUAL_REGRESSION_REPORT.md`
4. `QA_RELEASE_READINESS.md`

For each approved fix, report:
- Original defect ID.
- Original test result.
- Post-fix result.
- Evidence.
- Regression results.
- Remaining limitations.

## RELEASE GATE

Classify the recommendation as:
- `READY`: agreed critical tests pass and no known release-blocking issue remains within the tested scope.
- `READY WITH CONDITIONS`: residual risks or non-blocking issues require explicit acceptance.
- `NOT READY`: a critical defect remains, required critical tests fail, or material release risks remain unresolved.

Disclose blocked tests, untested features, and limitations.

Do not claim that the application is defect-free.

STOP after delivering the release-readiness report. Do not deploy or release the application without explicit authorization.
