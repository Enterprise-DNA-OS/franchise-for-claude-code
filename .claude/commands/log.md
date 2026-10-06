---
description: Record a call, email, meeting, visit or note against a site, a franchisee or a prospect.
---

1. Work out who it is about. A site name or ref, a franchisee name, or a prospect ref (P-901).
2. Run `node scripts/franchise.mjs log "<site|franchisee|P-ref>" --body="<what happened, in one or two sentences>" --kind=call|email|meeting|visit|note [--by="<staff>"]`.
3. Confirm in one line. If the note contains a promise ("will pay by Friday", "wants to extend"), suggest the follow-up: a reminder, a renewal check, a ticket.
