<h1 align="center">Franchise for Claude Code</h1>

<p align="center">
  <strong>The open-source franchise network management system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Naranga data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=naranga">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/naranga?utm_source=github&utm_medium=readme&utm_campaign=naranga">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#compliance-checked-against-the-data">Compliance</a> &bull;
  <a href="#ten-questions-naranga-never-answered">Ten questions</a> &bull;
  <a href="#instead-of-naranga">Instead of Naranga</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Franchise for Claude Code does the job franchisors paid Naranga for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and run the network in plain language. It runs the right query, and it answers questions the Naranga dashboard never charted.

Naranga's website no longer loads, and its rivals reported in late 2025 that the software was being wound down. Franchisors on it are now choosing another rented platform or an export. What a franchise network needs to hold is ordinary: franchisees and their sites, agreements with their dates, monthly sales and the royalties they raise, field visits and findings, tickets, certificates, breach notices, franchise sales leads and the marketing fund. That is fourteen Postgres tables, and the reporting the subscription paid for is a handful of SQL views over them.

Want the same thing with a web front end, a field app or a franchisee portal, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=naranga).

It is built for franchisors in Australia and New Zealand with five to fifty sites: food, cafes, services, retail. It carries the work head office repeats every week and every year:

```
/attention        everything that wants a decision this morning, worst first
/network          every site: sales trend, arrears, last visit, findings, tickets
/royalties        the monthly royalty run, sales reported and money in
/arrears          who owes what, and reports not received
/field-visits     visits due and booked, scores and findings
/renewals         agreements ending, with the s36 notice date
/pipeline         franchise sales leads and the date each may sign from
/year-end         disclosure update, the Register, the marketing fund statement
/breaches         notices, remedy dates, and the termination gate
/compliance       eleven rules from the Franchising Code, your agreements and the food rules
```

The sharp edges are deliberate, because in franchising a missed date is a dispute:

- **Nothing is signed inside 14 days of the disclosure document.** Signing an agreement, a renewal, a transfer or a prospect all refuse, and there is no force flag (Franchising Code s23).
- **Cooling off is 14 days, recorded only inside them.** New agreements and transfers show COOLING OFF until it ends, so fit-out spend waits (s50, s52).
- **No termination for breach before the remedy date.** A notice with less than 30 days to remedy is flagged so someone records why it was reasonable (s55).
- **The end of term notice clock runs on every agreement.** Six months before the end of the term, or one month for short terms, loud when it is late (s36).
- **A finding closes on evidence, not on a promise.** A visit completes only with a score.

**Nothing here takes a payment, connects to a point of sale or sends.** Reminders, notices and visit reports draft to files in your brand; a person sends them. Nothing here is legal advice.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your network's records sit in plain Postgres tables you own. If a vendor disappears, nothing disappears with it.
- No per-location fee, no modules. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too (a field app and a franchisee portal are the big ones).

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/franchise-for-claude-code.git
cd franchise-for-claude-code
npm install
npm run demo
```

`npm run demo` creates the database, loads Daybreak Bakehouse (a fictional Brisbane bakery cafe franchisor with fourteen sites in Queensland, New South Wales and Auckland, and a month going quietly wrong: a transfer signed nine days after disclosure, Chermside's end of term notice a month late, a cool room failing a visit with the critical finding overdue, Southport two months behind on royalties with a breach notice running out, Chatswood's sales report missing and its insurance lapsed, Parramatta down 15% on the quarter, an expired food safety supervisor certificate at Dee Why, Indooroopilly unvisited for four months, an urgent oven ticket sitting three days, last year's marketing fund statement and disclosure update not yet done, and a new site in Newstead still in cooling off), then prints the attention list and the compliance check.

Then open the folder in Claude Code and type:

```
/attention
```

Try `/network`, `/royalties`, `/renewals`, `/site Southport`, `/weekly-review`. When you are ready for real data, delete `.data/` and start with `/import`.

Fill in the "Who this is for" block in [CLAUDE.md](CLAUDE.md), especially your royalty terms, financial year and franchise lawyer, and put your name and colours in [brand.json](brand.json) so every statement and report carries them.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-location fee. Head office, each field manager and the franchise development lead clone the repo, point at the same `DATABASE_URL`, and work in their own Claude Code.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything that wants a decision, worst first: a signing inside the disclosure window outranks all. |
| `/network` | Every site on one line: sales for the quarter against the one before, arrears, last visit score, findings, tickets, agreement state. |
| `/site` | One site's whole card: franchisee, insurance, agreements, royalties, visits, findings, tickets, certificates, notes. |
| `/royalties` | The monthly royalty run; record a sales report or a payment. Royalty and levy follow from the agreement. |
| `/arrears` | Who owes what by site and how old it is; reports not received. |
| `/field-visits` | Visits overdue, due and booked; record a visit with its score and findings. |
| `/findings` | Open findings, critical first; close one on evidence. |
| `/renewals` | Agreements ending, the s36 notice date, and recording the notice. |
| `/pipeline` | Franchise sales leads by stage, the date each may sign from, quiet leads. |
| `/year-end` | Disclosure update, Franchise Disclosure Register, fund statement and audit, each with its date. |
| `/marketing-fund` | Levies raised and collected, spend by category; record spend. |
| `/support` | Tickets by priority and age, unassigned loud; open, assign, resolve. |
| `/certificates` | Food safety supervisor and other certificates, expired and expiring. |
| `/breaches` | Breach notices, remedy dates, remedied, and the termination gate. |
| `/log` | A call, email, meeting or visit against a site, franchisee or prospect. |
| `/weekly-review` | The Monday review, written from three commands. |
| `/compliance` | Eleven rules, each with its source, run against your records. |
| `/draft-royalty-reminder` | A reminder to a franchisee who is behind. Drafts only. |
| `/draft-breach-notice` | A breach notice in the shape s55 asks for, for legal review. Drafts only. |
| `/draft-end-of-term-notice` | The s36 notice of the franchisor's intention. Drafts only. |
| `/draft-visit-report` | A field visit written up for the franchisee. Drafts only. |
| `/import` | Bring the network across from Naranga exports. The import is the first audit. |
| `/customise` | Add a field, change a rule, rename things, in plain language. |
| `/new-view` | Add a read-only HTML dashboard from a description. |

Everything the commands do, the CLI does: `npm run franchise -- help`. Any read command takes `--json`.

### Documents and views, in your brand

```bash
npm run docs    # royalty statements, visit reports, franchisee files, the fund statement draft
npm run view    # the week across the network, and royalties and the fund, as read-only HTML
```

Both read [brand.json](brand.json). Documents land in `docs-out/`, views in `views/`. Print either to PDF from the browser. `/new-view` adds a view, `documents.json` adds a document.

## Compliance, checked against the data

`/compliance` runs the rules in [docs/compliance.md](docs/compliance.md) against your records and reports what is breached, each rule citing its source:

1. Nothing is signed until 14 days after the disclosure document is given (Franchising Code of Conduct s23).
2. The end of term notice goes 6 months before the term ends, 1 month for short terms (s36).
3. The marketing fund statement is prepared within 4 months of year end and given within 30 days (s31).
4. The marketing fund statement is audited unless 75% of contributors voted it out (s31).
5. The disclosure document is updated within 4 months of year end (s21).
6. The Franchise Disclosure Register entry is updated or confirmed each year (s93).
7. Breach notices give a reasonable time to remedy, flagged under 30 days (s55).
8. Every active franchisee holds current public liability insurance (your agreement).
9. Every trading site holds its required certificates (Food Act 2003 (NSW), Food Act 2006 (Qld), the food control plan under the Food Act 2014 (NZ), your operations manual).
10. Every site reports monthly sales by the royalty due date (your agreement).
11. Critical findings from a field visit are fixed by their due date (your operations manual).

The Code is the Competition and Consumer (Industry Codes, Franchising) Regulations 2024, in force from 1 April 2025. New Zealand has no franchising code; the rules still make sound practice there. Nothing here is legal advice: it is the rule book you point the system at, and you change it with your lawyer.

## Ten questions Naranga never answered

Every one of these is answered by the demo data today. Yours will be different, and that is the point.

1. Which agreements were signed less than 14 days after the disclosure document was given?
2. Which agreements are past the date their end of term notice was due, and which fall due in the next 60 days?
3. Which sites are down 10% or more on the quarter before, and is any of them also behind on royalties?
4. Who owes royalties or marketing levy, for how many months, and how old is the oldest?
5. Which sites have not sent a monthly sales report that is already due?
6. Which sites have gone longest without a field visit, and who is their field manager?
7. Which critical and major findings are past their due date, and at which sites?
8. Which franchisees' public liability insurance has lapsed or lapses this month?
9. Which sites have a food safety supervisor certificate that has expired or expires inside 90 days?
10. How much has the marketing fund levied, collected and spent this year, and when is its statement due?

## Your first hour: ten things to ask for

Open the folder in Claude Code and say these in your own words. Each one changes the system to fit your network.

1. "Import our location list and our lead export, then show me what the old system never told us."
2. "Our royalty is 7% with a $1,500 monthly minimum, and reports are due on the 5th. Change it."
3. "Our financial year ends 31 December. Move every year end date."
4. "Add territory boundaries as postcodes and warn me if two sites overlap."
5. "Add a refurbishment due date to every agreement and put it on the renewals list."
6. "We are New Zealand only. Turn the Australian Code rules into reminders, not breaches."
7. "Put our logo and colours on the royalty statement and the visit report."
8. "Every Monday, draft a reminder to each franchisee whose sales report is late."
9. "Add our 40 point brand audit checklist and score visits against it."
10. "Keep the marketing fund in AUD and NZD separately."

`/customise` writes the migration, applies it, updates every command that touches the change, and runs the tests.

## Instead of Naranga

Gather your location list and lead export (or the spreadsheets you kept beside Naranga), save them as CSV, and run one command. The import matches columns by name, names every column it did not use, and never guesses a disclosure date. Step by step, with what maps and what does not carry over: [docs/replace-naranga.md](docs/replace-naranga.md).

```bash
npm run franchise -- import naranga --locations=locations.csv --leads=leads.csv --dry-run
npm run franchise -- import naranga --locations=locations.csv --leads=leads.csv
```

The import is the first audit: every franchisee without an insurance expiry and every site without agreement dates is named the moment it finishes.

## Architecture

```
franchise-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  brand.json                your name and colours on every document and view
  views.json                the HTML dashboards npm run view renders
  documents.json            the paperwork npm run docs renders
  .claude/commands/         the slash commands
  scripts/franchise.mjs     the CLI the commands drive
  scripts/view.mjs          read-only HTML dashboards from the SQL views
  scripts/docs.mjs          the documents, one HTML file per record
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema, tables and views
  supabase/seed.sql         demo data
  docs/compliance.md        the rules /compliance checks, each with its source
  docs/replace-naranga.md   moving off Naranga
  docs/why-no-front-end.md  the honest trade-offs
  drafts/                   anything written for a person to send
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end, nothing that sends or takes a payment, and the disclosure, cooling off, notice, breach and evidence gates stay.

## Want it installed and run for you?

Enterprise DNA installs Franchise for Claude Code for your network, brings your Naranga records across, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=naranga)
- Read more: [enterprisedna.co/omni/instead-of/naranga](https://enterprisedna.co/omni/instead-of/naranga?utm_source=github&utm_medium=readme&utm_campaign=naranga)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
