---
description: Write up a field visit for the franchisee - the score, what was good, each finding with its due date, and what happens next. Drafts to drafts/; a person sends.
---

1. Run `node scripts/franchise.mjs site "<site>" --json` and `node scripts/franchise.mjs findings --all --json`, and take the visit's own record.
2. Write `drafts/visit-<V-ref>.md`: the date and who visited, the score and how it compares with the last visit, two or three things done well, each finding with its severity and due date, and how to show it is fixed (a photo, a log, a service report).
3. Encouraging and specific. A critical finding is stated plainly at the top.
4. For a printed copy in the brand: `npm run docs -- visit-report`.
