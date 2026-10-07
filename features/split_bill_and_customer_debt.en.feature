Feature: Split Bill, Multi-Tender Payment, and Customer Debt Lifecycle
  As a POS cashier and store owner
  I want to split table bills, accept combined Cash and QRIS payments, and record customer debt
  So that checkout operations accommodate varied guest payment scenarios and credit ledgers remain orderly

  Background:
    Given the cashier is logged in to Flagship Kemang POS terminal
    And an active cashier shift is opened with sufficient starting float

  @happy_path @split_bill @multi_tender
  Scenario: Cashier splits bill and tenders multi-payment combining Cash and QRIS
    When the cashier adds 2 "Kopi Susu Aren Ura" items to the cart
    And clicks the "Split Bill" button on the cart sidebar
    Then the Split Bill modal appears displaying equal split and per-item calculators
    When the cashier proceeds to the payment modal and selects the "Split" tab
    And configures Cash portion as Rp 25,000 and the remaining QRIS portion as Rp 25,600
    And tenders exact cash received of Rp 25,000
    And confirms QRIS payment verification
    And clicks "Selesaikan Pembayaran Split"
    Then the order completes successfully with PAID status
    And the receipt displays multi-tender breakdown of Cash Rp 25,000 and QRIS Rp 25,600

  @sad_path @customer_debt @debt_lifecycle
  Scenario: Cashier records debt for registered customer and settles it in Backoffice
    When the cashier adds menu items to the cart
    And opens the payment modal selecting the "Kasbon" tab
    Then the system validates and flags that a customer must be selected
    When the cashier selects registered customer "Budi Santoso"
    And sets a 7-day due date with memo "Office lunch credit"
    And clicks "Simpan Piutang Kasbon"
    Then the debt order is saved successfully with UNPAID status
    And a credit receipt is generated with due date terms
    When the owner navigates to Backoffice "Pelanggan & Member" -> "Buku Piutang & Kasbon Pelanggan"
    Then the debt record for "Budi Santoso" appears with UNPAID status
    When the cashier clicks "Pelunasan", enters full settlement amount in Cash, and confirms
    Then the debt record transitions to PAID status

  @bad_path @split_validation_underpaid
  Scenario: System blocks split payment completion when tendered cash is insufficient
    When the cashier opens the "Split" payment tab for a cart
    And sets a Cash portion of Rp 25,000
    But tenders only Rp 10,000 in cash
    Then the "Selesaikan Pembayaran Split" button is disabled
    And the red indicator warns "Uang Tunai Kurang" by "- Rp 15,000"
