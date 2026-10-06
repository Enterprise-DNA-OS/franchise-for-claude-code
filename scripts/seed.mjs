#!/usr/bin/env node
// Loads supabase/seed.sql: Daybreak Bakehouse, a fictional Brisbane bakery cafe
// franchisor with fourteen sites in Queensland, New South Wales and Auckland,
// their agreements, seven months of sales reports, field visits, tickets,
// certificates, a breach notice, franchise sales prospects and the marketing
// fund. Dates are relative to today and every row has a unique key, so
// re-running it is harmless.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';

export async function seed(db) {
  const sql = readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8');
  await db.exec(sql);
  const [c] = await db.query(`
    select (select count(*) from franchisees)   as franchisees,
           (select count(*) from sites)         as sites,
           (select count(*) from agreements)    as agreements,
           (select count(*) from sales_reports) as sales_reports,
           (select count(*) from audits)        as visits,
           (select count(*) from findings)      as findings,
           (select count(*) from tickets)       as tickets,
           (select count(*) from prospects)     as prospects
  `);
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)]));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const db = await getDb();
  try {
    const counts = await seed(db);
    console.log('seeded:', Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' '));
  } finally {
    await db.close();
  }
}
