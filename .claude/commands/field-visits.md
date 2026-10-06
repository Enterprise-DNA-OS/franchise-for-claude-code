---
description: Field visits and quality audits - which sites are due or overdue a visit, what is booked, and recording a visit with its score and findings.
---

1. Run `node scripts/franchise.mjs visits --json` (`--days=60` to look further ahead).
2. Show the overdue sites first with their field manager, then what is due in the window, then what is booked.
3. To book: `node scripts/franchise.mjs visits schedule "<site>" --on=YYYY-MM-DD [--by="<field manager>" --kind=quality|food safety|brand|opening|mystery shop]`.
4. After a visit: `visits complete <V-ref> --score=<0-100> --summary="..."`, then one `findings add <V-ref> --item="..." --severity=critical|major|minor [--due=]` per finding. Critical findings default to two days, major to 14, minor to 30.
5. Offer `/draft-visit-report` to write up the visit for the franchisee.
