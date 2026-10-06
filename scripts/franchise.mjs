#!/usr/bin/env node
// franchise-for-claude-code: the one CLI. The slash commands call this; so can you.
//
//   node scripts/franchise.mjs <command> [args] [--flags] [--json]
//
// Run with no arguments (or `help`) for the command list.
//
// This is a franchisor's network record the way Naranga sold it: franchisees
// and their sites, agreements, monthly sales reports and the royalties they
// raise, field visits and findings, the support desk, certificates, breach
// notices, franchise sales prospects and the marketing fund. It sends nothing
// and connects to nothing: notices, reminders and visit reports draft to
// drafts/, and a person sends them.
//
// The gates, and there are no force flags:
//   * no agreement signed, renewed, extended or transferred before 14 days have
//     passed since the disclosure document was given (Franchising Code s23)
//   * no prospect moved to signed on the same rule
//   * cooling off is recorded only inside 14 days of signing a new or
//     transferred agreement (s50, s52)
//   * no termination for breach until the remedy date in the notice has passed
//     and the breach is still unremedied (s55)
//   * no finding closed without the evidence that it was fixed
//   * no field visit completed without a score
//   * no ticket resolved without a resolution
//
// Deliberately NOT here: payments, point of sale, payroll, bank feeds.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, money, isoDate, truncate, heading } from './lib/format.mjs';

// ---------------------------------------------------------------- arguments

const BOOL_FLAGS = new Set(['json', 'help', 'all', 'dry-run', 'opt-out']);

function parseArgv(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') { flags.help = true; continue; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let name, value;
      if (eq > -1) { name = a.slice(2, eq); value = a.slice(eq + 1); }
      else {
        name = a.slice(2);
        const next = argv[i + 1];
        if (BOOL_FLAGS.has(name) || next === undefined || next.startsWith('--')) value = true;
        else value = argv[++i];
      }
      flags[name] = value;
    } else args.push(a);
  }
  return { args, flags };
}

class CliError extends Error {
  constructor(message, code = 1) { super(message); this.code = code; }
}

const num = (v) => Number(v ?? 0);
const str = (v) => (v === true || v === undefined || v === null ? '' : String(v));

// ---------------------------------------------------------------- dates and money

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);

// AU and NZ exports write DD/MM/YYYY: the first number is the day unless the
// second is too big to be a month.
function parseDate(v, what = 'date') {
  if (!v || v === true) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const lower = s.toLowerCase();
  if (lower === 'today') return today();
  if (lower === 'yesterday') return addDays(today(), -1);
  if (lower === 'tomorrow') return addDays(today(), 1);
  const rel = lower.match(/^([+-]\d+)d?$/);
  if (rel) return addDays(today(), Number(rel[1]));
  const slash = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const [day, month] = b > 12 ? [b, a] : [a, b];
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  throw new CliError(`"${v}" is not a ${what}. Use YYYY-MM-DD, today, or +7.`);
}

// "2026-08", "Aug 2026", "08/2026", or a date: the first of that month.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parsePeriod(v) {
  if (!v || v === true) throw new CliError('Which month? --period=2026-08 (or "Aug 2026").');
  const s = String(v).trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-01`;
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}-01`;
  m = s.match(/^([a-z]{3})[a-z]*\s+(\d{4})$/);
  if (m && MONTHS.includes(m[1])) return `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-01`;
  return `${parseDate(v, 'month').slice(0, 7)}-01`;
}

// "8,450.50", "$8450", "8450" -> cents.
function parseMoney(v, what = 'amount') {
  if (v === undefined || v === true || v === '') throw new CliError(`${what} is required, in dollars: --${what}=8450.50`);
  const n = Number(String(v).replace(/[$,\s]|AUD|NZD/gi, ''));
  if (!Number.isFinite(n) || n < 0) throw new CliError(`"${v}" is not an amount in dollars.`);
  return Math.round(n * 100);
}

// ---------------------------------------------------------------- lookups

async function resolveRow(db, sql, params, label, term) {
  const rows = await db.query(sql, params);
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No ${label} matches "${term}".`);
  const list = rows.slice(0, 10).map((r) => `  ${r.ref ? r.ref + '  ' : ''}${r.name || ''}${r.franchisee ? '  ' + r.franchisee : ''}`).join('\n');
  throw new CliError(`"${term}" matches ${rows.length} ${label} records. Which one?\n${list}`);
}

async function resolveSite(db, term) {
  if (!term) throw new CliError('Which site? Give its name (partial is fine) or ref like S-101.');
  const t = String(term).trim();
  const exact = await db.query('select * from sites where lower(name) = lower($1) or upper(ref) = upper($1)', [t]);
  if (exact.length === 1) return exact[0];
  return resolveRow(db, 'select s.*, f.name as franchisee from sites s left join franchisees f on f.id = s.franchisee_id where s.name ilike $1 or s.suburb ilike $1 or f.name ilike $1 order by s.ref', [`%${t}%`], 'site', t);
}

async function resolveFranchisee(db, term) {
  if (!term) throw new CliError('Which franchisee? Give a name (partial is fine) or a ref like FE-04.');
  const t = String(term).trim();
  const exact = await db.query('select * from franchisees where lower(name) = lower($1) or upper(ref) = upper($1) or lower(entity) = lower($1)', [t]);
  if (exact.length === 1) return exact[0];
  return resolveRow(db, 'select * from franchisees where name ilike $1 or entity ilike $1 order by ref', [`%${t}%`], 'franchisee', t);
}

async function resolveStaff(db, term) {
  if (!term) return null;
  const t = String(term).trim();
  const exact = await db.query('select * from staff where lower(name) = lower($1)', [t]);
  if (exact.length === 1) return exact[0];
  return resolveRow(db, 'select * from staff where name ilike $1 order by name', [`%${t}%`], 'staff', t);
}

async function resolveRef(db, tableName, ref, label) {
  if (!ref) throw new CliError(`Which ${label}? Give its ref.`);
  const rows = await db.query(`select * from ${tableName} where upper(ref) = upper($1)`, [String(ref).trim()]);
  if (rows.length === 1) return rows[0];
  throw new CliError(`No ${label} with ref "${ref}".`);
}

// An agreement by ref (A-503), or the active agreement of a site.
async function resolveAgreement(db, term) {
  if (!term) throw new CliError('Which agreement? Give its ref (A-503) or the site.');
  const t = String(term).trim();
  const byRef = await db.query('select * from v_agreements where upper(ref) = upper($1)', [t]);
  if (byRef.length === 1) return byRef[0];
  const site = await resolveSite(db, t);
  const rows = await db.query("select * from v_agreements where site_id = $1 order by (status = 'active') desc, (status = 'pending') desc, term_start desc nulls last limit 1", [site.id]);
  if (!rows.length) throw new CliError(`${site.name} has no agreement on record.`);
  return rows[0];
}

async function nextRef(db, tableName, prefix, start) {
  const [row] = await db.query(
    `select coalesce(max(substring(ref from '^${prefix}-(\\d+)$')::int), $1) + 1 as n from ${tableName}`,
    [start - 1],
  );
  return `${prefix}-${row.n}`;
}

// ---------------------------------------------------------------- output

function out(flags, value, textFn) {
  if (flags.json) console.log(JSON.stringify(value, null, 2));
  else textFn();
}
const d = (v) => (v ? isoDate(v) : '');
const cash = (cur) => (v, r) => money(v, r?.currency || cur || 'AUD');

// ---------------------------------------------------------------- the network

async function cmdStats(db, flags) {
  const [s] = await db.query(`
    select (select count(*) from sites where status = 'trading') as trading_sites,
           (select count(*) from sites where status = 'opening') as opening_sites,
           (select count(*) from franchisees where status = 'active') as franchisees,

           (select count(*) from v_royalties where state = 'NOT REPORTED') as reports_missing,
           (select count(*) from findings where closed_on is null) as open_findings,
           (select count(*) from tickets where status <> 'resolved') as open_tickets,
           (select count(*) from prospects where stage not in ('signed', 'lost')) as live_prospects,
           (select count(*) from v_attention) as attention`);
  const stats = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, num(v)]));
  // AUD and NZD sites are never added together.
  const byCurrency = await db.query(`
    select currency,
           coalesce(sum(gross_sales_cents) filter (where period = (date_trunc('month', current_date) - interval '1 month')::date), 0) as last_month_sales_cents,
           coalesce(sum(balance_cents) filter (where state like 'OVERDUE%'), 0) as overdue_cents
      from v_royalties group by currency order by currency`);
  stats.by_currency = byCurrency.map((r) => ({ currency: r.currency, last_month_sales_cents: num(r.last_month_sales_cents), overdue_cents: num(r.overdue_cents) }));
  out(flags, stats, () => {
    console.log(heading('The network at a glance'));
    console.log(`  ${stats.trading_sites} trading sites, ${stats.opening_sites} opening, ${stats.franchisees} franchisees`);
    for (const c of stats.by_currency) console.log(`  ${c.currency}: last month's reported sales ${money(c.last_month_sales_cents, c.currency)}, ${money(c.overdue_cents, c.currency)} in royalties and levy overdue`);
    console.log(`  ${stats.reports_missing} sales report(s) missing`);
    console.log(`  ${stats.open_findings} open finding(s), ${stats.open_tickets} open ticket(s), ${stats.live_prospects} live prospect(s)`);
    console.log(`  ${stats.attention} item(s) needing a decision`);
  });
}

async function cmdAttention(db, flags) {
  const rows = await db.query('select * from v_attention order by rank, days desc nulls last, label');
  out(flags, rows, () => {
    console.log(heading('Needs a decision, worst first'));
    console.log(table(rows, [
      { key: 'reason', label: 'why' },
      { key: 'label', label: 'record' },
      { key: 'site', label: 'site', width: 18 },
      { key: 'who', label: 'who', width: 18 },
      { key: 'days', label: 'days', align: 'right' },
      { key: 'detail', label: 'detail', width: 70 },
    ]));
  });
}

async function cmdNetwork(db, flags) {
  const where = flags.all ? '' : "where status <> 'closed'";
  const rows = await db.query(`select * from v_sites ${where} order by ref`);
  out(flags, rows, () => {
    console.log(heading('The network, site by site'));
    console.log(table(rows, [
      { key: 'ref', label: 'site' }, { key: 'name', label: 'name' }, { key: 'franchisee', label: 'franchisee' },
      { key: 'state', label: 'state' },
      { key: 'sales_3m_cents', label: 'sales 3m', align: 'right', format: (v, r) => (v === null || v === undefined ? '' : money(v, r.currency)) },
      { key: 'sales_trend_pct', label: 'trend', align: 'right', format: (v) => (v === null || v === undefined ? '' : `${num(v) > 0 ? '+' : ''}${v}%`) },
      { key: 'arrears_cents', label: 'arrears', align: 'right', format: (v, r) => (num(v) ? money(v, r.currency) : '') },
      { key: 'last_score', label: 'visit', align: 'right' },
      { key: 'open_findings', label: 'findings', align: 'right' },
      { key: 'open_tickets', label: 'tickets', align: 'right' },
      { key: 'agreement_state', label: 'agreement' },
    ]));
  });
}

async function cmdSite(db, args, flags) {
  const s = await resolveSite(db, args.join(' '));
  const [v] = await db.query('select * from v_sites where site_id = $1', [s.id]);
  const [owner] = s.franchisee_id ? await db.query('select * from franchisees where id = $1', [s.franchisee_id]) : [null];
  const agreements = await db.query('select ref, kind, status, state, franchisee, signed_on, term_start, term_end, royalty_pct, marketing_pct, notice_due_by, end_of_term_notice_on, end_of_term_intent from v_agreements where site_id = $1 order by term_start desc nulls last', [s.id]);
  const royalties = await db.query('select month, currency, gross_sales_cents, owed_cents, paid_cents, balance_cents, state from v_royalties where site_id = $1 order by period desc limit 6', [s.id]);
  const visits = await db.query(`select a.ref, a.kind, a.status, coalesce(a.visited_on, a.scheduled_on) as on_date, a.score, st.name as by, a.summary
                                   from audits a left join staff st on st.id = a.staff_id where a.site_id = $1 order by coalesce(a.visited_on, a.scheduled_on) desc limit 4`, [s.id]);
  const findings = await db.query('select ref, severity, item, due_on, days_overdue from v_findings where site_id = $1 and closed_on is null order by due_on', [s.id]);
  const tickets = await db.query("select ref, priority, subject, status, opened_on from tickets where site_id = $1 and status <> 'resolved' order by opened_on", [s.id]);
  const certs = await db.query('select holder, kind, expires_on from certificates where site_id = $1 order by expires_on', [s.id]);
  const breaches = await db.query('select b.ref, b.issued_on, b.breach, b.remedy_by, b.status from breach_notices b join agreements a on a.id = b.agreement_id where a.site_id = $1 order by b.issued_on desc', [s.id]);
  const notes = await db.query('select n.noted_on, n.kind, st.name as by, n.body from notes n left join staff st on st.id = n.staff_id where n.site_id = $1 order by n.noted_on desc limit 5', [s.id]);
  const card = { site: v, franchisee: owner, agreements, royalties, visits, findings, tickets, certificates: certs, breach_notices: breaches, notes };
  out(flags, card, () => {
    console.log(heading(`${s.name} (${s.ref}), ${s.status}`));
    console.log(`  ${s.address || ''}, ${s.suburb || ''} ${s.state || ''} ${s.country}  territory: ${s.territory || 'not set'}`);
    if (owner) console.log(`  franchisee ${owner.name} (${owner.ref}), ${owner.entity || ''}  ${owner.phone || ''}  ${owner.email || ''}`);
    if (owner) console.log(`  public liability ${owner.insurer || 'not recorded'} ${owner.insurance_policy || ''}, ${owner.insurance_expires_on ? (isoDate(owner.insurance_expires_on) < today() ? 'LAPSED ' : 'expires ') + d(owner.insurance_expires_on) : 'no expiry on record'}`);
    console.log(`  field manager ${v.field_manager || 'none'}, opened ${d(s.opened_on)}, lease to ${d(s.lease_expires_on) || 'not recorded'}`);
    console.log(heading('Agreements'));
    console.log(table(agreements, [
      { key: 'ref', label: 'ref' }, { key: 'kind', label: 'kind' }, { key: 'franchisee', label: 'franchisee' }, { key: 'state', label: 'state' },
      { key: 'term_start', label: 'start', format: d }, { key: 'term_end', label: 'end', format: d },
      { key: 'notice_due_by', label: 'notice by', format: d }, { key: 'end_of_term_notice_on', label: 'notice given', format: d },
    ]));
    console.log(heading('Royalties, last six months'));
    console.log(table(royalties, [
      { key: 'month', label: 'month' }, { key: 'gross_sales_cents', label: 'sales', align: 'right', format: (v, r) => (v === null ? 'not reported' : money(v, r.currency)) },
      { key: 'owed_cents', label: 'owed', align: 'right', format: cash() }, { key: 'paid_cents', label: 'paid', align: 'right', format: cash() },
      { key: 'state', label: 'state' },
    ]));
    console.log(heading('Field visits'));
    console.log(table(visits, [
      { key: 'ref', label: 'ref' }, { key: 'kind', label: 'kind' }, { key: 'status', label: 'status' }, { key: 'on_date', label: 'date', format: d },
      { key: 'score', label: 'score', align: 'right' }, { key: 'by', label: 'by' }, { key: 'summary', label: 'summary', width: 60 },
    ]));
    if (findings.length) {
      console.log(heading('Open findings'));
      console.log(table(findings, [{ key: 'ref', label: 'ref' }, { key: 'severity', label: 'severity' }, { key: 'item', label: 'item', width: 70 }, { key: 'due_on', label: 'due', format: d }]));
    }
    if (tickets.length) {
      console.log(heading('Open tickets'));
      console.log(table(tickets, [{ key: 'ref', label: 'ref' }, { key: 'priority', label: 'priority' }, { key: 'subject', label: 'subject', width: 60 }, { key: 'status', label: 'status' }, { key: 'opened_on', label: 'opened', format: d }]));
    }
    console.log(heading('Certificates'));
    console.log(table(certs, [{ key: 'holder', label: 'holder' }, { key: 'kind', label: 'certificate' }, { key: 'expires_on', label: 'expires', format: (v) => (v && isoDate(v) < today() ? `EXPIRED ${d(v)}` : d(v)) }]));
    if (breaches.length) {
      console.log(heading('Breach notices'));
      console.log(table(breaches, [{ key: 'ref', label: 'ref' }, { key: 'issued_on', label: 'issued', format: d }, { key: 'breach', label: 'breach', width: 50 }, { key: 'remedy_by', label: 'remedy by', format: d }, { key: 'status', label: 'status' }]));
    }
    if (notes.length) {
      console.log(heading('Notes'));
      console.log(table(notes, [{ key: 'noted_on', label: 'date', format: d }, { key: 'kind', label: 'kind' }, { key: 'by', label: 'by' }, { key: 'body', label: 'note', width: 70 }]));
    }
  });
}

async function cmdFranchisees(db, args, flags) {
  if (args[0] === 'insurance') return franchiseeInsurance(db, args.slice(1), flags);
  const rows = await db.query(`
    select f.ref, f.name, f.entity, f.status, f.insurance_expires_on,
           (select string_agg(s.ref || ' ' || s.name, ', ' order by s.ref) from sites s where s.franchisee_id = f.id and s.status <> 'closed') as sites
      from franchisees f ${flags.all ? '' : "where f.status = 'active'"} order by f.ref`);
  out(flags, rows, () => {
    console.log(heading('Franchisees'));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'name', label: 'name' }, { key: 'entity', label: 'entity', width: 30 },
      { key: 'sites', label: 'sites', width: 40 },
      { key: 'insurance_expires_on', label: 'insurance', format: (v) => (!v ? 'none on record' : isoDate(v) < today() ? `LAPSED ${d(v)}` : d(v)) },
    ]));
  });
}

async function franchiseeInsurance(db, args, flags) {
  const f = await resolveFranchisee(db, args.join(' '));
  const expires = parseDate(flags.expires);
  if (!expires) throw new CliError('Give the new expiry: --expires=YYYY-MM-DD (and --insurer= --policy= if they changed).');
  await db.query('update franchisees set insurance_expires_on = $2, insurer = coalesce(nullif($3, \'\'), insurer), insurance_policy = coalesce(nullif($4, \'\'), insurance_policy) where id = $1',
    [f.id, expires, str(flags.insurer), str(flags.policy)]);
  out(flags, { franchisee: f.ref, insurance_expires_on: expires }, () => console.log(`${f.name}: public liability recorded to ${expires}.`));
}

// ---------------------------------------------------------------- agreements

async function cmdAgreements(db, args, flags) {
  const sub = args[0];
  if (sub === 'add') return agreementAdd(db, flags);
  if (sub === 'disclose') return agreementDisclose(db, args.slice(1), flags);
  if (sub === 'sign') return agreementSign(db, args.slice(1), flags);
  if (sub === 'notice') return agreementNotice(db, args.slice(1), flags);
  if (sub === 'cool-off') return agreementCoolOff(db, args.slice(1), flags);
  if (sub === 'end') return agreementEnd(db, args.slice(1), flags);
  const rows = await db.query(`select * from v_agreements ${flags.all ? '' : "where status in ('active', 'pending')"} order by term_end nulls last`);
  out(flags, rows, () => {
    console.log(heading('Agreements, soonest ending first'));
    console.log(table(rows, AGREEMENT_COLS));
  });
}

const AGREEMENT_COLS = [
  { key: 'ref', label: 'ref' }, { key: 'site', label: 'site' }, { key: 'franchisee', label: 'franchisee' }, { key: 'kind', label: 'kind' },
  { key: 'state', label: 'state' }, { key: 'term_end', label: 'term ends', format: d },
  { key: 'days_to_end', label: 'days', align: 'right' },
  { key: 'notice_due_by', label: 'notice by', format: d },
  { key: 'end_of_term_notice_on', label: 'notice given', format: (v, r) => (v ? `${d(v)} ${r.end_of_term_intent || ''}` : '') },
];

async function cmdRenewals(db, flags) {
  const within = num(flags.days || 365);
  const rows = await db.query("select * from v_agreements where status = 'active' and term_end <= current_date + $1::int order by term_end", [within]);
  out(flags, rows, () => {
    console.log(heading(`Agreements ending in the next ${within} days`));
    console.log(table(rows, AGREEMENT_COLS));
    console.log('\n  s36: the end of term notice is due 6 months before the end of a term of 6 months or more, else 1 month.');
  });
}

async function agreementAdd(db, flags) {
  const site = await resolveSite(db, flags.site);
  const f = await resolveFranchisee(db, flags.franchisee || '');
  const kind = str(flags.kind) || 'new';
  if (!['new', 'renewal', 'extension', 'transfer'].includes(kind)) throw new CliError('--kind is new, renewal, extension or transfer.');
  const ref = await nextRef(db, 'agreements', 'A', 501);
  const start = parseDate(flags.start);
  const years = num(flags.years || 5);
  const end = parseDate(flags.end) || (start ? addDays(start, Math.round(years * 365.25) - 1) : null);
  await db.query(`insert into agreements (ref, site_id, franchisee_id, kind, status, term_start, term_end, royalty_pct, marketing_pct, min_royalty_cents)
                  values ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9)`,
    [ref, site.id, f.id, kind, start, end, num(flags.royalty || 6), num(flags.marketing || 2), flags['min-royalty'] ? parseMoney(flags['min-royalty'], 'min-royalty') : 0]);
  out(flags, { ref, site: site.ref, franchisee: f.ref, kind, status: 'pending', term_start: start, term_end: end }, () =>
    console.log(`${ref} drafted: ${kind} agreement for ${site.name} with ${f.name}. Next: agreements disclose ${ref} when the disclosure document goes out.`));
}

async function agreementDisclose(db, args, flags) {
  const a = await resolveAgreement(db, args.join(' '));
  if (a.status !== 'pending') throw new CliError(`${a.ref} is ${a.status}. Disclosure is recorded before signing.`);
  const on = parseDate(flags.on || 'today');
  await db.query('update agreements set disclosure_given_on = $2 where id = $1', [a.agreement_id, on]);
  out(flags, { ref: a.ref, disclosure_given_on: on, may_sign_from: addDays(on, 14) }, () =>
    console.log(`${a.ref}: disclosure document, information statement and agreement in final form given ${on}. It may be signed from ${addDays(on, 14)}.`));
}

async function agreementSign(db, args, flags) {
  const a = await resolveAgreement(db, args.join(' '));
  if (a.status !== 'pending') throw new CliError(`${a.ref} is ${a.status}, not waiting to be signed.`);
  const on = parseDate(flags.on || 'today');
  if (!a.disclosure_given_on) throw new CliError(`${a.ref} has no disclosure date on record. Give the disclosure document first: agreements disclose ${a.ref} --on=YYYY-MM-DD`);
  const given = isoDate(a.disclosure_given_on);
  const days = daysBetween(given, on);
  if (days < 14) throw new CliError(`${a.ref} cannot be signed on ${on}: the disclosure document was given ${given}, ${days} day(s) before. The Franchising Code (s23) needs 14 days. Earliest: ${addDays(given, 14)}.`);
  const start = isoDate(a.term_start) || on;
  const end = isoDate(a.term_end) || addDays(start, Math.round(5 * 365.25) - 1);
  await db.query("update agreements set status = 'active', signed_on = $2, term_start = $3, term_end = $4 where id = $1", [a.agreement_id, on, start, end]);
  if (a.kind === 'renewal' || a.kind === 'extension' || a.kind === 'transfer') {
    await db.query("update agreements set status = 'ended', ended_on = $3, end_reason = $4 where site_id = $1 and status = 'active' and id <> $2",
      [a.site_id, a.agreement_id, on, a.kind === 'transfer' ? `Transferred to ${a.franchisee}` : `Replaced by ${a.kind} ${a.ref}`]);
    await db.query('update sites set franchisee_id = $2 where id = $1', [a.site_id, a.franchisee_id]);
  }
  const cooling = a.kind === 'new' || a.kind === 'transfer' ? addDays(on, 14) : null;
  out(flags, { ref: a.ref, signed_on: on, term_start: start, term_end: end, cooling_off_ends_on: cooling }, () =>
    console.log(`${a.ref} signed ${on}, term ${start} to ${end}.${cooling ? ` Cooling off runs to ${cooling}: hold fit-out spend until then.` : ''}`));
}

async function agreementNotice(db, args, flags) {
  const a = await resolveAgreement(db, args.join(' '));
  if (a.status !== 'active') throw new CliError(`${a.ref} is ${a.status}.`);
  const intent = str(flags.intent);
  if (!['extend', 'renew', 'not extend', 'undecided'].includes(intent)) throw new CliError('--intent is extend, renew, "not extend" or undecided: what the notice tells the franchisee.');
  const on = parseDate(flags.on || 'today');
  await db.query('update agreements set end_of_term_notice_on = $2, end_of_term_intent = $3 where id = $1', [a.agreement_id, on, intent]);
  const late = a.notice_due_by && on > isoDate(a.notice_due_by);
  out(flags, { ref: a.ref, end_of_term_notice_on: on, intent, late }, () =>
    console.log(`${a.ref}: end of term notice recorded ${on} (${intent}).${late ? ` It was due by ${d(a.notice_due_by)}: keep the record of why it was late.` : ''}`));
}

async function agreementCoolOff(db, args, flags) {
  const a = await resolveAgreement(db, args.join(' '));
  if (a.status !== 'active' || !a.cooling_off_ends_on) throw new CliError(`${a.ref} is not a signed new or transferred agreement.`);
  const on = parseDate(flags.on || 'today');
  if (on > isoDate(a.cooling_off_ends_on)) throw new CliError(`${a.ref}'s cooling off ended ${d(a.cooling_off_ends_on)}. After that the franchisee proposes termination instead (s54).`);
  await db.query("update agreements set status = 'cooled off', ended_on = $2, end_reason = 'Franchisee terminated in the cooling off period' where id = $1", [a.agreement_id, on]);
  out(flags, { ref: a.ref, status: 'cooled off', ended_on: on }, () =>
    console.log(`${a.ref}: terminated in cooling off on ${on}. Repay what the franchisee paid, less the reasonable expenses the agreement sets out, within 14 days (s51).`));
}

async function agreementEnd(db, args, flags) {
  const a = await resolveAgreement(db, args.join(' '));
  if (a.status !== 'active') throw new CliError(`${a.ref} is ${a.status}.`);
  const reason = str(flags.reason);
  if (!reason) throw new CliError('Ending an agreement needs a reason: --reason="Term ended, not extended" (termination for breach goes through breaches terminate).');
  const on = parseDate(flags.on || 'today');
  await db.query("update agreements set status = 'ended', ended_on = $2, end_reason = $3 where id = $1", [a.agreement_id, on, reason]);
  out(flags, { ref: a.ref, status: 'ended', ended_on: on, reason }, () => console.log(`${a.ref} ended ${on}: ${reason}.`));
}

// ---------------------------------------------------------------- royalties

async function cmdRoyalties(db, args, flags) {
  const sub = args[0];
  if (sub === 'report') return royaltyReport(db, args.slice(1), flags);
  if (sub === 'paid') return royaltyPaid(db, args.slice(1), flags);
  const params = [];
  const where = [];
  if (flags.site) { const s = await resolveSite(db, flags.site); params.push(s.id); where.push(`site_id = $${params.length}`); }
  if (flags.month) { params.push(parsePeriod(flags.month)); where.push(`period = $${params.length}`); }
  else if (!flags.site) where.push("(period = (date_trunc('month', current_date) - interval '1 month')::date or state like 'OVERDUE%' or state = 'NOT REPORTED')");
  const rows = await db.query(`select * from v_royalties ${where.length ? 'where ' + where.join(' and ') : ''} order by period desc, site_ref`, params);
  out(flags, rows, () => {
    console.log(heading(flags.month ? `Royalties for ${rows[0]?.month || flags.month}` : flags.site ? 'Royalties for the site' : 'The royalty run: last month, plus anything overdue or unreported'));
    console.log(table(rows, [
      { key: 'site_ref', label: 'site' }, { key: 'site', label: 'name' }, { key: 'month', label: 'month' },
      { key: 'gross_sales_cents', label: 'sales', align: 'right', format: (v, r) => (v === null ? '' : money(v, r.currency)) },
      { key: 'royalty_cents', label: 'royalty', align: 'right', format: cash() },
      { key: 'marketing_cents', label: 'levy', align: 'right', format: cash() },
      { key: 'balance_cents', label: 'balance', align: 'right', format: (v, r) => (num(v) ? money(v, r.currency) : '') },
      { key: 'state', label: 'state' },
    ]));
  });
}

async function cmdArrears(db, flags) {
  const rows = await db.query(`
    select site_ref, site, franchisee, currency, count(*) as months, sum(balance_cents) as balance_cents, max(days_overdue) as oldest_days
      from v_royalties where state like 'OVERDUE%' group by site_ref, site, franchisee, currency order by sum(balance_cents) desc`);
  const missing = await db.query("select site_ref, site, franchisee, month, current_date - due_on as days from v_royalties where state = 'NOT REPORTED' order by period");
  out(flags, { arrears: rows, not_reported: missing }, () => {
    console.log(heading('Royalty arrears by site'));
    console.log(table(rows, [
      { key: 'site_ref', label: 'site' }, { key: 'site', label: 'name' }, { key: 'franchisee', label: 'franchisee' },
      { key: 'months', label: 'months', align: 'right' }, { key: 'balance_cents', label: 'owed', align: 'right', format: cash() },
      { key: 'oldest_days', label: 'oldest', align: 'right', format: (v) => `${v}d` },
    ]));
    console.log(heading('Sales reports not received'));
    console.log(table(missing, [{ key: 'site_ref', label: 'site' }, { key: 'site', label: 'name' }, { key: 'franchisee', label: 'franchisee' }, { key: 'month', label: 'month' }, { key: 'days', label: 'days late', align: 'right' }]));
  });
}

async function royaltyReport(db, args, flags) {
  const s = await resolveSite(db, args.join(' ') || flags.site);
  const period = parsePeriod(flags.period || flags.month);
  const sales = parseMoney(flags.sales, 'sales');
  const [a] = await db.query("select * from agreements where site_id = $1 and status = 'active' order by term_start desc limit 1", [s.id]);
  if (!a) throw new CliError(`${s.name} has no active agreement, so there is no royalty rate to apply.`);
  const royalty = Math.max(Math.round((sales * Number(a.royalty_pct)) / 100), num(a.min_royalty_cents));
  const levy = Math.round((sales * Number(a.marketing_pct)) / 100);
  const dueOn = (() => { const [y, m] = period.split('-').map(Number); const next = new Date(y, m, 7); const pad = (n) => String(n).padStart(2, '0'); return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`; })();
  const reported = parseDate(flags.on || 'today');
  await db.query(`insert into sales_reports (site_id, agreement_id, period, gross_sales_cents, reported_on, royalty_cents, marketing_cents, due_on)
                  values ($1,$2,$3,$4,$5,$6,$7,$8)
                  on conflict (site_id, period) do update set gross_sales_cents = excluded.gross_sales_cents, reported_on = excluded.reported_on,
                     royalty_cents = excluded.royalty_cents, marketing_cents = excluded.marketing_cents, agreement_id = excluded.agreement_id`,
    [s.id, a.id, period, sales, reported, royalty, levy, dueOn]);
  out(flags, { site: s.ref, period, gross_sales_cents: sales, royalty_cents: royalty, marketing_cents: levy, due_on: dueOn }, () =>
    console.log(`${s.name} ${period.slice(0, 7)}: sales ${money(sales, s.currency)}, royalty ${money(royalty, s.currency)} at ${a.royalty_pct}%${royalty === num(a.min_royalty_cents) && royalty > 0 ? ' (the monthly minimum)' : ''}, levy ${money(levy, s.currency)}. Due ${dueOn}.`));
}

async function royaltyPaid(db, args, flags) {
  const s = await resolveSite(db, args.join(' ') || flags.site);
  const period = parsePeriod(flags.period || flags.month);
  const [r] = await db.query('select * from v_royalties where site_id = $1 and period = $2', [s.id, period]);
  if (!r) throw new CliError(`No ${period.slice(0, 7)} report for ${s.name}. Record the sales first: royalties report "${s.name}" --period=${period.slice(0, 7)} --sales=`);
  const amount = flags.amount ? parseMoney(flags.amount) : num(r.balance_cents);
  const on = parseDate(flags.on || 'today');
  await db.query('update sales_reports set paid_cents = paid_cents + $2, paid_on = $3 where id = $1', [r.report_id, amount, on]);
  const left = num(r.balance_cents) - amount;
  out(flags, { site: s.ref, period, paid_cents: amount, balance_cents: left }, () =>
    console.log(`${s.name} ${r.month}: ${money(amount, s.currency)} received ${on}.${left > 0 ? ` ${money(left, s.currency)} still owing.` : ' Paid in full.'}`));
}

// ---------------------------------------------------------------- field visits

async function cmdVisits(db, args, flags) {
  const sub = args[0];
  if (sub === 'schedule') return visitSchedule(db, args.slice(1), flags);
  if (sub === 'complete') return visitComplete(db, args.slice(1), flags);
  const due = await db.query(`select ref, name, field_manager, last_visit_on, last_score, next_visit_due_on, next_visit_due_on - current_date as days
                                from v_sites where status = 'trading' and next_visit_due_on <= current_date + $1::int order by next_visit_due_on`, [num(flags.days || 30)]);
  const scheduled = await db.query(`select a.ref, s.name as site, a.kind, a.scheduled_on, st.name as by
                                      from audits a join sites s on s.id = a.site_id left join staff st on st.id = a.staff_id
                                     where a.status = 'scheduled' order by a.scheduled_on`);
  out(flags, { due, scheduled }, () => {
    console.log(heading('Visits due (overdue first)'));
    console.log(table(due, [
      { key: 'ref', label: 'site' }, { key: 'name', label: 'name' }, { key: 'field_manager', label: 'field manager' },
      { key: 'last_visit_on', label: 'last visit', format: d }, { key: 'last_score', label: 'score', align: 'right' },
      { key: 'next_visit_due_on', label: 'due', format: d }, { key: 'days', label: 'days', align: 'right', format: (v) => (num(v) < 0 ? `${-num(v)} late` : `in ${v}`) },
    ]));
    console.log(heading('Booked'));
    console.log(table(scheduled, [{ key: 'ref', label: 'ref' }, { key: 'site', label: 'site' }, { key: 'kind', label: 'kind' }, { key: 'scheduled_on', label: 'on', format: d }, { key: 'by', label: 'by' }]));
  });
}

async function visitSchedule(db, args, flags) {
  const s = await resolveSite(db, args.join(' '));
  const on = parseDate(flags.on);
  if (!on) throw new CliError('When? --on=YYYY-MM-DD');
  const by = (await resolveStaff(db, flags.by)) || (s.field_manager_id ? { id: s.field_manager_id } : null);
  const ref = await nextRef(db, 'audits', 'V', 801);
  await db.query("insert into audits (ref, site_id, staff_id, kind, status, scheduled_on) values ($1,$2,$3,$4,'scheduled',$5)", [ref, s.id, by?.id || null, str(flags.kind) || 'quality', on]);
  out(flags, { ref, site: s.ref, scheduled_on: on }, () => console.log(`${ref}: ${str(flags.kind) || 'quality'} visit to ${s.name} booked for ${on}.`));
}

async function visitComplete(db, args, flags) {
  const a = await resolveRef(db, 'audits', args[0], 'visit');
  if (a.status === 'completed') throw new CliError(`${a.ref} is already completed.`);
  if (flags.score === undefined || flags.score === true) throw new CliError('A completed visit needs its score: --score=0..100 (and --summary="...").');
  const score = Number(flags.score);
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new CliError('--score is a whole number from 0 to 100.');
  const on = parseDate(flags.on || 'today');
  await db.query("update audits set status = 'completed', visited_on = $2, score = $3, summary = $4 where id = $1", [a.id, on, score, str(flags.summary) || null]);
  out(flags, { ref: a.ref, visited_on: on, score }, () => console.log(`${a.ref} completed ${on}, score ${score}. Add each finding: findings add ${a.ref} --item= --severity= --due=`));
}

async function cmdFindings(db, args, flags) {
  const sub = args[0];
  if (sub === 'add') return findingAdd(db, args.slice(1), flags);
  if (sub === 'close') return findingClose(db, args.slice(1), flags);
  const rows = await db.query(`select * from v_findings ${flags.all ? '' : 'where closed_on is null'} order by (severity = 'critical') desc, (severity = 'major') desc, due_on`);
  out(flags, rows, () => {
    console.log(heading(flags.all ? 'All findings' : 'Open findings, critical first'));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'site', label: 'site' }, { key: 'severity', label: 'severity' }, { key: 'item', label: 'item', width: 64 },
      { key: 'due_on', label: 'due', format: d }, { key: 'days_overdue', label: 'late', align: 'right', format: (v) => (v ? `${v}d` : '') },
    ]));
  });
}

async function findingAdd(db, args, flags) {
  const a = await resolveRef(db, 'audits', args[0], 'visit');
  const item = str(flags.item);
  if (!item) throw new CliError('What was found? --item="..."');
  const severity = str(flags.severity) || 'minor';
  if (!['critical', 'major', 'minor'].includes(severity)) throw new CliError('--severity is critical, major or minor.');
  const due = parseDate(flags.due) || addDays(today(), severity === 'critical' ? 2 : severity === 'major' ? 14 : 30);
  const [{ n }] = await db.query('select count(*) as n from findings where audit_id = $1', [a.id]);
  const ref = `${a.ref}-${num(n) + 1}`;
  await db.query('insert into findings (ref, audit_id, item, severity, due_on) values ($1,$2,$3,$4,$5)', [ref, a.id, item, severity, due]);
  out(flags, { ref, severity, due_on: due }, () => console.log(`${ref} (${severity}) due ${due}: ${item}`));
}

async function findingClose(db, args, flags) {
  const f = await resolveRef(db, 'findings', args[0], 'finding');
  if (f.closed_on) throw new CliError(`${f.ref} closed ${d(f.closed_on)} already.`);
  const evidence = str(flags.evidence);
  if (!evidence) throw new CliError(`A finding closes on evidence, not on a promise: --evidence="photo of the new signage sent 3 Oct".`);
  const on = parseDate(flags.on || 'today');
  await db.query('update findings set closed_on = $2, evidence = $3 where id = $1', [f.id, on, evidence]);
  out(flags, { ref: f.ref, closed_on: on }, () => console.log(`${f.ref} closed ${on}.`));
}

// ---------------------------------------------------------------- support desk

async function cmdTickets(db, args, flags) {
  const sub = args[0];
  if (sub === 'add') return ticketAdd(db, flags);
  if (sub === 'resolve') return ticketResolve(db, args.slice(1), flags);
  if (sub === 'assign') return ticketAssign(db, args.slice(1), flags);
  const rows = await db.query(`
    select t.ref, s.name as site, t.subject, t.category, t.priority, st.name as owner, t.status, t.opened_on, current_date - t.opened_on as age
      from tickets t left join sites s on s.id = t.site_id left join staff st on st.id = t.owner_id
     ${flags.all ? '' : "where t.status <> 'resolved'"}
     order by array_position(array['urgent','high','normal','low'], t.priority), t.opened_on`);
  out(flags, rows, () => {
    console.log(heading('Support tickets'));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'priority', label: 'priority' }, { key: 'site', label: 'site' }, { key: 'subject', label: 'subject', width: 50 },
      { key: 'owner', label: 'owner', format: (v) => v || 'UNASSIGNED' }, { key: 'status', label: 'status' }, { key: 'age', label: 'age', align: 'right', format: (v) => `${v}d` },
    ]));
  });
}

async function ticketAdd(db, flags) {
  const s = await resolveSite(db, flags.site);
  const subject = str(flags.subject);
  if (!subject) throw new CliError('--subject="..." is required.');
  const owner = await resolveStaff(db, flags.owner);
  const ref = await nextRef(db, 'tickets', 'T', 301);
  await db.query('insert into tickets (ref, site_id, subject, category, priority, owner_id) values ($1,$2,$3,$4,$5,$6)',
    [ref, s.id, subject, str(flags.category) || 'operations', str(flags.priority) || 'normal', owner?.id || null]);
  out(flags, { ref, site: s.ref }, () => console.log(`${ref} opened for ${s.name}: ${subject}`));
}

async function ticketResolve(db, args, flags) {
  const t = await resolveRef(db, 'tickets', args[0], 'ticket');
  const resolution = str(flags.resolution);
  if (!resolution) throw new CliError('Say how it was resolved: --resolution="..."');
  await db.query("update tickets set status = 'resolved', resolved_on = $2, resolution = $3 where id = $1", [t.id, parseDate(flags.on || 'today'), resolution]);
  out(flags, { ref: t.ref, status: 'resolved' }, () => console.log(`${t.ref} resolved.`));
}

async function ticketAssign(db, args, flags) {
  const t = await resolveRef(db, 'tickets', args[0], 'ticket');
  const owner = await resolveStaff(db, flags.to || flags.owner);
  if (!owner) throw new CliError('Assign to whom? --to="Sophie Kerr"');
  await db.query('update tickets set owner_id = $2 where id = $1', [t.id, owner.id]);
  out(flags, { ref: t.ref, owner: owner.name }, () => console.log(`${t.ref} now with ${owner.name}.`));
}

// ---------------------------------------------------------------- certificates

async function cmdCerts(db, args, flags) {
  if (args[0] === 'add' || args[0] === 'renew') return certRecord(db, flags);
  const rows = await db.query(`
    select s.ref as site_ref, s.name as site, c.holder, c.kind, c.expires_on, c.expires_on - current_date as days
      from certificates c join sites s on s.id = c.site_id
     where s.status <> 'closed' and c.required ${flags.all ? '' : 'and c.expires_on <= current_date + 90'}
     order by c.expires_on`);
  out(flags, rows, () => {
    console.log(heading(flags.all ? 'Certificates' : 'Certificates expired or expiring in 90 days'));
    console.log(table(rows, [
      { key: 'site_ref', label: 'site' }, { key: 'site', label: 'name' }, { key: 'holder', label: 'holder' }, { key: 'kind', label: 'certificate' },
      { key: 'expires_on', label: 'expires', format: d }, { key: 'days', label: 'days', align: 'right', format: (v) => (num(v) < 0 ? `EXPIRED ${-num(v)}d` : `${v}`) },
    ]));
  });
}

async function certRecord(db, flags) {
  const s = await resolveSite(db, flags.site);
  const holder = str(flags.holder);
  const kind = str(flags.kind) || 'Food safety supervisor';
  const expires = parseDate(flags.expires);
  if (!holder || !expires) throw new CliError('A certificate needs --holder="Name" and --expires=YYYY-MM-DD (and --kind= if not food safety supervisor).');
  const issued = parseDate(flags.issued || 'today');
  const hit = await db.query('select id from certificates where site_id = $1 and lower(kind) = lower($2) and (lower(holder) = lower($3) or $4)', [s.id, kind, holder, Boolean(flags.replace)]);
  if (hit.length) await db.query('update certificates set holder = $2, issued_on = $3, expires_on = $4 where id = $1', [hit[0].id, holder, issued, expires]);
  else await db.query('insert into certificates (site_id, holder, kind, issued_on, expires_on) values ($1,$2,$3,$4,$5)', [s.id, holder, kind, issued, expires]);
  out(flags, { site: s.ref, holder, kind, expires_on: expires }, () => console.log(`${s.name}: ${kind} for ${holder} recorded to ${expires}.`));
}

// ---------------------------------------------------------------- breach notices

async function cmdBreaches(db, args, flags) {
  const sub = args[0];
  if (sub === 'issue') return breachIssue(db, args.slice(1), flags);
  if (sub === 'remedied') return breachSet(db, args.slice(1), flags, 'remedied');
  if (sub === 'withdraw') return breachSet(db, args.slice(1), flags, 'withdrawn');
  if (sub === 'terminate') return breachTerminate(db, args.slice(1), flags);
  const rows = await db.query(`
    select b.ref, a.ref as agreement, s.name as site, f.name as franchisee, b.issued_on, b.breach, b.remedy, b.remedy_by,
           b.remedy_by - b.issued_on as remedy_days, b.remedy_by - current_date as days_left, b.status, b.remedied_on
      from breach_notices b join agreements a on a.id = b.agreement_id join sites s on s.id = a.site_id join franchisees f on f.id = a.franchisee_id
     ${flags.all ? '' : "where b.status = 'open'"} order by b.remedy_by`);
  out(flags, rows, () => {
    console.log(heading(flags.all ? 'Breach notices' : 'Open breach notices'));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'site', label: 'site' }, { key: 'franchisee', label: 'franchisee' }, { key: 'breach', label: 'breach', width: 44 },
      { key: 'remedy_by', label: 'remedy by', format: d }, { key: 'days_left', label: 'left', align: 'right', format: (v, r) => (r.status === 'open' ? `${v}d` : '') },
      { key: 'status', label: 'status' },
    ]));
  });
}

async function breachIssue(db, args, flags) {
  const a = await resolveAgreement(db, args.join(' '));
  if (a.status !== 'active') throw new CliError(`${a.ref} is ${a.status}.`);
  const breach = str(flags.breach);
  const remedy = str(flags.remedy);
  if (!breach || !remedy) throw new CliError('A breach notice says what the breach is and what fixes it: --breach="..." --remedy="..." [--days=30]');
  const on = parseDate(flags.on || 'today');
  const days = num(flags.days || 30);
  if (days < 1) throw new CliError('--days must be at least 1.');
  const by = addDays(on, days);
  const ref = await nextRef(db, 'breach_notices', 'B', 1).then((r) => r.replace(/^B-(\d)$/, 'B-0$1'));
  await db.query('insert into breach_notices (ref, agreement_id, issued_on, breach, remedy, remedy_by) values ($1,$2,$3,$4,$5,$6)', [ref, a.agreement_id, on, breach, remedy, by]);
  out(flags, { ref, agreement: a.ref, issued_on: on, remedy_by: by, remedy_days: days }, () => {
    console.log(`${ref} recorded against ${a.ref} (${a.site}): remedy by ${by}.`);
    if (days < 30) console.log(`  ${days} days to remedy. s55 says the time must be reasonable and need not be more than 30 days: keep why ${days} is reasonable on file.`);
    console.log('  Draft the notice itself with /draft-breach-notice. Nothing has been sent.');
  });
}

async function breachSet(db, args, flags, status) {
  const b = await resolveRef(db, 'breach_notices', args[0], 'breach notice');
  if (b.status !== 'open') throw new CliError(`${b.ref} is ${b.status}.`);
  const on = parseDate(flags.on || 'today');
  await db.query('update breach_notices set status = $2, remedied_on = case when $2 = \'remedied\' then $3::date end where id = $1', [b.id, status, on]);
  out(flags, { ref: b.ref, status }, () => console.log(`${b.ref} ${status} ${on}.`));
}

async function breachTerminate(db, args, flags) {
  const b = await resolveRef(db, 'breach_notices', args[0], 'breach notice');
  if (b.status !== 'open') throw new CliError(`${b.ref} is ${b.status}: there is nothing to terminate on.`);
  const on = parseDate(flags.on || 'today');
  if (on <= isoDate(b.remedy_by)) throw new CliError(`${b.ref} gives until ${d(b.remedy_by)} to remedy. Termination for this breach cannot be recorded before then (s55).`);
  await db.query("update breach_notices set status = 'terminated' where id = $1", [b.id]);
  await db.query("update agreements set status = 'terminated', ended_on = $2, end_reason = $3 where id = $1", [b.agreement_id, on, `Terminated for breach: ${b.breach} (${b.ref})`]);
  out(flags, { ref: b.ref, agreement_terminated_on: on }, () =>
    console.log(`${b.ref}: agreement terminated ${on}. The franchisee may dispute it under Part 5. Have your lawyer check the notice before it goes.`));
}

// ---------------------------------------------------------------- franchise sales

async function cmdProspects(db, args, flags) {
  const sub = args[0];
  if (sub === 'add') return prospectAdd(db, flags);
  if (sub === 'disclose') return prospectDisclose(db, args.slice(1), flags);
  if (sub === 'stage') return prospectStage(db, args.slice(1), flags);
  const rows = await db.query(`select * from v_prospects ${flags.all ? '' : "where stage not in ('signed', 'lost')"}
                                order by array_position(array['disclosure given','discovery day','qualified','enquiry','signed','lost'], stage), days_quiet desc`);
  out(flags, rows, () => {
    console.log(heading('Franchise sales pipeline'));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'name', label: 'name' }, { key: 'territory_wanted', label: 'territory' }, { key: 'stage', label: 'stage' },
      { key: 'source', label: 'source' }, { key: 'days_quiet', label: 'quiet', align: 'right', format: (v) => `${v}d` },
      { key: 'may_sign_from', label: 'may sign from', format: d },
    ]));
  });
}

async function prospectAdd(db, flags) {
  const name = str(flags.name);
  if (!name) throw new CliError('A prospect needs --name= (and --email= --phone= --territory= --source=).');
  const ref = await nextRef(db, 'prospects', 'P', 901);
  const owner = await resolveStaff(db, flags.owner);
  await db.query('insert into prospects (ref, name, email, phone, territory_wanted, source, owner_id, last_contact_on) values ($1,$2,$3,$4,$5,$6,$7,current_date)',
    [ref, name, str(flags.email) || null, str(flags.phone) || null, str(flags.territory) || null, str(flags.source) || null, owner?.id || null]);
  out(flags, { ref, name }, () => console.log(`${ref} added: ${name}${flags.territory ? ', wants ' + flags.territory : ''}.`));
}

async function prospectDisclose(db, args, flags) {
  const p = await resolveRef(db, 'prospects', args[0], 'prospect');
  const on = parseDate(flags.on || 'today');
  await db.query("update prospects set stage = 'disclosure given', disclosure_given_on = $2, last_contact_on = $2 where id = $1", [p.id, on]);
  out(flags, { ref: p.ref, disclosure_given_on: on, may_sign_from: addDays(on, 14) }, () =>
    console.log(`${p.ref} ${p.name}: disclosure document given ${on}. Nothing may be signed before ${addDays(on, 14)}.`));
}

async function prospectStage(db, args, flags) {
  const p = await resolveRef(db, 'prospects', args[0], 'prospect');
  const to = str(flags.to);
  if (!['enquiry', 'qualified', 'discovery day', 'signed', 'lost'].includes(to)) throw new CliError('--to is enquiry, qualified, "discovery day", signed or lost (disclosure goes through prospects disclose).');
  if (to === 'lost' && !str(flags.reason)) throw new CliError('Say why: --reason="..."');
  if (to === 'signed') {
    if (!p.disclosure_given_on) throw new CliError(`${p.ref} has no disclosure on record. Nothing is signed without it (s23).`);
    const days = daysBetween(isoDate(p.disclosure_given_on), today());
    if (days < 14) throw new CliError(`${p.ref} was given disclosure ${days} day(s) ago. Signing waits for 14 days (s23): from ${addDays(isoDate(p.disclosure_given_on), 14)}.`);
  }
  await db.query('update prospects set stage = $2, lost_reason = $3, last_contact_on = current_date where id = $1', [p.id, to, to === 'lost' ? str(flags.reason) : null]);
  out(flags, { ref: p.ref, stage: to }, () => console.log(`${p.ref} ${p.name} is now ${to}.`));
}

// ---------------------------------------------------------------- marketing fund and disclosure year

async function cmdFund(db, args, flags) {
  const sub = args[0];
  if (sub === 'spend') return fundSpend(db, flags);
  if (sub === 'statement') return fundStatement(db, flags);
  const years = await db.query('select * from v_fund order by fy_end desc limit 3');
  const fy = flags.year ? `${String(flags.year).slice(0, 4)}-06-30` : null;
  const spend = await db.query(`select category, count(*) as lines, sum(amount_cents) as amount_cents from fund_spend
                                 where fy_end_for(spent_on) = coalesce($1::date, fy_end_for(current_date)) group by category order by sum(amount_cents) desc`, [fy]);
  out(flags, { years, spend }, () => {
    console.log(heading('Marketing fund by financial year'));
    console.log(table(years, [
      { key: 'fy_end', label: 'year to', format: d }, { key: 'levied_cents', label: 'levied', align: 'right', format: cash('AUD') },
      { key: 'collected_cents', label: 'collected', align: 'right', format: cash('AUD') }, { key: 'spent_cents', label: 'spent', align: 'right', format: cash('AUD') },
      { key: 'statement_due_by', label: 'statement due', format: d },
      { key: 'fund_statement_prepared_on', label: 'prepared', format: d }, { key: 'fund_statement_given_on', label: 'given', format: d },
      { key: 'fund_audited_on', label: 'audited', format: (v, r) => (v ? d(v) : r.fund_audit_opt_out ? 'opted out' : '') },
    ]));
    console.log(heading(`Spend this ${fy ? 'year to ' + fy : 'financial year'} by category`));
    console.log(table(spend, [{ key: 'category', label: 'category' }, { key: 'lines', label: 'lines', align: 'right' }, { key: 'amount_cents', label: 'amount', align: 'right', format: cash('AUD') }]));
    console.log('\n  AUD and NZD levies are added together here. Split them with /customise if the fund is kept separately.');
  });
}

async function fundSpend(db, flags) {
  const amount = parseMoney(flags.amount);
  const category = str(flags.category);
  if (!category) throw new CliError('--category is required: Digital ads, Creative, Local area marketing, Admin...');
  const on = parseDate(flags.on || 'today');
  await db.query('insert into fund_spend (spent_on, category, supplier, amount_cents, note) values ($1,$2,$3,$4,$5)', [on, category, str(flags.supplier) || null, amount, str(flags.note) || null]);
  out(flags, { spent_on: on, category, amount_cents: amount }, () => console.log(`Fund spend recorded: ${money(amount, 'AUD')} on ${category} (${on}).`));
}

async function fundStatement(db, flags) {
  const fy = flags.year ? `${String(flags.year).slice(0, 4)}-06-30` : null;
  const [y] = await db.query('select * from franchisor_years where fy_end = coalesce($1::date, (fy_end_for(current_date) - interval \'1 year\')::date)', [fy]);
  if (!y) throw new CliError(`No financial year to ${fy || 'last 30 June'} on record.`);
  const sets = [];
  const params = [y.id];
  for (const [flag, col] of [['prepared', 'fund_statement_prepared_on'], ['given', 'fund_statement_given_on'], ['audited', 'fund_audited_on'], ['disclosure-updated', 'disclosure_updated_on'], ['register-updated', 'register_updated_on']]) {
    if (flags[flag]) { params.push(parseDate(flags[flag] === true ? 'today' : flags[flag])); sets.push(`${col} = $${params.length}`); }
  }
  if (flags['opt-out']) sets.push('fund_audit_opt_out = true');
  if (!sets.length) throw new CliError('Record a date: --prepared --given --audited --disclosure-updated --register-updated (each takes a date, default today), or --opt-out when 75% of contributors voted out the audit.');
  await db.query(`update franchisor_years set ${sets.join(', ')} where id = $1`, params);
  const [now] = await db.query('select * from v_fund where fy_end = $1', [y.fy_end]);
  out(flags, now, () => console.log(`Year to ${d(y.fy_end)} updated: statement prepared ${d(now.fund_statement_prepared_on) || 'no'}, given ${d(now.fund_statement_given_on) || 'no'}, audited ${now.fund_audit_opt_out ? 'opted out' : d(now.fund_audited_on) || 'no'}, disclosure ${d(now.disclosure_updated_on) || 'not updated'}, Register ${d(now.register_updated_on) || 'not updated'}.`));
}

// ---------------------------------------------------------------- notes

async function cmdLog(db, args, flags) {
  const body = str(flags.body);
  if (!body) throw new CliError('What happened? --body="..." [--kind=call|email|meeting|visit|note]');
  const term = args.join(' ');
  let site = null;
  let franchisee = null;
  let prospect = null;
  if (/^P-\d+$/i.test(term)) prospect = await resolveRef(db, 'prospects', term, 'prospect');
  else {
    try { site = await resolveSite(db, term); } catch { franchisee = await resolveFranchisee(db, term); }
    if (site && !franchisee && site.franchisee_id) franchisee = { id: site.franchisee_id };
  }
  const by = await resolveStaff(db, flags.by);
  const kind = str(flags.kind) || 'note';
  await db.query('insert into notes (franchisee_id, site_id, prospect_id, staff_id, noted_on, kind, body) values ($1,$2,$3,$4,$5,$6,$7)',
    [franchisee?.id || null, site?.id || null, prospect?.id || null, by?.id || null, parseDate(flags.on || 'today'), kind, body]);
  if (prospect) await db.query('update prospects set last_contact_on = current_date where id = $1', [prospect.id]);
  out(flags, { logged: true, site: site?.ref, prospect: prospect?.ref, kind }, () => console.log(`Logged ${kind} on ${site?.name || prospect?.name || 'the franchisee'}.`));
}

// ---------------------------------------------------------------- compliance

const RULES = [
  { id: 'disclosure-14-days', title: 'Nothing is signed until 14 days after the disclosure document is given', source: 'Franchising Code of Conduct 2024 (Cth) s23',
    sql: `select ref, site || ', ' || franchisee as who, days_considered as days, kind || ' signed ' || signed_on || ', disclosure ' || coalesce(disclosure_given_on::text, 'not on record') as detail
            from v_agreements where signed_on is not null and signed_on >= current_date - 2190 and (disclosure_given_on is null or days_considered < 14)` },
  { id: 'end-of-term-notice', title: 'End of term notice goes 6 months before the term ends (1 month for short terms)', source: 'Franchising Code of Conduct 2024 (Cth) s36',
    sql: `select ref, site || ', ' || franchisee as who, current_date - notice_due_by as days, 'term ends ' || term_end || ', notice due by ' || notice_due_by || ', none on record' as detail
            from v_agreements where state = 'NOTICE LATE'` },
  { id: 'fund-statement', title: 'The marketing fund statement is prepared within 4 months of year end and given within 30 days', source: 'Franchising Code of Conduct 2024 (Cth) s31',
    sql: `select to_char(fy_end, 'YYYY-MM-DD') as ref, 'Marketing fund' as who,
                 current_date - case when fund_statement_prepared_on is null then statement_due_by else fund_statement_prepared_on + 30 end as days,
                 case when fund_statement_prepared_on is null then 'not prepared, was due ' || statement_due_by
                      when fund_statement_given_on is null then 'prepared ' || fund_statement_prepared_on || ', not given to contributors'
                      else 'given ' || fund_statement_given_on || ', more than 30 days after it was prepared' end as detail
            from v_fund where fy_end < current_date
             and ((fund_statement_prepared_on is null and current_date > statement_due_by)
               or (fund_statement_prepared_on is not null and fund_statement_given_on is null and current_date > fund_statement_prepared_on + 30)
               or (fund_statement_given_on > fund_statement_prepared_on + 30))` },
  { id: 'fund-audit', title: 'The marketing fund statement is audited, unless 75% of contributors voted it out', source: 'Franchising Code of Conduct 2024 (Cth) s31',
    sql: `select to_char(fy_end, 'YYYY-MM-DD') as ref, 'Marketing fund' as who, current_date - statement_due_by as days, 'no audit and no opt-out on record' as detail
            from v_fund where fy_end < current_date and current_date > statement_due_by and fund_audited_on is null and not fund_audit_opt_out` },
  { id: 'disclosure-update', title: 'The disclosure document is updated within 4 months of the financial year end', source: 'Franchising Code of Conduct 2024 (Cth) s21',
    sql: `select to_char(fy_end, 'YYYY-MM-DD') as ref, 'Disclosure document' as who, current_date - disclosure_due_by as days, 'not updated, was due ' || disclosure_due_by as detail
            from v_fund where fy_end < current_date and disclosure_updated_on is null and current_date > disclosure_due_by` },
  { id: 'register', title: 'The Franchise Disclosure Register entry is updated or confirmed each year', source: 'Franchising Code of Conduct 2024 (Cth) s93; set the due date to the Register\'s published date (it was 14 November in 2025)',
    sql: `select to_char(fy_end, 'YYYY-MM-DD') as ref, 'Franchise Disclosure Register' as who, current_date - (disclosure_due_by + 14) as days, 'not updated for the year, due ' || (disclosure_due_by + 14) as detail
            from v_fund where fy_end < current_date and register_updated_on is null and current_date > disclosure_due_by + 14` },
  { id: 'breach-remedy-time', title: 'Breach notices give a reasonable time to remedy (flagged under 30 days)', source: 'Franchising Code of Conduct 2024 (Cth) s55',
    sql: `select b.ref, s.name as who, b.remedy_by - b.issued_on as days, (b.remedy_by - b.issued_on) || ' days to remedy: ' || b.breach as detail
            from breach_notices b join agreements a on a.id = b.agreement_id join sites s on s.id = a.site_id
           where b.remedy_by - b.issued_on < 30 and b.issued_on >= current_date - 2190` },
  { id: 'insurance', title: 'Every active franchisee holds current public liability insurance', source: 'Your franchise agreement and operations manual',
    sql: `select ref, name as who, current_date - insurance_expires_on as days, coalesce('expired ' || insurance_expires_on, 'no policy on record') as detail
            from franchisees where status = 'active' and (insurance_expires_on is null or insurance_expires_on < current_date)` },
  { id: 'certificates', title: 'Every trading site holds its required certificates', source: 'Food Act 2003 (NSW) and Food Act 2006 (Qld) food safety supervisor requirements; the food control plan each NZ site runs under the Food Act 2014 (NZ); your operations manual',
    sql: `select s.ref, s.name || ', ' || c.holder as who, current_date - c.expires_on as days, c.kind || ' expired ' || c.expires_on as detail
            from certificates c join sites s on s.id = c.site_id where s.status = 'trading' and c.required and c.expires_on < current_date` },
  { id: 'sales-reported', title: 'Every site reports monthly sales by the royalty due date', source: 'Your franchise agreement (royalty and reporting clause)',
    sql: `select site_ref as ref, site || ', ' || franchisee as who, current_date - due_on as days, month || ' sales not reported' as detail from v_royalties where state = 'NOT REPORTED'` },
  { id: 'critical-findings', title: 'Critical findings from a field visit are fixed by their due date', source: 'Your operations manual; the food safety rules behind the finding',
    sql: `select ref, site as who, days_overdue as days, item as detail from v_findings where severity = 'critical' and closed_on is null and due_on < current_date` },
];

async function cmdCompliance(db, flags) {
  const results = [];
  for (const r of RULES) {
    const rows = await db.query(`${r.sql} order by 3 desc nulls last`);
    results.push({ rule: r.id, title: r.title, source: r.source, count: rows.length, worst: rows[0] || null, rows });
  }
  out(flags, results, () => {
    console.log(heading('Compliance: the rules in docs/compliance.md, run against the records'));
    console.log(table(results, [
      { key: 'count', label: 'breaches', align: 'right' },
      { key: 'title', label: 'rule', width: 76 },
      { key: 'worst', label: 'worst', width: 46, format: (v) => (v ? `${v.ref} ${v.who} (${v.days ?? '-'}d)` : 'clean') },
    ]));
    for (const r of results.filter((x) => x.count)) {
      console.log(`\n  ${r.title}\n  source: ${r.source}`);
      for (const row of r.rows.slice(0, 5)) console.log(`    ${row.ref}  ${row.who}  ${row.detail}`);
    }
    console.log('\n  Nothing here is legal advice. Change docs/compliance.md and this check together.');
  });
}

// ---------------------------------------------------------------- import and export

// Naranga is gone and its export columns were never published, so the import
// matches the header names a franchisor's location list and lead list usually
// carry, and reports every column it did not use.
const SITE_COLS = {
  site: ['Location', 'Location Name', 'Site', 'Site Name', 'Store', 'Store Name', 'Unit', 'Unit Name'],
  number: ['Location Number', 'Location #', 'Location ID', 'Store Number', 'Store #', 'Unit Number', 'Site ID', 'ID'],
  owner: ['Franchisee', 'Owner', 'Owner Name', 'Franchisee Name', 'Primary Contact', 'Contact'],
  entity: ['Entity', 'Company', 'Legal Name', 'Business Name', 'Franchisee Entity'],
  email: ['Email', 'Owner Email', 'Franchisee Email', 'Email Address'],
  phone: ['Phone', 'Owner Phone', 'Mobile', 'Phone Number'],
  address: ['Address', 'Street', 'Address 1', 'Street Address'],
  suburb: ['City', 'Suburb', 'Town'],
  state: ['State', 'Region', 'Province'],
  country: ['Country'],
  opened: ['Open Date', 'Opened', 'Opening Date', 'Date Opened'],
  start: ['Agreement Start', 'Contract Start', 'Term Start', 'Agreement Date', 'Signed Date'],
  end: ['Agreement End', 'Contract End', 'Term End', 'Expiration Date', 'Expiry Date', 'Renewal Date'],
  royalty: ['Royalty %', 'Royalty Rate', 'Royalty', 'Royalty Percent'],
  marketing: ['Marketing %', 'Ad Fund %', 'Marketing Fund %', 'Brand Fund %', 'Marketing Levy'],
  insurance: ['Insurance Expiration', 'Insurance Expiry', 'COI Expiration', 'Insurance Expires'],
  status: ['Status', 'Location Status'],
};
const LEAD_COLS = {
  name: ['Name', 'Full Name', 'Lead Name', 'Contact Name'],
  first: ['First Name', 'First'],
  last: ['Last Name', 'Last'],
  email: ['Email', 'Email Address'],
  phone: ['Phone', 'Mobile', 'Phone Number', 'Cell'],
  territory: ['Territory', 'Desired Territory', 'Market', 'Area of Interest', 'City'],
  source: ['Source', 'Lead Source'],
  stage: ['Stage', 'Status', 'Lead Status'],
  created: ['Created', 'Date Created', 'Created Date', 'Lead Date'],
  id: ['Lead ID', 'ID'],
};

function unusedColumns(rows, map) {
  if (!rows.length) return [];
  const used = new Set(Object.values(map).flat().map((c) => c.toLowerCase()));
  return Object.keys(rows[0]).filter((k) => !used.has(k.toLowerCase()));
}

function leadStage(v) {
  const s = String(v || '').toLowerCase();
  if (/lost|dead|disqual|closed lost|not interested/.test(s)) return 'lost';
  if (/fdd|disclos/.test(s)) return 'disclosure given';
  if (/discovery|meet/.test(s)) return 'discovery day';
  if (/qualif|app|interview/.test(s)) return 'qualified';
  return 'enquiry';
}

async function cmdImport(db, args, flags) {
  if (args[0] !== 'naranga' && args[0] !== 'csv') throw new CliError('import naranga --locations=<file.csv> [--leads=<file.csv>] [--dry-run]');
  if (!flags.locations && !flags.leads) throw new CliError('Give --locations=<csv> (your location and franchisee list) and/or --leads=<csv> (your franchise sales leads).');
  const read = (f) => {
    const file = path.resolve(String(f));
    if (!existsSync(file)) throw new CliError(`No file at ${file}. Save the export as CSV and pass its path.`);
    return parseCsv(readFileSync(file, 'utf8'));
  };
  const locations = flags.locations ? read(flags.locations) : [];
  const leads = flags.leads ? read(flags.leads) : [];
  const summary = { sites_created: 0, sites_skipped: 0, franchisees_created: 0, agreements_created: 0, prospects_created: 0, prospects_skipped: 0,
    unused_columns: { locations: unusedColumns(locations, SITE_COLS), leads: unusedColumns(leads, LEAD_COLS) }, problems: [] };
  const p = (row, key, map) => pick(row, ...map[key]);
  await db.exec('BEGIN');
  try {
    for (const [i, row] of locations.entries()) {
      const name = p(row, 'site', SITE_COLS);
      if (!name) { summary.problems.push(`locations row ${i + 2}: no location name`); continue; }
      const number = p(row, 'number', SITE_COLS);
      const ref = `NR-${(number || name).replace(/[^A-Za-z0-9]+/g, '-').replace(/(^-|-$)/g, '').toUpperCase()}`;
      if ((await db.query('select 1 from sites where ref = $1', [ref])).length) { summary.sites_skipped++; continue; }
      const ownerName = p(row, 'owner', SITE_COLS);
      let owner = null;
      if (ownerName) {
        owner = (await db.query('select * from franchisees where lower(name) = lower($1)', [ownerName]))[0];
        if (!owner) {
          const fref = await nextRef(db, 'franchisees', 'FE', 1).then((r) => r.replace(/^FE-(\d)$/, 'FE-0$1'));
          [owner] = await db.query('insert into franchisees (ref, name, entity, email, phone, insurance_expires_on, external_ref) values ($1,$2,$3,$4,$5,$6,$7) returning *',
            [fref, ownerName, p(row, 'entity', SITE_COLS) || null, p(row, 'email', SITE_COLS) || null, p(row, 'phone', SITE_COLS) || null,
              parseDate(p(row, 'insurance', SITE_COLS)), number || null]);
          summary.franchisees_created++;
        }
      }
      const country = /nz|new zealand/i.test(p(row, 'country', SITE_COLS)) ? 'NZ' : 'AU';
      const statusRaw = p(row, 'status', SITE_COLS).toLowerCase();
      const status = /clos|termin|inactive/.test(statusRaw) ? 'closed' : /open(ing)?\s*soon|pending|develop/.test(statusRaw) ? 'opening' : 'trading';
      const [site] = await db.query(`insert into sites (ref, name, franchisee_id, address, suburb, state, country, currency, status, opened_on, external_ref)
                                     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
        [ref, name, owner?.id || null, p(row, 'address', SITE_COLS) || null, p(row, 'suburb', SITE_COLS) || null, p(row, 'state', SITE_COLS) || null,
          country, country === 'NZ' ? 'NZD' : 'AUD', status, parseDate(p(row, 'opened', SITE_COLS)), number || null]);
      summary.sites_created++;
      const start = parseDate(p(row, 'start', SITE_COLS));
      const end = parseDate(p(row, 'end', SITE_COLS));
      if (owner && (start || end)) {
        const aref = `NR-A-${ref.slice(3)}`;
        const pct = (v, dflt) => { const n = Number(String(v || '').replace('%', '')); return Number.isFinite(n) && n > 0 ? n : dflt; };
        await db.query(`insert into agreements (ref, site_id, franchisee_id, kind, status, signed_on, term_start, term_end, royalty_pct, marketing_pct, external_ref)
                        values ($1,$2,$3,'new',$4,$5,$5,$6,$7,$8,$9)`,
          [aref, site.id, owner.id, status === 'closed' ? 'ended' : 'active', start || end, end && start && end > start ? end : null,
            pct(p(row, 'royalty', SITE_COLS), 6), pct(p(row, 'marketing', SITE_COLS), 2), number || null]);
        if (status === 'closed') await db.query("update agreements set ended_on = coalesce(term_end, current_date), end_reason = 'Closed before import' where ref = $1", [aref]);
        summary.agreements_created++;
      }
    }
    for (const [i, row] of leads.entries()) {
      const name = p(row, 'name', LEAD_COLS) || [p(row, 'first', LEAD_COLS), p(row, 'last', LEAD_COLS)].filter(Boolean).join(' ');
      if (!name) { summary.problems.push(`leads row ${i + 2}: no name`); continue; }
      const email = p(row, 'email', LEAD_COLS);
      const external = p(row, 'id', LEAD_COLS) || email || name;
      if ((await db.query('select 1 from prospects where external_ref = $1', [external])).length) { summary.prospects_skipped++; continue; }
      const stage = leadStage(p(row, 'stage', LEAD_COLS));
      const created = parseDate(p(row, 'created', LEAD_COLS)) || today();
      const ref = await nextRef(db, 'prospects', 'P', 901);
      // A lead marked as given disclosure arrives without the date: the 14 day clock needs it before anyone signs.
      await db.query(`insert into prospects (ref, name, email, phone, territory_wanted, source, stage, enquired_on, last_contact_on, disclosure_given_on, lost_reason, external_ref)
                      values ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11)`,
        [ref, name, email || null, p(row, 'phone', LEAD_COLS) || null, p(row, 'territory', LEAD_COLS) || null, p(row, 'source', LEAD_COLS) || null,
          stage === 'disclosure given' ? 'qualified' : stage, created, null, stage === 'lost' ? 'Marked lost before import' : null, external]);
      summary.prospects_created++;
    }
    if (flags['dry-run']) await db.exec('ROLLBACK');
    else await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  const audit = flags['dry-run'] ? { no_agreement: [], no_insurance: [] } : {
    no_agreement: (await db.query("select s.ref || ' ' || s.name as s from sites s where s.ref like 'NR-%' and s.status <> 'closed' and not exists (select 1 from agreements a where a.site_id = s.id) order by s.ref")).map((r) => r.s),
    no_insurance: (await db.query("select f.ref || ' ' || f.name as f from franchisees f where f.status = 'active' and f.insurance_expires_on is null order by f.ref")).map((r) => r.f),
  };
  Object.assign(summary, audit);
  out(flags, { dry_run: Boolean(flags['dry-run']), ...summary }, () => {
    console.log(heading(flags['dry-run'] ? 'Import from Naranga exports: trial run, nothing written' : 'Import from Naranga exports'));
    console.log(`  sites ${summary.sites_created} new, ${summary.sites_skipped} already here; franchisees ${summary.franchisees_created} new; agreements ${summary.agreements_created}; prospects ${summary.prospects_created} new, ${summary.prospects_skipped} already here`);
    for (const [k, cols] of Object.entries(summary.unused_columns)) if (cols.length) console.log(`  columns not used from ${k}: ${cols.join(', ')} (map them with /customise)`);
    for (const pr of summary.problems) console.log(`  PROBLEM ${pr}`);
    if (summary.no_agreement.length) console.log(`  ${summary.no_agreement.length} site(s) have no agreement dates: the end of term clock cannot run until they do.`);
    if (summary.no_insurance.length) console.log(`  ${summary.no_insurance.length} franchisee(s) have no insurance expiry on record: the first audit item.`);
  });
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => { if (v === null || v === undefined) return ''; const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}

async function cmdExport(db, flags) {
  const dir = path.resolve(REPO_ROOT, str(flags.out) || path.join('exports', today()));
  mkdirSync(dir, { recursive: true });
  const tables = ['staff', 'franchisees', 'sites', 'agreements', 'sales_reports', 'audits', 'findings', 'tickets', 'certificates', 'breach_notices', 'prospects', 'franchisor_years', 'fund_spend', 'notes'];
  const counts = {};
  for (const t of tables) {
    const rows = await db.query(`select * from ${t} order by created_at, id`);
    writeFileSync(path.join(dir, `${t}.csv`), toCsv(rows));
    counts[t] = rows.length;
  }
  out(flags, { dir, counts }, () => console.log(`Exported ${tables.length} files to ${path.relative(REPO_ROOT, dir) || dir}: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`));
}

// ---------------------------------------------------------------- dispatch

const HELP = `franchise-for-claude-code

  stats                                     the network at a glance
  attention                                 everything that wants a decision, worst first
  network [--all]                           every site: sales trend, arrears, last visit, findings, tickets
  site <name|ref>                           one site's whole card
  franchisees [--all] | franchisees insurance <who> --expires= [--insurer= --policy=]
  agreements [--all]                        soonest ending first
  agreements add --site= --franchisee= [--kind=new|renewal|extension|transfer --start= --years=5 --royalty=6 --marketing=2]
  agreements disclose <ref> [--on=]         disclosure document given: the 14 day clock starts
  agreements sign <ref> [--on=]             refused inside 14 days of disclosure (s23)
  agreements notice <ref> --intent=extend|renew|"not extend"|undecided [--on=]
  agreements cool-off <ref> [--on=]         franchisee terminates inside 14 days of signing (s50)
  agreements end <ref> --reason=
  renewals [--days=365]                     agreements ending, with the s36 notice date
  royalties [--month= --site=]              the royalty run
  royalties report <site> --period=2026-09 --sales=84500
  royalties paid <site> --period= [--amount=]
  arrears                                   who owes what, and reports not received
  visits [--days=30]                        field visits due and booked
  visits schedule <site> --on= [--by= --kind=]
  visits complete <V-ref> --score= [--summary=]
  findings [--all] | findings add <V-ref> --item= --severity= [--due=] | findings close <ref> --evidence=
  tickets [--all] | tickets add --site= --subject= [--priority= --category= --owner=]
  tickets resolve <ref> --resolution= | tickets assign <ref> --to=
  certs [--all] | certs add --site= --holder= --expires= [--kind=]
  breaches [--all] | breaches issue <agreement> --breach= --remedy= [--days=30]
  breaches remedied|withdraw|terminate <ref>
  prospects [--all] | prospects add --name= [--email= --phone= --territory= --source=]
  prospects disclose <ref> | prospects stage <ref> --to=
  fund [--year=2026] | fund spend --amount= --category= [--supplier=]
  fund statement [--year=] [--prepared --given --audited --opt-out --disclosure-updated --register-updated]
  log <site|franchisee|P-ref> --body= [--kind=call|email|meeting|visit|note]
  compliance                                the rules in docs/compliance.md against the records
  import naranga --locations=<csv> [--leads=<csv>] [--dry-run]
  export [--out=<dir>]                      every record to CSV

  Any read command takes --json.`;

async function main() {
  const { args, flags } = parseArgv(process.argv.slice(2));
  const [cmd, ...rest] = args;
  if (!cmd || cmd === 'help' || flags.help) { console.log(HELP); return; }
  const db = await getDb();
  try {
    switch (cmd) {
      case 'stats': return await cmdStats(db, flags);
      case 'attention': return await cmdAttention(db, flags);
      case 'network': case 'sites': return await cmdNetwork(db, flags);
      case 'site': return await cmdSite(db, rest, flags);
      case 'franchisees': case 'franchisee': return await cmdFranchisees(db, rest, flags);
      case 'agreements': case 'agreement': return await cmdAgreements(db, rest, flags);
      case 'renewals': return await cmdRenewals(db, flags);
      case 'royalties': case 'royalty': return await cmdRoyalties(db, rest, flags);
      case 'arrears': return await cmdArrears(db, flags);
      case 'visits': case 'visit': return await cmdVisits(db, rest, flags);
      case 'findings': case 'finding': return await cmdFindings(db, rest, flags);
      case 'tickets': case 'ticket': return await cmdTickets(db, rest, flags);
      case 'certs': case 'cert': case 'certificates': return await cmdCerts(db, rest, flags);
      case 'breaches': case 'breach': return await cmdBreaches(db, rest, flags);
      case 'prospects': case 'prospect': case 'pipeline': return await cmdProspects(db, rest, flags);
      case 'fund': return await cmdFund(db, rest, flags);
      case 'log': return await cmdLog(db, rest, flags);
      case 'compliance': return await cmdCompliance(db, flags);
      case 'import': return await cmdImport(db, rest, flags);
      case 'export': return await cmdExport(db, flags);
      default: throw new CliError(`Unknown command "${cmd}". Run with no arguments for the list.`);
    }
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  console.error(e instanceof CliError ? e.message : e.stack || String(e));
  process.exit(e.code && Number.isInteger(e.code) ? e.code : 1);
});
