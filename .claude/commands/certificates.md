---
description: Certificates each site must hold (food safety supervisor, food control plan training, brand induction) - expired and expiring, and recording renewals.
---

1. Run `node scripts/franchise.mjs certs --json` (`--all` for every certificate).
2. Expired first, then expiring inside 90 days, by site and holder.
3. Record a renewal or a new holder: `node scripts/franchise.mjs certs add --site="<site>" --holder="<name>" --expires=YYYY-MM-DD [--kind="Food safety supervisor"]`.
4. An expired food safety supervisor certificate at a trading site is a call to the franchisee today.
