#!/usr/bin/env node
// End-to-end smoke test on a throwaway database.
// Runs migrate, seed, then every CLI command that matters, and asserts on the JSON.
// Embedded PGlite by default; set TEST_DATABASE_URL to run the same checks on a
// disposable Postgres. Passes on Windows and Linux. No network.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(path.join(tmpdir(), 'franchise-smoke-'));
const env = { ...process.env, DATA_DIR: path.join(dataDir, 'db'), OUTPUT_DIR: dataDir };
if (process.env.TEST_DATABASE_URL) env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else delete env.DATABASE_URL;

let step = 0;
function run(label, args, { json = true, expectFail = false } = {}) {
  step++;
  const argv = [path.join(root, 'scripts', args[0]), ...args.slice(1), ...(json ? ['--json'] : [])];
  const res = spawnSync(process.execPath, argv, { cwd: root, env, encoding: 'utf8' });
  const ok = expectFail ? res.status !== 0 : res.status === 0;
  if (!ok) {
    console.error(`\nFAIL step ${step} (${label}): exit ${res.status}\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}`);
    process.exit(1);
  }
  console.log(`  ok  ${String(step).padStart(2)}  ${label}`);
  if (!json || expectFail) return { stdout: res.stdout, stderr: res.stderr };
  try {
    return JSON.parse(res.stdout);
  } catch {
    console.error(`\nFAIL step ${step} (${label}): output is not JSON\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`\nFAIL assertion: ${msg}`);
    process.exit(1);
  }
}

const n = (v) => Number(v ?? 0);
const fr = (...a) => ['franchise.mjs', ...a];
const reasons = (rows) => new Set(rows.map((r) => r.reason));
const ym = (monthsBack) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - monthsBack); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

console.log(`smoke: ${env.DATABASE_URL ? 'Postgres at TEST_DATABASE_URL' : 'embedded database'}, output ${dataDir}`);
try {
  run('migrate', ['migrate.mjs'], { json: false });
  run('migrate again (idempotent)', ['migrate.mjs'], { json: false });
  run('seed', ['seed.mjs'], { json: false });
  run('seed again (idempotent)', ['seed.mjs'], { json: false });

  // ---- the network ------------------------------------------------------------

  const stats = run('stats', fr('stats'));
  assert(stats.trading_sites === 13 && stats.opening_sites === 1, `13 trading, 1 opening (${stats.trading_sites}, ${stats.opening_sites})`);
  assert(stats.by_currency.length === 2, 'AUD and NZD kept apart');
  assert(stats.by_currency.find((c) => c.currency === 'AUD').overdue_cents > 1000000, 'Southport arrears in AUD');

  const attention = run('attention', fr('attention'));
  const why = reasons(attention);
  for (const r of ['SIGNED INSIDE 14 DAYS', 'END OF TERM NOTICE LATE', 'CRITICAL FINDING OPEN', 'ROYALTY OVERDUE', 'SALES NOT REPORTED', 'BREACH NOTICE EXPIRING',
    'FUND STATEMENT DUE', 'DISCLOSURE UPDATE DUE', 'INSURANCE LAPSED', 'CERTIFICATE EXPIRED', 'VISIT OVERDUE', 'NOTICE DUE', 'COOLING OFF', 'SALES DOWN',
    'FINDING OVERDUE', 'TICKET WAITING', 'PROSPECT QUIET', 'CERTIFICATE EXPIRING', 'INSURANCE EXPIRING']) {
    assert(why.has(r), `attention shows ${r}`);
  }
  assert(attention[0].rank === 1, 'a rank 1 item is first');

  const network = run('network', fr('network'));
  assert(network.length === 14, `14 sites (${network.length})`);
  const parra = network.find((s) => s.ref === 'S-106');
  assert(n(parra.sales_trend_pct) <= -10, `Parramatta down on the quarter (${parra.sales_trend_pct})`);
  assert(network.find((s) => s.ref === 'S-108').sales_trend_pct === null, 'Chatswood has no trend while reports are missing');

  const card = run('site card by partial name', fr('site', 'southport'));
  assert(card.site.ref === 'S-105' && card.breach_notices.some((b) => b.ref === 'B-01'), 'Southport with its breach notice');
  assert(card.royalties.some((r) => String(r.state).startsWith('OVERDUE')), 'its overdue royalties are on the card');
  assert(run('site card by franchisee name', fr('site', 'whitford')).site.ref === 'S-114', 'a site found by its franchisee');
  run('ambiguous site name lists and fails', fr('site', 'a'), { json: false, expectFail: true });
  run('an unknown site fails', fr('site', 'Wagga'), { json: false, expectFail: true });

  const fes = run('franchisees', fr('franchisees'));
  assert(fes.length === 12 && run('franchisees --all', fr('franchisees', '--all')).length === 13, 'active and all franchisees');
  run('insurance renewed', fr('franchisees', 'insurance', 'Fatima', `--expires=${iso(365)}`));
  assert(!reasons(run('attention after insurance', fr('attention'))).has('INSURANCE LAPSED'), 'lapsed insurance cleared');

  // ---- agreements and the Code's clocks ----------------------------------------

  const renewals = run('renewals', fr('renewals'));
  assert(renewals.some((a) => a.ref === 'A-503' && a.state === 'NOTICE LATE'), 'Chermside notice is late');
  run('end of term notice needs an intent', fr('agreements', 'notice', 'A-503'), { json: false, expectFail: true });
  const notice = run('end of term notice recorded', fr('agreements', 'notice', 'Chermside', '--intent=extend'));
  assert(notice.late === true, 'recorded as late');
  assert(!run('renewals after notice', fr('renewals')).some((a) => a.state === 'NOTICE LATE'), 'no notice late now');

  const draft = run('agreement drafted', fr('agreements', 'add', '--site=Newstead', '--franchisee=Whitford', '--kind=renewal', `--start=${iso(30)}`));
  run('signing with no disclosure is refused', fr('agreements', 'sign', draft.ref), { json: false, expectFail: true });
  run('disclosure given today', fr('agreements', 'disclose', draft.ref));
  const early = run('signing inside 14 days is refused (s23)', fr('agreements', 'sign', draft.ref), { json: false, expectFail: true });
  assert(/14 days/.test(early.stderr), 'the refusal names the 14 days');
  run('disclosure back-dated 20 days', fr('agreements', 'disclose', draft.ref, `--on=${iso(-20)}`));
  const signed = run('signed after 14 days', fr('agreements', 'sign', draft.ref));
  assert(signed.cooling_off_ends_on === null, 'a renewal has no cooling off');
  const agreements = run('agreements --all', fr('agreements', '--all'));
  assert(agreements.find((a) => a.ref === 'A-515').status === 'ended', 'the renewal ended the agreement it replaced');
  run('cooling off outside 14 days is refused', fr('agreements', 'cool-off', 'A-501'), { json: false, expectFail: true });
  run('ending needs a reason', fr('agreements', 'end', 'A-512'), { json: false, expectFail: true });

  // ---- royalties --------------------------------------------------------------

  const run1 = run('royalty run', fr('royalties'));
  assert(run1.some((r) => r.site_ref === 'S-108' && r.state === 'NOT REPORTED'), 'Chatswood not reported');
  const arrears = run('arrears', fr('arrears'));
  assert(arrears.arrears.length === 1 && arrears.arrears[0].site_ref === 'S-105' && n(arrears.arrears[0].months) === 2, 'Southport two months behind');
  const rep = run('Chatswood reports sales', fr('royalties', 'report', 'Chatswood', `--period=${ym(2)}`, '--sales=88,400'));
  assert(rep.royalty_cents === 530400 && rep.marketing_cents === 176800, `6% royalty and 2% levy (${rep.royalty_cents}, ${rep.marketing_cents})`);
  const minimum = run('the monthly minimum royalty applies', fr('royalties', 'report', 'Manly', `--period=${ym(0)}`, '--sales=20000'));
  assert(minimum.royalty_cents === 300000, `Manly's floor of $3,000 (${minimum.royalty_cents})`);
  run('a negative sales figure is refused', fr('royalties', 'report', 'Manly', `--period=${ym(0)}`, '--sales=-5'), { json: false, expectFail: true });
  const part = run('part payment', fr('royalties', 'paid', 'Southport', `--period=${ym(3)}`, '--amount=2000'));
  assert(part.balance_cents > 0, 'still owing after a part payment');
  run('payment in full', fr('royalties', 'paid', 'Southport', `--period=${ym(3)}`));
  assert(run('arrears after payment', fr('arrears')).arrears[0].months == 1, 'one month left');
  run('paying a month with no report fails', fr('royalties', 'paid', 'Newstead', `--period=${ym(1)}`), { json: false, expectFail: true });

  // ---- field visits, findings, tickets, certificates ------------------------------

  const visits = run('visits due', fr('visits'));
  assert(visits.due[0].ref === 'S-104', 'Indooroopilly is the most overdue');
  const booked = run('visit booked', fr('visits', 'schedule', 'Indooroopilly', `--on=${iso(2)}`));
  run('a visit needs a score to complete', fr('visits', 'complete', booked.ref), { json: false, expectFail: true });
  run('visit completed', fr('visits', 'complete', booked.ref, '--score=87', '--summary=Back to standard'));
  const f = run('finding added', fr('findings', 'add', booked.ref, '--item=Hand basin blocked by stock', '--severity=major'));
  run('a finding does not close without evidence', fr('findings', 'close', f.ref), { json: false, expectFail: true });
  run('finding closed on evidence', fr('findings', 'close', 'V-807-1', '--evidence=Technician report and two days of logs sent'));
  assert(!reasons(run('attention after the fix', fr('attention'))).has('CRITICAL FINDING OPEN'), 'critical finding cleared');
  assert(run('findings', fr('findings')).length === 5, 'open findings');

  const tickets = run('tickets', fr('tickets'));
  assert(tickets[0].ref === 'T-301' && tickets[0].priority === 'urgent', 'the urgent oven ticket first');
  run('ticket assigned', fr('tickets', 'assign', 'T-304', '--to=Sophie'));
  run('resolving needs a resolution', fr('tickets', 'resolve', 'T-301'), { json: false, expectFail: true });
  run('ticket resolved', fr('tickets', 'resolve', 'T-301', '--resolution=Element replaced by the service agent'));
  run('ticket added', fr('tickets', 'add', '--site=Takapuna', '--subject=Coffee grinder burrs worn', '--priority=high'));

  const certs = run('certificates', fr('certs'));
  assert(certs.some((c) => c.site_ref === 'S-110' && n(c.days) < 0), 'Dee Why expired');
  run('certificate renewed', fr('certs', 'add', '--site=Dee Why', '--holder=Kara Walsh', `--expires=${iso(1825)}`));
  assert(!run('certificates after renewal', fr('certs')).some((c) => c.site_ref === 'S-110'), 'Dee Why current');

  // ---- breach notices -----------------------------------------------------------

  run('a notice needs breach and remedy', fr('breaches', 'issue', 'A-507'), { json: false, expectFail: true });
  const b = run('breach notice issued, 14 days', fr('breaches', 'issue', 'Newtown', '--breach=Temperature logs not kept', '--remedy=Keep logs twice daily for 14 days', '--days=14'));
  assert(b.remedy_days === 14, '14 days recorded');
  const early2 = run('termination before the remedy date is refused (s55)', fr('breaches', 'terminate', 'B-01'), { json: false, expectFail: true });
  assert(/s55/.test(early2.stderr), 'the refusal cites s55');
  run('breach remedied', fr('breaches', 'remedied', b.ref));
  run('terminating a remedied notice fails', fr('breaches', 'terminate', b.ref), { json: false, expectFail: true });
  assert(run('open breach notices', fr('breaches')).length === 1, 'one open notice');

  // ---- franchise sales -------------------------------------------------------------

  const pipeline = run('pipeline', fr('prospects'));
  assert(pipeline[0].ref === 'P-902' && pipeline[0].may_sign_from, 'disclosure given first, with its signing date');
  const signEarly = run('signing a prospect inside 14 days is refused', fr('prospects', 'stage', 'P-902', '--to=signed'), { json: false, expectFail: true });
  assert(/s23/.test(signEarly.stderr), 'cites s23');
  run('signing with no disclosure is refused', fr('prospects', 'stage', 'P-903', '--to=signed'), { json: false, expectFail: true });
  run('lost needs a reason', fr('prospects', 'stage', 'P-901', '--to=lost'), { json: false, expectFail: true });
  const np = run('prospect added', fr('prospects', 'add', '--name=Hannah Price', '--territory=Newcastle', '--source=Website'));
  run('disclosure given to the new prospect', fr('prospects', 'disclose', np.ref));
  run('call logged on a prospect', fr('log', 'P-906', '--body=Called, wants the Auckland east numbers', '--kind=call'));
  run('note logged on a site', fr('log', 'Parramatta', '--body=Arcade works finish in March', '--by=Aroha'));
  run('log needs a body', fr('log', 'Parramatta'), { json: false, expectFail: true });

  // ---- marketing fund, disclosure year, compliance ---------------------------------

  const fund = run('fund', fr('fund'));
  assert(fund.years.length === 3 && n(fund.years[1].levied_cents) > 0, 'levies by year');
  run('fund spend', fr('fund', 'spend', '--amount=1,250', '--category=Local area marketing', '--supplier=Letterbox Co'));
  run('fund statement needs a date flag', fr('fund', 'statement'), { json: false, expectFail: true });
  const comp1 = run('compliance', fr('compliance'));
  const rule = (rs, id) => rs.find((r) => r.rule === id);
  assert(comp1.length === 11, `eleven rules (${comp1.length})`);
  assert(rule(comp1, 'disclosure-14-days').count === 1, 'the Paddington transfer is flagged');
  assert(rule(comp1, 'breach-remedy-time').count === 2, 'both short remedy periods flagged');
  assert(rule(comp1, 'end-of-term-notice').count === 0, 'the late notice is now on record');
  run('fund statement and disclosure update recorded', fr('fund', 'statement', '--prepared', '--given', '--opt-out', '--disclosure-updated', '--register-updated'));
  const att = reasons(run('attention after the year end work', fr('attention')));
  assert(!att.has('FUND STATEMENT DUE') && !att.has('DISCLOSURE UPDATE DUE'), 'year end items cleared');
  const comp2 = run('compliance again', fr('compliance'));
  for (const id of ['fund-statement', 'fund-audit', 'disclosure-update', 'register', 'insurance', 'certificates', 'critical-findings']) assert(rule(comp2, id).count === 0, `${id} clean`);

  // ---- import from Naranga exports -------------------------------------------------

  const locations = path.join(dataDir, 'locations.csv');
  const leads = path.join(dataDir, 'leads.csv');
  writeFileSync(locations, [
    'Location Number,Location Name,Franchisee,Email,Phone,City,State,Country,Open Date,Agreement Start,Agreement End,Royalty %,Ad Fund %,Status,POS System',
    '2041,Toowong,Ana Silva,ana@example.com,0400 111 222,Toowong,QLD,Australia,01/03/2022,15/02/2022,14/02/2032,6%,2%,Open,Square',
    '2042,Hamilton,"Kerr, Jo",jo@example.com,021 555 010,Hamilton,WKO,New Zealand,12/07/2023,,,,,Open,Lightspeed',
    '2043,,Nobody,,,,,,,,,,,,',
  ].join('\r\n'));
  writeFileSync(leads, [
    'Lead ID,First Name,Last Name,Email,Phone,Desired Territory,Lead Source,Lead Status,Date Created',
    '7001,Mark,Ellis,mark@example.com,0400 333 444,Ipswich,Franchise portal,FDD Sent,02/09/2026',
    '7002,Sina,Fale,sina@example.com,021 777 888,Manukau,Website,New,20/09/2026',
  ].join('\r\n'));
  const dry = run('import dry run writes nothing', fr('import', 'naranga', `--locations=${locations}`, `--leads=${leads}`, '--dry-run'));
  assert(dry.sites_created === 2 && dry.prospects_created === 2 && dry.problems.length === 1, 'two sites, two leads, one nameless row');
  assert(dry.unused_columns.locations.includes('POS System'), 'unused columns are reported');
  assert(run('the dry run wrote nothing', fr('network')).length === 14, 'nothing written');
  const imp = run('import for real', fr('import', 'naranga', `--locations=${locations}`, `--leads=${leads}`));
  assert(imp.franchisees_created === 2 && imp.agreements_created === 1, 'two owners, one agreement with dates');
  assert(imp.no_agreement.length === 1 && imp.no_insurance.length === 2, 'the import is the first audit');
  const hamilton = run('the NZ site is in NZD', fr('site', 'Hamilton'));
  assert(hamilton.site.currency === 'NZD', 'NZD');
  const p2 = run('pipeline after import', fr('prospects'));
  assert(p2.some((p) => p.name === 'Mark Ellis' && p.stage === 'qualified' && !p.disclosure_given_on), 'a lead marked FDD sent arrives without a disclosure date, so the clock is not assumed');
  const again = run('re-import creates nothing', fr('import', 'naranga', `--locations=${locations}`, `--leads=${leads}`));
  assert(again.sites_created === 0 && again.sites_skipped === 2 && again.prospects_skipped === 2, 'idempotent');
  run('a missing import file fails loudly', fr('import', 'naranga', `--locations=${path.join(dataDir, 'nope.csv')}`), { json: false, expectFail: true });

  // ---- export, views, documents ----------------------------------------------------

  const exp = run('export', fr('export', `--out=${path.join(dataDir, 'export')}`));
  assert(n(exp.counts.sales_reports) > 90 && existsSync(path.join(dataDir, 'export', 'sites.csv')), 'every record exported');
  run('npm run view', ['view.mjs'], { json: false });
  for (const v of ['week', 'royalties']) assert(existsSync(path.join(dataDir, 'views', `${v}.html`)), `${v} view rendered`);
  run('npm run docs', ['docs.mjs'], { json: false });
  for (const doc of ['royalty-statement', 'visit-report', 'franchisee-file', 'fund-statement']) assert(readdirSync(path.join(dataDir, 'docs-out', doc)).length > 0, `${doc} rendered`);
  run('help', ['franchise.mjs', 'help'], { json: false });

  console.log(`\nPASS: ${step} checks`);
} finally {
  if (existsSync(dataDir)) {
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // Windows can hold the handle briefly; a leftover temp dir is harmless.
    }
  }
}
