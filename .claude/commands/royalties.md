---
description: The monthly royalty run - last month's sales reports, royalty and marketing levy per site, and anything overdue or unreported. Records reported sales and payments.
---

1. Run `node scripts/franchise.mjs royalties --json` (or `--month=2026-09`, or `--site=<name>`).
2. Show the run as a table per currency: site, sales, royalty, levy, balance, state. Totals per currency, never mixed.
3. Call out NOT REPORTED and OVERDUE first, with the days.
4. To record a franchisee's report: `node scripts/franchise.mjs royalties report "<site>" --period=YYYY-MM --sales=<dollars>`. The royalty and levy follow from the agreement's rates and any monthly minimum. Read the result back.
5. To record money in: `node scripts/franchise.mjs royalties paid "<site>" --period=YYYY-MM [--amount=]`. Without `--amount` it pays the balance in full.
6. For a franchisee who is behind, offer `/draft-royalty-reminder`. Nothing is sent from here.
