---
description: Open findings from field visits, critical first - what was found, at which site, when it is due, and closing each one on evidence.
---

1. Run `node scripts/franchise.mjs findings --json` (`--all` for closed ones too).
2. Critical first, then major, then minor; overdue ones loud, with days late.
3. A finding closes only on evidence: `node scripts/franchise.mjs findings close <ref> --evidence="what showed it was fixed"`. A franchisee saying it is done is not evidence. Ask what was seen: a photo, a service report, a log.
4. A critical food safety finding that stays open is a conversation today, by phone, not an email.
