---
description: The franchise support desk - open tickets by priority and age, unassigned ones loud, and opening, assigning and resolving tickets.
---

1. Run `node scripts/franchise.mjs tickets --json` (`--all` for resolved).
2. Urgent and high first. Unassigned tickets and anything older than its priority allows (urgent a day, high three, normal seven) are named.
3. Open: `tickets add --site= --subject= [--priority=urgent|high|normal|low --category= --owner=]`. Assign: `tickets assign <ref> --to=`. Resolve: `tickets resolve <ref> --resolution="what fixed it"`.
4. A ticket that keeps coming back across sites is a pattern: say so and suggest a note in the operations manual.
