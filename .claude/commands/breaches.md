---
description: Breach notices under the Franchising Code - open notices and their remedy dates, issuing a new one, recording that it was remedied, and the termination gate.
---

1. Run `node scripts/franchise.mjs breaches --json` (`--all` for closed ones).
2. Show each open notice: site, franchisee, breach, remedy, remedy by, days left.
3. To record a new notice after the operator decides: `node scripts/franchise.mjs breaches issue <agreement or site> --breach="..." --remedy="..." [--days=30]`. Under 30 days is allowed but flagged: s55 says the time must be reasonable and need not be more than 30 days. Then `/draft-breach-notice`.
4. `breaches remedied <ref>` or `breaches withdraw <ref>` when it is resolved.
5. `breaches terminate <ref>` is refused until the remedy date has passed. Even then, say that termination should be checked by the franchisor's lawyer before the letter goes, and that the franchisee may dispute it.
