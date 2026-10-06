# Moving off Naranga

Naranga's own website no longer loads, and competitors reported in late 2025 that its software was being wound down. If your records are still in Naranga, or in exports you took before it closed, this is how to bring them across.

## 1. Gather what you have

Naranga never published its export columns, so start from whatever you hold:

- **The location list.** One row per site: location name or number, franchisee, contact details, address, open date, agreement start and end, royalty and marketing rates, status. From an ncompass export, a report saved to CSV, or the spreadsheet head office kept alongside it.
- **Franchise sales leads.** From eMaximation or the lead manager: name, email, phone, territory, source, status, date created.
- **Your agreements, disclosure documents and fund statements.** These are documents, not rows. Keep the files; you only need their dates here.
- **The last six months of sales reports** per site, from your point of sale or the royalty spreadsheet.

Save each list as CSV (in Excel: File, Save As, CSV UTF-8).

## 2. Try it without writing anything

```bash
npm run franchise -- import naranga --locations=locations.csv --leads=leads.csv --dry-run
```

The trial run counts what would arrive, lists every row it could not read, and names every column it did not use.

## 3. What maps

The import matches column names, ignoring case:

| Your column | Becomes |
|---|---|
| Location Number, Location #, Store Number, Site ID | the site's key (sites are matched on it the next time you import) |
| Location Name, Site Name, Store Name | the site |
| Franchisee, Owner, Primary Contact | the franchisee (created once, matched by name) |
| Entity, Company, Legal Name | the franchisee's entity |
| Email, Phone | the franchisee's contact details |
| Address, City or Suburb, State, Country | the site's address; New Zealand sites are set to NZD |
| Open Date | when the site opened |
| Agreement Start, Agreement End, Expiration Date | the agreement's term, so the end of term clock runs |
| Royalty %, Ad Fund %, Marketing % | the agreement's rates (6% and 2% if blank) |
| Insurance Expiration, COI Expiration | the franchisee's public liability expiry |
| Status | trading, opening or closed |
| Lead ID, First Name, Last Name, Email, Phone, Desired Territory, Lead Source, Lead Status, Date Created | a prospect in the pipeline |

Dates may be written DD/MM/YYYY or YYYY-MM-DD.

## 4. What does not carry over

- **Disclosure dates for leads.** A lead marked "FDD sent" arrives as qualified with no disclosure date. The 14 day clock is too important to guess: record each one with `prospects disclose <ref> --on=<date>`.
- **Field visit history, audit checklists and photos.** Bring the latest score per site in by hand (`visits complete`) or ask Claude Code to map your audit export; keep the photos where they are.
- **Training courses and the support centre's articles.** Certificates are recorded here; the courses and articles are not.
- **Chargebacks and anything payment related.** Out of scope by design.

Columns the import does not know (a territory code, a second owner, a custom field) are named in the trial run. Ask `/customise` to add them before the real import.

## 5. Import for real, then audit

```bash
npm run franchise -- import naranga --locations=locations.csv --leads=leads.csv
```

Running it again is safe: sites match on their location number, leads on their id or email. Then:

1. Record each franchisee's insurance expiry if it was not in the file.
2. Add agreement dates for any site the import could not date.
3. Load recent sales: `npm run franchise -- royalties report "<site>" --period=2026-09 --sales=84500`.
4. Run `/attention` and `/compliance`. The first audit is usually the most useful hour of the move.

Want it mapped and checked for you? That is what Enterprise DNA does: https://enterprisedna.co/omni/instead-of/naranga
