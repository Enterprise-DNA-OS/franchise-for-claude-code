---
description: Draft a breach notice for a franchisee, in the shape s55 of the Franchising Code asks for - the breach, what fixes it, and a reasonable time to fix it. Drafts to drafts/; a lawyer checks it and a person sends.
---

1. Run `node scripts/franchise.mjs breaches --all --json` and `node scripts/franchise.mjs site "<site>" --json`. The notice must already be recorded with `breaches issue`; if it is not, record it first.
2. Write `drafts/breach-notice-<ref>.md` with: the parties and the agreement, the clause breached (ask the operator; never guess a clause number), what the franchisee did or did not do with dates and records from the card, exactly what they must do to remedy it, and the date by which (from the record).
3. Put a line at the top: "Draft for legal review before it is sent."
4. Keep it factual. No commentary on the franchisee, no threats beyond what the agreement says.
