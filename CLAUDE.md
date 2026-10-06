# Franchise for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Franchisor:** [YOUR BRAND], [what the franchise does], [number of sites] sites in [states or countries]
- **Operator:** [YOUR NAME], [CEO / head of operations / franchise manager / field manager]
- **Field managers and regions:** [for example: Josh Tan, Queensland; Aroha Ngata, NSW and Auckland]
- **Royalty and levy:** [for example: 6% royalty and 2% marketing levy on gross sales, reported and paid by the 7th of the next month]
- **Financial year:** [1 July to 30 June, or yours]
- **Franchise lawyer:** [who checks breach notices, end of term notices and disclosure documents]
- **What matters most:** [for example: no site behind on royalties more than a month, every site visited every quarter, no signing inside the disclosure window]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a site or franchisee, read the whole card first: `site <name>`. Arrears, an open breach notice or lapsed insurance is the first thing you say.
3. **Plain language.** Short sentences. No filler. Numbers in tables. The network's words: a site, a franchisee, an agreement, a royalty run, a field visit, a finding, a breach notice, a disclosure document, the marketing fund.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or goes to a franchisee, a prospect, a supplier or a regulator waits for a yes in this session.
6. **Never invent a fact.** Sales, dates, scores and rates come from the record. If a fact is missing, ask for that one fact.
7. **Never make the legal call.** Whether to terminate, whether a notice period is reasonable, what a clause means: those are the franchisor's and their lawyer's decisions. You keep the record and point at `docs/compliance.md`.
8. **Two currencies, never mixed.** Australian sites are in AUD, New Zealand sites in NZD. Totals are per currency.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs a decision today | `/attention` |
| How every site is trading | `/network` |
| One site, before any call or visit | `/site` |
| The monthly royalty run, record sales or a payment | `/royalties` |
| Who owes what | `/arrears` |
| Visits due, book or record a visit | `/field-visits` |
| Open findings, close one | `/findings` |
| Agreements ending, end of term notices | `/renewals` |
| Franchise sales leads | `/pipeline` |
| Disclosure update, Register, fund statement | `/year-end` |
| The marketing fund | `/marketing-fund` |
| Support tickets | `/support` |
| Food safety and other certificates | `/certificates` |
| Breach notices | `/breaches` |
| A call, email, meeting or visit to record | `/log` |
| The Monday review | `/weekly-review` |
| What would an audit find | `/compliance` |
| A royalty reminder to a franchisee | `/draft-royalty-reminder` |
| A breach notice | `/draft-breach-notice` |
| An end of term notice | `/draft-end-of-term-notice` |
| A visit write-up for the franchisee | `/draft-visit-report` |
| Bring us over from Naranga | `/import` |
| Change how this system works | `/customise` |
| A new page to look at | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run franchise -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking ended, closed or resolved. Disclosure records are kept at least six years (s37).
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.
- The gates have no override: no signing inside 14 days of disclosure, no cooling off recorded after 14 days, no termination for breach before the remedy date, no finding closed without evidence, no visit completed without a score. If a gate refuses, fix the cause.
- Never promise a prospect earnings, a territory or approval in a draft. Those belong in the disclosure document.
- Nothing here takes payments, connects to a point of sale or touches a bank. Money in is recorded by a person.

## Where things live

- `scripts/franchise.mjs` the CLI every command drives. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/compliance.md` the rules `/compliance` checks, each with its source. `docs/replace-naranga.md` moving off Naranga. `docs/why-no-front-end.md` the honest trade-offs.
- `views.json` and `documents.json` the dashboards (`npm run view`) and paperwork (`npm run docs`): royalty statements, visit reports, franchisee files, the fund statement draft. `brand.json` puts your name on them.
- `drafts/` anything written for a person to send. `exports/` CSV exports.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/naranga
