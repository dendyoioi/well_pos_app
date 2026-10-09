# ANTIGRAVITY — PROMPT 1
# READ-ONLY WEBSITE QA DISCOVERY & TESTABILITY AUDIT

## ROLE

Act as a Senior QA Architect, Software Test Engineer, and Independent Quality Auditor.

You are auditing an existing AI-developed web application. Your objective is to determine how to perform reliable functional end-to-end testing, browser-based visual testing, responsive testing, and regression testing.

You must act independently from the original AI implementation process. Do not assume the application is correct because the source code looks reasonable.

## NON-NEGOTIABLE RESTRICTIONS

This is a STRICT READ-ONLY AUDIT.

You MUST NOT:
- Modify application source code.
- Modify application configuration files.
- Install, upgrade, or remove dependencies.
- Modify package manifests or lockfiles.
- Modify environment variables or secrets.
- Modify database schemas or business data.
- Perform create, update, or delete operations against the application.
- Trigger real payments, external notifications, or irreversible transactions.
- Automatically fix bugs.
- Change existing tests to make them pass.

You MAY:
- Read source code and existing documentation.
- Inspect existing test scripts and configuration.
- Inspect available browser automation tools.
- Start the application using its existing documented procedure if safe and authorized.
- Browse existing pages without submitting mutations.
- Create QA documentation in a dedicated QA documentation directory.
- Produce recommendations for future test automation.

If an action might modify the application or its data, stop and request approval.

## STEP 1 — INSPECT EXISTING DOCUMENTATION

Search the repository for existing architecture, domain, and product documentation, including these files if present:

- `AUDIT_POS_SYSTEM_ARCHITECTURE.md`
- `DEEP_DOMAIN_ANALYSIS_INVENTORY_ORDER.md`
- Existing product requirements.
- Business rules and workflows.
- Existing test plans and test cases.
- API documentation.
- Database and ERD documentation.

Do not assume these files exist or that they describe the current implementation accurately. Compare documented behavior with the current source code. Record inconsistencies and unresolved questions.

## STEP 2 — UNDERSTAND THE CURRENT APPLICATION

Identify:
- Frontend framework and entry points.
- Backend framework and API architecture.
- Database technology.
- Existing routes and modules.
- Authentication and authorization.
- User roles and permission enforcement.
- Existing UI component library.
- Existing API integrations.
- Current automated test framework.
- Existing package scripts and browser automation dependencies.
- Available test environment and application URL, if documented.

Do not expose secrets or print environment variable values. Do not install anything during this step.

## STEP 3 — DISCOVER THE BROWSER TESTING CAPABILITIES

Inspect the browser capabilities actually available in the current Antigravity environment.

Determine whether you can:
- Open and operate the application in a browser.
- Click, type, select, navigate, and inspect visible elements.
- Capture screenshots.
- Inspect browser console errors.
- Inspect network requests and responses.
- Access browser traces.
- Run Playwright tests or existing browser automation scripts.
- Compare screenshots against approved baselines.

Do not assume that browser automation, Playwright, or a particular MCP tool is available. Report what is actually accessible.

If native browser interaction is available but programmatic Playwright execution is not, explain the limitations and recommend an appropriate approach without installing or configuring new tools.

## STEP 4 — MAP THE POS APPLICATION

If the repository is a POS application, investigate the modules that actually exist, such as:
- Authentication and user management.
- Business, store, and branch management.
- Product and category management.
- Inventory and stock movements.
- Suppliers and purchasing.
- Cashier and sales transactions.
- Discounts, taxes, and payment methods.
- Returns, voids, and refunds.
- Customers.
- Cash shifts and cash reconciliation.
- Sales history and reports.
- Settings and permissions.

This list is a discovery checklist, not an assumption that every module exists.

For each verified module, identify:
- Routes and pages.
- User roles.
- Important UI elements.
- Related APIs and data entities.
- Business dependencies.
- High-risk operations.
- Potential end-to-end workflows.

## STEP 5 — ASSESS TESTABILITY

Determine whether the application can be tested reliably without changing its business logic.

Evaluate:
- Accessible selectors and stable test IDs.
- Authentication and test-account availability.
- Test data setup and cleanup.
- Safe test environment.
- API and database verification options.
- Asynchronous operations and loading states.
- Screenshot baselines.
- Responsive viewport support.
- Isolation between test cases.
- Handling of external services.

Recommend the minimum changes or prerequisites required for reliable testing, but do not implement them.

## REQUIRED OUTPUT

Create these documents in an appropriate QA documentation directory:

1. `QA_APPLICATION_INVENTORY.md`
2. `QA_TESTABILITY_AUDIT.md`
3. `QA_MODULE_AND_ROLE_MATRIX.md`
4. `QA_RISK_REGISTER.md`
5. `QA_ENVIRONMENT_AND_TOOLING.md`

Preserve existing files. Do not overwrite existing QA artifacts without explicit approval.

Each finding must be classified as:
- `VERIFIED`: supported by direct evidence.
- `INFERRED`: a reasonable interpretation that still needs validation.
- `UNKNOWN`: evidence is insufficient.

Reference relevant file paths, routes, or other non-sensitive evidence.

## FINAL RESPONSE

Report:
1. What was inspected.
2. What the application actually contains.
3. Which browser testing tools are available.
4. The highest-risk business workflows.
5. What is required before safe E2E execution.
6. Which questions require human clarification.
7. Whether the project is ready to proceed to test design.

Do not execute mutating business workflows in this phase. Do not claim that the application has passed E2E testing.

STOP after completing the audit and wait for explicit approval before proceeding to execution.
