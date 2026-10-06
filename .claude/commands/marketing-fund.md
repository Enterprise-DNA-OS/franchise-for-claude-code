---
description: The marketing fund - levies raised and collected, spend by category for the year, and recording spend.
---

1. Run `node scripts/franchise.mjs fund --json` (`--year=2026` for the year to 30 June 2026).
2. Show levied, collected and spent by year, then this year's spend by category. Say plainly that AUD and NZD levies are added together unless the operator has split them.
3. Record spend: `node scripts/franchise.mjs fund spend --amount=<dollars> --category="Digital ads|Creative|Local area marketing|Admin" [--supplier= --note= --on=]`.
4. If spend runs ahead of what has been collected, say so. Franchisees read the fund statement closely.
