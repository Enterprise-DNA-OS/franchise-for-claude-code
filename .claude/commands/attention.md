---
description: Everything that wants a decision this morning, worst first. A signing inside the disclosure window, a late end of term notice or an open critical finding outranks everything, then royalties overdue and unreported, breach notices running out and the year end deadlines.
---

1. Run `node scripts/franchise.mjs attention --json`.
2. Present it worst first, grouped by reason, in plain words. Anything rank 1 (signed inside 14 days of disclosure, end of term notice late, a critical finding past its date) is today's first call: say so in the first line.
3. For each group, give the one action that clears it: `agreements notice <ref> --intent=`, `findings close <ref> --evidence=`, `royalties paid <site> --period=`, `royalties report <site> --period= --sales=`, `/draft-royalty-reminder`, `fund statement --prepared`, `franchisees insurance <who> --expires=`, `certs add`, `visits schedule <site> --on=`, `tickets assign <ref> --to=`, `log P-xxx --body=`.
4. A transfer or agreement signed inside 14 days of disclosure cannot be undone from here. Say plainly that it needs the franchisor's lawyer, and keep the record as it is.
5. If the list is empty, say so in one line and stop.
