---
description: The whole network on one page - every site's sales trend against the quarter before, arrears, last visit score, open findings, open tickets and agreement state.
---

1. Run `node scripts/franchise.mjs network --json` (add `--all` to include closed sites).
2. Lead with what stands out: sites down 10% or more on the quarter, sites in arrears, the lowest visit scores, agreements in NOTICE LATE or COOLING OFF.
3. Then the table: site, franchisee, sales for the last three months in the site's own currency, trend, arrears, last visit score, findings, tickets, agreement state. Never add AUD and NZD together.
4. A blank trend means a month in either quarter is unreported: say which site and point at `/royalties`.
5. Offer `/site <name>` for any site the operator wants to open up, and `npm run view` for the printed week.
