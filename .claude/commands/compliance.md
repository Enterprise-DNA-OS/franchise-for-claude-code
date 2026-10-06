---
description: Check the records against the rules a franchisor lives under (the Franchising Code of Conduct's disclosure, notice, fund and breach rules, plus insurance, certificates, reporting and critical findings) and report what is breached, with the rule cited.
---

1. Run `node scripts/franchise.mjs compliance --json`. Each rule carries its source; the full list is in `docs/compliance.md`.
2. Report as a table: rule, breaches, the worst example, the source. Breached first, clean last.
3. For anything breached, give the fix the operator can approve: the record to update, the notice to draft (to `drafts/`, never sent), the call to make.
4. A signing inside the 14 day disclosure window cannot be repaired by editing the record. Say it needs the franchisor's lawyer.
5. If a rule in `docs/compliance.md` looks out of date, say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc and the check in `scripts/franchise.mjs` together.

Nothing here is legal advice. It is the rule book the operator points the system at.
