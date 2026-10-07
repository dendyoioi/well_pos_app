Feature: Multi-Channel Financial Reconciliation and End-of-Shift Cash Drawer Audit
  As a Merchant Owner and Cashier
  I want to close the cashier shift with physical cash drawer reconciliation, Z-Report generation, and audit logging
  So that cash discrepancies are detected immediately, drawer reconciliation is verified, and the financial audit log is transparent

  Background:
    Given the cashier is logged in at the POS terminal with an active open shift
    And the cashier has processed cash sales transactions in the active outlet

  Scenario: [Happy Path] Cashier closes shift with matching physical cash and publishes synchronized Z-Report
    When the cashier clicks the "Tutup Shift" button in the POS terminal header
    Then the "Rekap Kas Fisik di Laci" modal opens displaying system-calculated expected cash
    When the cashier enters actual physical cash matching the expected cash amount
    And the cash discrepancy status indicates "Status Kas: COCOK (PAS)"
    And the cashier clicks "Kunci & Tutup Shift (Z-Report)"
    Then the system generates the official "Z-REPORT TUTUP SHIFT" thermal preview
    And the merchant owner views the Shifts Audit backoffice to verify the shift status is "CLOSED" with a difference of "Rp 0"

  Scenario: [Sad Path] Cashier closes shift with cash deficit discrepancy and logs the required explanation notes
    When the cashier clicks the "Tutup Shift" button in the POS terminal header
    And enters actual cash that is Rp 20,000 less than the system expected cash
    Then the system displays a warning badge "Status Kas: KURANG (DEFISIT)" with difference "-Rp 20.000"
    When the cashier inputs handover explanation note "Ada selisih uang kembalian pecahan receh"
    And the cashier clicks "Kunci & Tutup Shift (Z-Report)"
    Then the Z-Report records the deficit discrepancy "-Rp 20.000 (DEFISIT)" along with the explanation notes
    And the Shifts Audit view in Backoffice marks the session with a red badge "Kurang (Short)"

  Scenario: [Bad Path] System validation rejects negative cash input and blocks invalid shift closure
    When the cashier clicks the "Tutup Shift" button in the POS terminal header
    When the cashier attempts to input negative cash amount "-50000"
    Then the validation error prompt displays "Nominal uang fisik tidak boleh negatif"
    And the shift closure process is prevented until valid cash is provided
