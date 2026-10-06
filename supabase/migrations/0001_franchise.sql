-- Franchise for Claude Code: the schema.
--
-- A franchisor's network record the way Naranga held it, plus the clocks the
-- Australian Franchising Code of Conduct runs on: franchisees (the owners) and
-- their sites, franchise agreements with the disclosure, cooling-off and end of
-- term dates, monthly sales reports with the royalty and marketing levy they
-- raise, field visits (quality audits) and their findings, the support desk,
-- certificates at each site, breach notices, franchise sales prospects, the
-- marketing fund and the yearly disclosure update.
--
-- Money is stored in cents. Plain Postgres. Runs on any Postgres 13+ and on
-- PGlite. No extensions.

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- the franchisor's team

create table if not exists staff (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  role        text,                 -- 'Field manager', 'Franchise development', 'Support'
  region      text,
  email       text,
  status      text not null default 'active' check (status in ('active', 'former')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- franchisees and sites

create table if not exists franchisees (
  id                    uuid primary key default gen_random_uuid(),
  ref                   text not null unique,
  name                  text not null,          -- the person you deal with
  entity                text,                   -- 'Ridgeway Hospitality Pty Ltd'
  business_number       text,                   -- ABN or NZBN
  email                 text,
  phone                 text,
  insurer               text,
  insurance_policy      text,
  insurance_expires_on  date,                   -- public liability, as the agreement requires
  status                text not null default 'active' check (status in ('active', 'former')),
  external_ref          text,                   -- the Naranga id
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists sites (
  id                 uuid primary key default gen_random_uuid(),
  ref                text not null unique,      -- S-101
  name               text not null,
  franchisee_id      uuid references franchisees(id),
  field_manager_id   uuid references staff(id),
  address            text,
  suburb             text,
  state              text,                      -- NSW, QLD, VIC, AKL ...
  country            text not null default 'AU' check (country in ('AU', 'NZ')),
  currency           text not null default 'AUD' check (currency in ('AUD', 'NZD')),
  territory          text,
  status             text not null default 'trading' check (status in ('opening', 'trading', 'closed')),
  opened_on          date,
  closed_on          date,
  lease_expires_on   date,
  audit_every_days   integer not null default 90,
  external_ref       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------- agreements

create table if not exists agreements (
  id                         uuid primary key default gen_random_uuid(),
  ref                        text not null unique,   -- A-501
  site_id                    uuid not null references sites(id),
  franchisee_id              uuid not null references franchisees(id),
  kind                       text not null default 'new' check (kind in ('new', 'renewal', 'extension', 'transfer')),
  status                     text not null default 'pending' check (status in ('pending', 'active', 'ended', 'terminated', 'cooled off')),
  disclosure_given_on        date,      -- disclosure document, information statement, agreement in final form
  signed_on                  date,
  term_start                 date,
  term_end                   date,
  royalty_pct                numeric(5,2) not null default 6.00,
  marketing_pct              numeric(5,2) not null default 2.00,
  min_royalty_cents          bigint not null default 0,   -- a monthly floor, if the agreement has one
  end_of_term_notice_on      date,      -- s36 notice given to the franchisee
  end_of_term_intent         text check (end_of_term_intent in ('extend', 'renew', 'not extend', 'undecided')),
  ended_on                   date,
  end_reason                 text,
  external_ref               text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  check (term_end is null or term_start is null or term_end > term_start),
  check (status not in ('active', 'ended', 'terminated', 'cooled off') or signed_on is not null),
  check (status not in ('ended', 'terminated', 'cooled off') or (ended_on is not null and end_reason is not null))
);

-- ---------------------------------------------------------------- royalties

-- One row per site per month: the franchisee reports gross sales, the royalty
-- and the marketing levy follow from the agreement's percentages.
create table if not exists sales_reports (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references sites(id),
  agreement_id      uuid references agreements(id),
  period            date not null,             -- the first day of the month reported
  gross_sales_cents bigint,                    -- null until the franchisee reports
  reported_on       date,
  royalty_cents     bigint not null default 0,
  marketing_cents   bigint not null default 0,
  due_on            date not null,             -- when the royalty is payable
  paid_cents        bigint not null default 0,
  paid_on           date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (site_id, period),
  check (gross_sales_cents is null or gross_sales_cents >= 0),
  check (gross_sales_cents is null or reported_on is not null)
);

-- ---------------------------------------------------------------- field visits

create table if not exists audits (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique,        -- V-801
  site_id       uuid not null references sites(id),
  staff_id      uuid references staff(id),
  kind          text not null default 'quality' check (kind in ('quality', 'food safety', 'brand', 'opening', 'mystery shop')),
  status        text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  scheduled_on  date,
  visited_on    date,
  score         integer check (score between 0 and 100),
  summary       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (status <> 'completed' or (visited_on is not null and score is not null))
);

create table if not exists findings (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,          -- V-801-1
  audit_id    uuid not null references audits(id),
  item        text not null,
  severity    text not null default 'minor' check (severity in ('critical', 'major', 'minor')),
  due_on      date not null,
  closed_on   date,
  evidence    text,                          -- what showed it was fixed
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (closed_on is null or evidence is not null)
);

-- ---------------------------------------------------------------- support desk

create table if not exists tickets (
  id           uuid primary key default gen_random_uuid(),
  ref          text not null unique,         -- T-301
  site_id      uuid references sites(id),
  subject      text not null,
  category     text not null default 'operations' check (category in ('operations', 'supply', 'marketing', 'equipment', 'systems', 'people', 'other')),
  priority     text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
  owner_id     uuid references staff(id),
  opened_on    date not null default current_date,
  status       text not null default 'open' check (status in ('open', 'waiting on franchisee', 'resolved')),
  resolved_on  date,
  resolution   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (status <> 'resolved' or (resolved_on is not null and resolution is not null))
);

-- ---------------------------------------------------------------- certificates at each site

create table if not exists certificates (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references sites(id),
  holder       text not null,
  kind         text not null,                -- 'Food safety supervisor', 'RSA', 'Brand induction'
  required     boolean not null default true,
  issued_on    date,
  expires_on   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- breach notices

create table if not exists breach_notices (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique,       -- B-01
  agreement_id   uuid not null references agreements(id),
  issued_on      date not null,
  breach         text not null,
  remedy         text not null,              -- what the franchisee must do
  remedy_by      date not null,
  remedied_on    date,
  status         text not null default 'open' check (status in ('open', 'remedied', 'withdrawn', 'terminated')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (remedy_by > issued_on)
);

-- ---------------------------------------------------------------- franchise sales

create table if not exists prospects (
  id                    uuid primary key default gen_random_uuid(),
  ref                   text not null unique,   -- P-901
  name                  text not null,
  email                 text,
  phone                 text,
  territory_wanted      text,
  source                text,
  stage                 text not null default 'enquiry' check (stage in ('enquiry', 'qualified', 'discovery day', 'disclosure given', 'signed', 'lost')),
  owner_id              uuid references staff(id),
  enquired_on           date not null default current_date,
  last_contact_on       date,
  disclosure_given_on   date,
  lost_reason           text,
  site_id               uuid references sites(id),    -- the site they signed for
  external_ref          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (stage <> 'disclosure given' or disclosure_given_on is not null),
  check (stage <> 'lost' or lost_reason is not null)
);

-- ---------------------------------------------------------------- marketing fund and disclosure year

-- One row per financial year of the franchisor: the disclosure document update
-- (s21), the Franchise Disclosure Register (s93) and the marketing fund
-- statement (s31).
create table if not exists franchisor_years (
  id                          uuid primary key default gen_random_uuid(),
  fy_end                      date not null unique,   -- 2026-06-30
  disclosure_updated_on       date,
  register_updated_on         date,
  fund_statement_prepared_on  date,
  fund_statement_given_on     date,
  fund_audited_on             date,
  fund_audit_opt_out          boolean not null default false, -- 75% of contributing franchisees voted it out
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table if not exists fund_spend (
  id          uuid primary key default gen_random_uuid(),
  spent_on    date not null,
  category    text not null,       -- 'Digital ads', 'Creative', 'Local area marketing', 'Admin'
  supplier    text,
  amount_cents bigint not null check (amount_cents > 0),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- notes

create table if not exists notes (
  id             uuid primary key default gen_random_uuid(),
  franchisee_id  uuid references franchisees(id),
  site_id        uuid references sites(id),
  prospect_id    uuid references prospects(id),
  staff_id       uuid references staff(id),
  noted_on       date not null default current_date,
  kind           text not null default 'note' check (kind in ('note', 'call', 'email', 'meeting', 'visit')),
  body           text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (franchisee_id is not null or site_id is not null or prospect_id is not null)
);

create index if not exists sales_site_idx on sales_reports (site_id, period);
create index if not exists audits_site_idx on audits (site_id, visited_on);
create index if not exists findings_audit_idx on findings (audit_id);
create index if not exists agreements_site_idx on agreements (site_id);
create index if not exists tickets_site_idx on tickets (site_id, status);

do $$
declare t text;
begin
  foreach t in array array['staff','franchisees','sites','agreements','sales_reports','audits','findings','tickets','certificates','breach_notices','prospects','franchisor_years','fund_spend','notes'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- views

-- The current agreement for each site: the active one, else the latest signed.
create or replace view v_agreements as
select a.id as agreement_id, a.ref, a.kind, a.status, s.id as site_id, s.ref as site_ref, s.name as site,
       f.id as franchisee_id, f.name as franchisee, f.entity,
       a.disclosure_given_on, a.signed_on, a.term_start, a.term_end,
       a.royalty_pct, a.marketing_pct, a.min_royalty_cents,
       a.end_of_term_notice_on, a.end_of_term_intent, a.ended_on, a.end_reason,
       case when a.signed_on is not null and a.disclosure_given_on is not null then a.signed_on - a.disclosure_given_on end as days_considered,
       case when a.kind in ('new', 'transfer') and a.signed_on is not null then a.signed_on + 14 end as cooling_off_ends_on,
       case when a.term_end is not null then a.term_end - current_date end as days_to_end,
       -- s36: at least 6 months before the end of a term of 6 months or more, else 1 month.
       case when a.term_end is null or a.term_start is null then null
            when a.term_end >= (a.term_start + interval '6 months')::date then (a.term_end - interval '6 months')::date
            else (a.term_end - interval '1 month')::date end as notice_due_by,
       case
         when a.status <> 'active' then a.status
         when a.signed_on is not null and a.kind in ('new', 'transfer') and current_date <= a.signed_on + 14 then 'COOLING OFF'
         when a.term_end < current_date then 'EXPIRED, STILL TRADING'
         when a.end_of_term_notice_on is null and a.term_end is not null
              and current_date > (case when a.term_end >= (a.term_start + interval '6 months')::date then (a.term_end - interval '6 months')::date else (a.term_end - interval '1 month')::date end)
              then 'NOTICE LATE'
         when a.end_of_term_notice_on is null and a.term_end <= current_date + 300 then 'NOTICE DUE'
         else 'active'
       end as state
from agreements a
join sites s on s.id = a.site_id
join franchisees f on f.id = a.franchisee_id;

create or replace view v_royalties as
select r.id as report_id, s.id as site_id, s.ref as site_ref, s.name as site, s.currency, f.name as franchisee,
       r.period, to_char(r.period, 'Mon YYYY') as month, r.gross_sales_cents, r.reported_on,
       r.royalty_cents, r.marketing_cents, r.royalty_cents + r.marketing_cents as owed_cents,
       r.paid_cents, r.royalty_cents + r.marketing_cents - r.paid_cents as balance_cents,
       r.due_on, r.paid_on,
       case
         when r.gross_sales_cents is null and current_date > r.due_on then 'NOT REPORTED'
         when r.gross_sales_cents is null then 'awaiting report'
         when r.paid_cents >= r.royalty_cents + r.marketing_cents then 'paid'
         when current_date > r.due_on then 'OVERDUE ' || (current_date - r.due_on) || 'd'
         else 'due ' || r.due_on
       end as state,
       case when r.gross_sales_cents is not null and r.paid_cents < r.royalty_cents + r.marketing_cents and current_date > r.due_on
            then current_date - r.due_on end as days_overdue
from sales_reports r
join sites s on s.id = r.site_id
left join franchisees f on f.id = s.franchisee_id;

-- Each trading site on one line: sales against the network, money owed, last
-- visit, open findings and tickets.
create or replace view v_sites as
select s.id as site_id, s.ref, s.name, s.state, s.country, s.currency, s.status, s.opened_on, s.territory,
       f.id as franchisee_id, f.name as franchisee, st.name as field_manager,
       a.ref as agreement, a.term_end, a.state as agreement_state,
       last3.sales_3m_cents, prev3.sales_prev_3m_cents,
       case when prev3.sales_prev_3m_cents > 0
            then round(100.0 * (last3.sales_3m_cents - prev3.sales_prev_3m_cents) / prev3.sales_prev_3m_cents, 1) end as sales_trend_pct,
       coalesce(owe.balance_cents, 0) as arrears_cents,
       coalesce(owe.not_reported, 0) as reports_missing,
       v.last_visit_on, v.last_score,
       case when s.status = 'trading' then coalesce(v.last_visit_on, s.opened_on) + s.audit_every_days end as next_visit_due_on,
       (select count(*) from findings x join audits y on y.id = x.audit_id where y.site_id = s.id and x.closed_on is null) as open_findings,
       (select count(*) from tickets t where t.site_id = s.id and t.status <> 'resolved') as open_tickets
from sites s
left join franchisees f on f.id = s.franchisee_id
left join staff st on st.id = s.field_manager_id
left join lateral (select * from v_agreements x where x.site_id = s.id order by (x.status = 'active') desc, x.term_start desc nulls last limit 1) a on true
-- A quarter counts only when all three months are reported.
left join lateral (select case when count(gross_sales_cents) = 3 then sum(gross_sales_cents) end as sales_3m_cents from sales_reports r
                   where r.site_id = s.id and r.period >= (date_trunc('month', current_date) - interval '3 months')::date
                     and r.period < date_trunc('month', current_date)::date) last3 on true
left join lateral (select case when count(gross_sales_cents) = 3 then sum(gross_sales_cents) end as sales_prev_3m_cents from sales_reports r
                   where r.site_id = s.id and r.period >= (date_trunc('month', current_date) - interval '6 months')::date
                     and r.period < (date_trunc('month', current_date) - interval '3 months')::date) prev3 on true
left join lateral (select sum(case when state like 'OVERDUE%' then balance_cents else 0 end) as balance_cents,
                          count(*) filter (where state = 'NOT REPORTED') as not_reported
                   from v_royalties r where r.site_id = s.id) owe on true
left join lateral (select visited_on as last_visit_on, score as last_score from audits a
                   where a.site_id = s.id and a.status = 'completed' order by visited_on desc limit 1) v on true;

create or replace view v_findings as
select x.id as finding_id, x.ref, x.item, x.severity, x.due_on, x.closed_on, x.evidence,
       a.ref as visit, a.visited_on, s.id as site_id, s.ref as site_ref, s.name as site, st.name as field_manager,
       case when x.closed_on is null and x.due_on < current_date then current_date - x.due_on end as days_overdue
from findings x
join audits a on a.id = x.audit_id
join sites s on s.id = a.site_id
left join staff st on st.id = a.staff_id;

create or replace view v_prospects as
select p.id as prospect_id, p.ref, p.name, p.email, p.phone, p.territory_wanted, p.source, p.stage,
       st.name as owner, p.enquired_on, p.last_contact_on, p.disclosure_given_on, p.lost_reason,
       current_date - coalesce(p.last_contact_on, p.enquired_on) as days_quiet,
       case when p.disclosure_given_on is not null then p.disclosure_given_on + 14 end as may_sign_from
from prospects p
left join staff st on st.id = p.owner_id;

-- The franchisor's financial year runs 1 July to 30 June (change it with /customise).
create or replace function fy_end_for(d date) returns date
language sql immutable as $$
  select case when extract(month from d) <= 6
              then make_date(extract(year from d)::int, 6, 30)
              else make_date(extract(year from d)::int + 1, 6, 30) end
$$;

-- Marketing fund, financial year by financial year: what came in, what went out.
create or replace view v_fund as
select y.fy_end,
       (select coalesce(sum(r.marketing_cents), 0) from sales_reports r where fy_end_for(r.period) = y.fy_end) as levied_cents,
       (select coalesce(sum(least(r.paid_cents, r.marketing_cents)), 0) from sales_reports r where fy_end_for(r.period) = y.fy_end) as collected_cents,
       (select coalesce(sum(s.amount_cents), 0) from fund_spend s where fy_end_for(s.spent_on) = y.fy_end) as spent_cents,
       y.fund_statement_prepared_on, y.fund_statement_given_on, y.fund_audited_on, y.fund_audit_opt_out,
       -- s31 and s21: within four months after the end of the financial year (30 June gives 31 October).
       ((y.fy_end + 1) + interval '4 months')::date - 1 as statement_due_by,
       ((y.fy_end + 1) + interval '4 months')::date - 1 as disclosure_due_by,
       y.disclosure_updated_on, y.register_updated_on
from franchisor_years y;

-- Everything that wants a decision, worst first. rank 1 is today's first call.
create or replace view v_attention as
select 1 as rank, 'SIGNED INSIDE 14 DAYS' as reason, a.ref as label, a.site, a.franchisee as who,
       a.days_considered as days, 'signed ' || a.signed_on || ', ' || coalesce(a.days_considered::text, 'no') || ' day(s) after disclosure' as detail
from v_agreements a
where a.signed_on is not null and a.signed_on >= current_date - 365 and (a.disclosure_given_on is null or a.days_considered < 14)
union all
select 1, 'END OF TERM NOTICE LATE', a.ref, a.site, a.franchisee, current_date - a.notice_due_by,
       'term ends ' || a.term_end || ', notice was due by ' || a.notice_due_by
from v_agreements a where a.state = 'NOTICE LATE'
union all
select 1, 'CRITICAL FINDING OPEN', f.ref, f.site, f.field_manager, f.days_overdue, f.item || ' (due ' || f.due_on || ')'
from v_findings f where f.severity = 'critical' and f.closed_on is null and f.due_on < current_date
union all
select 2, 'ROYALTY OVERDUE', r.site_ref || ' ' || to_char(r.period, 'YYYY-MM'), r.site, r.franchisee, r.days_overdue,
       r.month || ': ' || r.currency || ' ' || to_char(r.balance_cents / 100.0, 'FM999,999,990') || ' outstanding'
from v_royalties r where r.state like 'OVERDUE%'
union all
select 2, 'SALES NOT REPORTED', r.site_ref || ' ' || to_char(r.period, 'YYYY-MM'), r.site, r.franchisee, current_date - r.due_on,
       r.month || ' sales report not received'
from v_royalties r where r.state = 'NOT REPORTED'
union all
select 2, 'BREACH NOTICE EXPIRING', b.ref, s.name, f.name, b.remedy_by - current_date,
       'remedy by ' || b.remedy_by || ': ' || b.remedy
from breach_notices b join agreements a on a.id = b.agreement_id join sites s on s.id = a.site_id join franchisees f on f.id = a.franchisee_id
where b.status = 'open' and b.remedy_by <= current_date + 7
union all
select 2, 'FUND STATEMENT DUE', to_char(v.fy_end, 'YYYY-MM-DD'), null, 'Marketing fund', v.statement_due_by - current_date,
       case when v.fund_statement_prepared_on is null then 'statement for the year to ' || v.fy_end || ' due by ' || v.statement_due_by
            else 'prepared ' || v.fund_statement_prepared_on || ', not yet given to contributing franchisees' end
from v_fund v
where v.fy_end < current_date and v.fy_end >= current_date - 400
  and (v.fund_statement_prepared_on is null or v.fund_statement_given_on is null)
  and v.statement_due_by <= current_date + 30
union all
select 2, 'DISCLOSURE UPDATE DUE', to_char(v.fy_end, 'YYYY-MM-DD'), null, 'Disclosure document', v.disclosure_due_by - current_date,
       case when v.disclosure_updated_on is null then 'yearly update for the year to ' || v.fy_end || ' due by ' || v.disclosure_due_by
            else 'disclosure updated ' || v.disclosure_updated_on || ', Franchise Disclosure Register not yet updated' end
from v_fund v
where v.fy_end < current_date and v.fy_end >= current_date - 400
  and (v.disclosure_updated_on is null or v.register_updated_on is null)
  and v.disclosure_due_by <= current_date + 30
union all
select 3, 'INSURANCE LAPSED', f.ref, null, f.name, current_date - f.insurance_expires_on, coalesce(f.insurer, 'public liability') || ' expired ' || f.insurance_expires_on
from franchisees f where f.status = 'active' and f.insurance_expires_on < current_date
union all
select 3, 'CERTIFICATE EXPIRED', c.kind, s.name, c.holder, current_date - c.expires_on, c.kind || ' expired ' || c.expires_on
from certificates c join sites s on s.id = c.site_id where s.status = 'trading' and c.required and c.expires_on < current_date
union all
select 3, 'VISIT OVERDUE', v.ref, v.name, v.field_manager, current_date - v.next_visit_due_on,
       'last visit ' || coalesce(v.last_visit_on::text, 'never') || ', visits due every ' || (select audit_every_days from sites x where x.id = v.site_id) || ' days'
from v_sites v where v.status = 'trading' and v.next_visit_due_on < current_date
union all
select 3, 'NOTICE DUE', a.ref, a.site, a.franchisee, a.notice_due_by - current_date,
       'term ends ' || a.term_end || ': end of term notice due by ' || a.notice_due_by
from v_agreements a where a.state = 'NOTICE DUE' and a.notice_due_by <= current_date + 60
union all
select 3, 'COOLING OFF', a.ref, a.site, a.franchisee, a.cooling_off_ends_on - current_date,
       'franchisee can still cool off until ' || a.cooling_off_ends_on || ': no fit-out spend yet'
from v_agreements a where a.state = 'COOLING OFF'
union all
select 4, 'SALES DOWN', v.ref, v.name, v.franchisee, null::integer,
       'last three months ' || v.sales_trend_pct || '% on the three before'
from v_sites v where v.status = 'trading' and v.sales_trend_pct <= -10
union all
select 4, 'FINDING OVERDUE', f.ref, f.site, f.field_manager, f.days_overdue, f.severity || ': ' || f.item
from v_findings f where f.severity <> 'critical' and f.closed_on is null and f.due_on < current_date
union all
select 4, 'TICKET WAITING', t.ref, s.name, coalesce(st.name, 'unassigned'), current_date - t.opened_on, t.priority || ': ' || t.subject
from tickets t left join sites s on s.id = t.site_id left join staff st on st.id = t.owner_id
where t.status = 'open' and (current_date - t.opened_on > case t.priority when 'urgent' then 1 when 'high' then 3 else 7 end)
union all
select 5, 'PROSPECT QUIET', p.ref, p.territory_wanted, p.name, p.days_quiet, p.stage || ', no contact in ' || p.days_quiet || ' days'
from v_prospects p where p.stage in ('enquiry', 'qualified', 'discovery day', 'disclosure given') and p.days_quiet > 14
union all
select 5, 'CERTIFICATE EXPIRING', c.kind, s.name, c.holder, c.expires_on - current_date, c.kind || ' expires ' || c.expires_on
from certificates c join sites s on s.id = c.site_id where s.status = 'trading' and c.required and c.expires_on between current_date and current_date + 45
union all
select 5, 'INSURANCE EXPIRING', f.ref, null, f.name, f.insurance_expires_on - current_date, 'public liability expires ' || f.insurance_expires_on
from franchisees f where f.status = 'active' and f.insurance_expires_on between current_date and current_date + 30;
