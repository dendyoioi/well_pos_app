# features/shift_reconciliation.en.feature
# Standard English Gherkin Feature File for Shift Lifecycle & Financial Reconciliation

Feature: Cashier Shift Lifecycle, Cash Movements, Denomination Calculator and Z-Report Reconciliation
  As a Cashier and Store Owner
  I want to manage cash float, cash in/out movements, cash transactions, and physical drawer reconciliation
  So that daily cash accounting is accurate, auditable, and free of cash discrepancies

  Background:
    Given The Cashier is logged into the POS system with active outlet credentials
    And The Cashier is on the POS Terminal screen

  Scenario: [Happy Path] Open shift, record cash in and out, cash transaction, cash denomination breakdown, and close shift MATCH
    When The Cashier starts a new shift with starting cash of "200000"
    And The Cashier records cash in of "50000" with note "Tambahan uang kembalian dari bos"
    And The Cashier records cash out of "20000" with note "Beli es batu kristal"
    And The Cashier completes a cash sales transaction with total "50600"
    And The Cashier opens the close shift modal
    And The Cashier calculates drawer physical cash using denomination breakdown:
      | denomination | count |
      | 100000       | 2     |
      | 50000        | 1     |
      | 20000        | 1     |
      | 10000        | 1     |
      | 500          | 1     |
      | 100          | 1     |
    Then The drawer physical cash total calculates to "280600"
    And The cash reconciliation status badge displays "Status Kas: COCOK (PAS)"
    When The Cashier submits close shift and generates Z-Report
    Then The system completes shift closure and displays the Z-Report summary

  Scenario: [Sad Path] Cash reconciliation with drawer shortage deficit
    When The Cashier starts a new shift with starting cash of "100000"
    And The Cashier completes a cash sales transaction with total "44000"
    And The Cashier opens the close shift modal
    And The Cashier enters drawer physical cash count of "120000"
    Then The cash reconciliation status badge displays "Status Kas: KURANG (DEFISIT)"
    When The Cashier enters note "Uang kembalian receh tercecer belum ditemukan" and submits close shift
    Then The system completes shift closure with financial shortage audit logged

  Scenario: [Bad Path] Security and validation for negative cash and empty movements
    When The Cashier has an active shift
    And The Cashier opens the cash movement form
    And The Cashier attempts to submit cash movement with amount "0" and empty notes
    Then The system displays validation error "Nominal mutasi kas harus lebih besar dari 0"
    When The Cashier opens close shift modal and enters negative cash "-50000"
    Then The system rejects shift closure with error "Nominal uang fisik tidak boleh negatif"
