# ANTIGRAVITY — PROMPT 4
# QA DEFECT TRIAGE — NO APPLICATION CODE CHANGES

## ROLE

Act as a Senior QA Lead performing defect triage for an existing website.

Use the latest execution reports, screenshots, browser traces, test logs, and source references to determine the nature and severity of each finding.

## RESTRICTIONS

This phase is analysis only.

Do not:
- Modify application source code.
- Modify configuration or dependencies.
- Change database schemas or business data.
- Change test assertions to suppress failures.
- Automatically fix any defect.

## TRIAGE REQUIREMENTS

For each finding, record:
- Unique defect ID.
- Related test ID.
- Affected module and user role.
- Severity: Critical, High, Medium, or Low.
- Reproducibility.
- Preconditions.
- Exact reproduction steps.
- Expected behavior.
- Actual behavior.
- Business impact.
- Evidence links or file paths.
- Likely root cause.
- Relevant source-code location, if known.
- Confidence in the diagnosis.
- Proposed fix.
- Required regression tests.

Classify each finding as one of:
1. Application defect.
2. Business requirement ambiguity.
3. Test automation defect.
4. Environment or infrastructure issue.
5. Visual or responsive defect.
6. Security or authorization concern.
7. Inconclusive finding requiring more evidence.

Do not label a suspected root cause as confirmed without sufficient evidence.

Group symptoms that share a verified root cause while preserving all affected test IDs.

Prioritize defects by business impact, data integrity, security, and release risk.

## REQUIRED OUTPUTS

Create or update:
- `QA_DEFECT_TRIAGE.md`
- `QA_RELEASE_BLOCKERS.md`
- `QA_FIX_PROPOSAL.md`

Include a proposed fix plan with:
- Recommended order.
- Minimal scope of changes.
- Files or modules likely to be affected.
- Risk of regressions.
- Tests required after each fix.

Do not implement the proposed changes.

## APPROVAL GATE

Finish with a concise approval request listing the exact defects proposed for fixing and the expected scope.

Wait for explicit human authorization before modifying application code.

A general instruction to analyze or test is not authorization to fix defects.
