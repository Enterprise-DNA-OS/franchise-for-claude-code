---
description: Agreements ending in the next year, with the date the end of term notice is due under the Franchising Code (6 months before the end of a term of 6 months or more, else 1 month), and recording the notice.
---

1. Run `node scripts/franchise.mjs renewals --json` (`--days=730` to look further).
2. Show each agreement: site, franchisee, term ends, notice due by, notice given and intent. NOTICE LATE first, then NOTICE DUE.
3. Before any notice, read the site card (`/site`) and the notes: what the franchisee has said about staying, sales trend, visit scores, arrears, breach history. Summarise it for the operator; the decision to extend or not is theirs.
4. When the operator decides: `/draft-end-of-term-notice` drafts the letter, then `node scripts/franchise.mjs agreements notice <ref> --intent=extend|renew|"not extend"|undecided` records that it was given.
5. A renewal or extension needs a fresh disclosure document 14 days before signing: `agreements add --site= --franchisee= --kind=renewal`, then `agreements disclose`, then `agreements sign` once 14 days have passed.
