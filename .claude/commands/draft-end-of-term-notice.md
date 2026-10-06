---
description: Draft the end of term notice the Franchising Code (s36) requires - telling the franchisee whether the franchisor intends to extend or enter a new agreement. Drafts to drafts/; a person sends.
---

1. Run `node scripts/franchise.mjs renewals --json` and `node scripts/franchise.mjs site "<site>" --json`.
2. Ask the operator for the decision if it is not on record: extend, renew, not extend, or undecided.
3. Write `drafts/end-of-term-<agreement ref>.md`: the agreement, the date the term ends, the franchisor's intention, and what happens next (for a renewal, that a disclosure document will follow at least 14 days before anything is signed; for not extending, what happens with the site and any restraint, which the lawyer confirms).
4. Then record it once sent: `node scripts/franchise.mjs agreements notice <ref> --intent=... --on=<date sent>`.
