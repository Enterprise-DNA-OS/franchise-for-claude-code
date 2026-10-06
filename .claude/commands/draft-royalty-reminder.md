---
description: Draft a reminder to a franchisee whose sales report or royalty payment is late. Drafts to drafts/; a person sends.
---

1. Run `node scripts/franchise.mjs site "<site>" --json`. Read the royalties, the notes and any open breach notice.
2. If a breach notice is already open, stop and say so: the next step is the notice process, not a reminder.
3. Write `drafts/royalty-reminder-<site ref>-<YYYY-MM-DD>.md`: short and plain. The months, the sales report or amount outstanding for each in the site's currency, the due dates, how to pay or report, and an offer to talk if trading is tight. Use the notes: if the franchisee said why, acknowledge it.
4. No threats, no legal language. A person reads and sends.
