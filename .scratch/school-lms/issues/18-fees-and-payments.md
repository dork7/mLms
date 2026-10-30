# 18: Fees and Payment Records

**What to build:** The Admin defines Fees, applies them to a Grade or to specific Students, and logs Payment Records. Fee Status is worked out from the Payment Records. Students see their own Fees.

**Blocked by:** 06 (Enrollment)

**Status:** ready-for-agent

- [ ] The Admin defines a Fee with its name, amount in AED and due date
- [ ] Applying a Fee to a Grade or to specific Students creates Fee Assignments
- [ ] The Admin logs a Payment Record with its amount, date, method (cash, bank transfer or cheque) and reference
- [ ] Fee Status is worked out, never stored: Waived if waived, otherwise Paid if payments ≥ the amount, Partially Paid if payments > 0, otherwise Unpaid
- [ ] The Admin can waive a Fee Assignment
- [ ] A Student sees their own Fee Assignments and Payment Records
- [ ] Teachers, including Class Teachers, are refused all Fee data
