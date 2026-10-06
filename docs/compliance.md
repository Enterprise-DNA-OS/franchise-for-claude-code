# The rules /compliance checks

Each rule below is checked by `node scripts/franchise.mjs compliance` against the records. The check and this document change together: if a rule is wrong for your network, change both.

Nothing here is legal advice. The Franchising Code of Conduct is the Competition and Consumer (Industry Codes, Franchising) Regulations 2024 (Cth), in force from 1 April 2025, with section numbers as they stand in that instrument. Read the Code itself on the Federal Register of Legislation (F2024L01605) and have your franchise lawyer confirm how it applies to your agreements. The Code applies to franchises in Australia; New Zealand has no franchising code (see the end of this page).

## From the Franchising Code of Conduct

1. **Nothing is signed until 14 days after the disclosure document is given.** Section 23. A franchisor must not enter into, renew or extend a franchise agreement, or consent to a transfer, until 14 days after giving the disclosure document, the information statement and the agreement in the form it will be signed. *Breach in the data:* an agreement signed in the last six years with no disclosure date, or signed less than 14 days after it. *The gate:* `agreements sign` and `prospects stage --to=signed` refuse inside 14 days.

2. **The end of term notice goes 6 months before the term ends.** Section 36. The franchisor tells the franchisee whether it intends to extend or enter a new agreement at least 6 months before the end of a term of 6 months or more, and at least 1 month before the end of a shorter term. *Breach:* an active agreement past its notice date with no notice on record.

3. **The marketing fund statement is prepared within 4 months of year end and given within 30 days.** Section 31 (specific purpose funds, which include marketing and cooperative funds). *Breach:* the statement for the year just ended not prepared four months after year end, or prepared and not given to contributing franchisees within 30 days.

4. **The marketing fund statement is audited, unless 75% of contributors voted it out.** Section 31. *Breach:* no audit and no opt-out on record once the statement is due.

5. **The disclosure document is updated within 4 months of the end of the financial year.** Section 21. There is an exception for a franchisor that entered into no more than one agreement last year and intends none this year; record it as updated if that applies. *Breach:* no update on record four months after year end.

6. **The Franchise Disclosure Register entry is updated or confirmed each year.** Section 93. The date is set by the Register; in 2025 it was 14 November. The check uses 14 days after the disclosure update deadline: change it to the Register's published date. *Breach:* no Register update on record after that date.

7. **Breach notices give a reasonable time to remedy.** Section 55. Before terminating for a breach, the franchisor tells the franchisee what the breach is, what must be done to remedy it, and allows a reasonable time, which need not be more than 30 days. *Flagged:* any notice in the last six years with less than 30 days to remedy, so someone records why the shorter time was reasonable. *The gate:* `breaches terminate` refuses before the remedy date. Section 57 sets the separate seven day grounds (for example the franchisee no longer holds a licence it needs); this system does not record those, your lawyer handles them.

Also kept by the record, not checked as rules: cooling off (section 50 for new agreements and section 52 for transfers: 14 days, `agreements cool-off` refuses outside it), and records (section 37 asks for disclosure material to be kept for at least six years; this system never deletes an agreement).

## From your agreements and the food rules

8. **Every active franchisee holds current public liability insurance.** Your franchise agreement and operations manual. *Breach:* no expiry on record, or past it.

9. **Every trading site holds its required certificates.** For food franchises: the food safety supervisor requirements in the Food Act 2003 (NSW) and the Food Act 2006 (Qld), and the food control plan each New Zealand site runs under the Food Act 2014 (NZ); plus whatever your operations manual requires. *Breach:* a required certificate past its expiry at a trading site. Mark a certificate `required = false` if it is nice to have.

10. **Every site reports monthly sales by the royalty due date.** Your franchise agreement's reporting clause. The demo uses the 7th of the following month. *Breach:* a month past its due date with no sales on record.

11. **Critical findings from a field visit are fixed by their due date.** Your operations manual, and the food safety rule behind the finding. *Breach:* a critical finding open past its date.

## New Zealand

New Zealand has no mandatory franchising code. The Fair Trading Act 1986 applies to what a franchisor says to a buyer, and members of the Franchise Association of New Zealand sign up to its code of practice. The disclosure, notice and fund rules above still make sound practice for NZ sites: keep them on unless your lawyer says otherwise, and say so in `CLAUDE.md`.
