---
description: The franchise sales pipeline - enquiries, qualified buyers, discovery days and disclosure given, with the date each buyer may sign from, quiet leads, and moving a prospect through.
---

1. Run `node scripts/franchise.mjs prospects --json` (`--all` includes signed and lost).
2. Show by stage, disclosure given first, with the date each may sign from (14 days after disclosure, s23). Leads quiet more than 14 days are named.
3. New enquiry: `prospects add --name= --email= --phone= --territory= --source=`. Disclosure document sent: `prospects disclose <ref>`. Other moves: `prospects stage <ref> --to=qualified|"discovery day"|signed|lost [--reason=]`. Signing is refused inside 14 days of disclosure.
4. Log every call: `log P-xxx --body="..." --kind=call`.
5. Never promise earnings, territory exclusivity or approval to a prospect in a draft. Those statements belong in the disclosure document, checked by the franchisor's lawyer.
