---
description: The franchisor's year end under the Franchising Code - the disclosure document update (s21), the Franchise Disclosure Register (s93), and the marketing fund statement and audit (s31), with each due date and what is done.
---

1. Run `node scripts/franchise.mjs fund --json` and `node scripts/franchise.mjs compliance --json`.
2. For the year just ended, list each deadline with its date and state: disclosure document updated (within four months of year end), Register updated, fund statement prepared (within four months), given to contributing franchisees (within 30 days of preparing), audited or opted out by 75% of contributors.
3. Say which are late and which fall in the next 30 days.
4. As each one is done: `node scripts/franchise.mjs fund statement [--year=2026] --prepared --given --audited --opt-out --disclosure-updated --register-updated` (each takes a date; the default is today).
5. `npm run docs -- fund-statement` renders the fund figures for the accountant. It is a draft for them, not the statement itself.
