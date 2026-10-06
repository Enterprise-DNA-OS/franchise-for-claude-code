---
description: Who owes what - royalties and marketing levy past their due date by site, oldest first, and the sales reports that have not come in.
---

1. Run `node scripts/franchise.mjs arrears --json`.
2. Two tables: arrears by site (months behind, amount, oldest in days, in the site's currency), then reports not received.
3. For each site, read `site "<name>"` notes and any open breach notice before suggesting a step. A site already under a breach notice is handled through `/breaches`, not another reminder.
4. Suggest one step per site: a call, `/draft-royalty-reminder`, or a breach notice through `/draft-breach-notice` when the agreement allows it. The operator decides.
