---
description: Bring the network across from Naranga (or any franchise system that exports CSV) - locations, franchisees, agreement dates and franchise sales leads. The import is the first audit.
---

1. Read `docs/replace-naranga.md` first: which files to gather, what maps by column name, what stays behind.
2. Always dry-run first: `node scripts/franchise.mjs import naranga --locations=<locations.csv> [--leads=<leads.csv>] --dry-run --json`. Walk the operator through the counts, every problem row, and every column the import did not use.
3. Unused columns that matter (a territory code, a second contact, a custom field) are a `/customise` job before the real import, not after.
4. Then for real, without `--dry-run`. Re-running is safe: sites match on their location number, leads on their lead id or email.
5. After it lands:
   - record each franchisee's insurance expiry (`franchisees insurance`)
   - add agreement dates for any site the import could not date, so the end of term clock runs
   - add disclosure dates for any lead that had a disclosure document; the import never assumes one
   - load the last few months of sales (`royalties report`) so the trend and arrears work
6. Then run `/attention` and show the operator what the old system never told them.
