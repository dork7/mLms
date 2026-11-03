# 18: Fees and Payment Records

**What to build:** The Admin defines Fees, applies them to a Grade or to specific Students, and logs Payment Records. Fee Status is worked out from the Payment Records. Students see their own Fees.

**Blocked by:** 06 (Enrollment)

**Status:** resolved

- [x] The Admin defines a Fee with its name, amount in AED and due date
- [x] Applying a Fee to a Grade or to specific Students creates Fee Assignments
- [x] The Admin logs a Payment Record with its amount, date, method (cash, bank transfer or cheque) and reference
- [x] Fee Status is worked out, never stored: Waived if waived, otherwise Paid if payments ≥ the amount, Partially Paid if payments > 0, otherwise Unpaid
- [x] The Admin can waive a Fee Assignment
- [x] A Student sees their own Fee Assignments and Payment Records
- [x] Teachers, including Class Teachers, are refused all Fee data
