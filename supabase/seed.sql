-- Demo data: Daybreak Bakehouse, a fictional bakery cafe franchisor in Brisbane
-- with fourteen sites across Queensland, New South Wales and Auckland. Every
-- date is relative to today, every row has a unique key, and every insert is
-- ON CONFLICT DO NOTHING, so re-running this is harmless.
--
-- A month going quietly wrong, on purpose:
--   * a transfer signed nine days after the disclosure document was given
--   * Chermside's term ends in five months and no end of term notice has gone
--   * Newtown's cool room failed a visit and the critical finding is overdue
--   * Southport is two months behind on royalties with a breach notice running out
--   * Chatswood has not reported sales, and its public liability has lapsed
--   * Parramatta's sales are down on the quarter before
--   * Dee Why's food safety supervisor certificate expired
--   * Indooroopilly has not had a field visit in over four months
--   * an urgent oven ticket at Manly has sat for three days
--   * last year's marketing fund statement is not prepared yet
--   * a new site in Newstead signed five days ago and is still in cooling off

insert into staff (name, role, region, email) values
  ('Megan Hartley', 'Head of operations',    'All',              'megan@daybreakbakehouse.example'),
  ('Josh Tan',      'Field manager',         'Queensland',       'josh@daybreakbakehouse.example'),
  ('Aroha Ngata',   'Field manager',         'NSW and Auckland', 'aroha@daybreakbakehouse.example'),
  ('Liam Byrne',    'Franchise development', 'All',              'liam@daybreakbakehouse.example'),
  ('Sophie Kerr',   'Franchise support',     'All',              'sophie@daybreakbakehouse.example')
on conflict (name) do nothing;

insert into franchisees (ref, name, entity, business_number, email, phone, insurer, insurance_policy, insurance_expires_on, status) values
  ('FE-01', 'Priya Shah',      'Shah Bakehouse Pty Ltd',      '41 602 118 334', 'priya@shahbakehouse.example',  '0412 118 334', 'QBE',      'PL-77120', current_date + 210, 'active'),
  ('FE-02', 'Tom Gallagher',   'Gallagher Foods Pty Ltd',     '52 611 274 019', 'tom@gallagherfoods.example',   '0413 274 019', 'Allianz',  'PL-55102', current_date + 160, 'active'),
  ('FE-03', 'Mei Lin Zhou',    'MLZ Enterprises Pty Ltd',     '63 620 330 871', 'meilin@mlz.example',           '0414 330 871', 'CGU',      'PL-30981', current_date + 18,  'active'),
  ('FE-04', 'Daniel Brooks',   'Brooks Hospitality Pty Ltd',  '74 631 402 556', 'daniel@brookshosp.example',    '0415 402 556', 'QBE',      'PL-80213', current_date + 95,  'active'),
  ('FE-05', 'Sarah O''Neill',  'Sunrise Cafe Group Pty Ltd',  '85 640 519 203', 'sarah@sunrisecafe.example',    '0416 519 203', 'Allianz',  'PL-61077', current_date + 240, 'active'),
  ('FE-06', 'Hamish Reid',     'Reid and Co Pty Ltd',         '96 651 607 448', 'hamish@reidco.example',        '0417 607 448', 'CGU',      'PL-12554', current_date + 130, 'active'),
  ('FE-07', 'Fatima Haddad',   'Haddad Bakery Pty Ltd',       '17 660 713 925', 'fatima@haddadbakery.example',  '0418 713 925', 'QBE',      'PL-44890', current_date - 9,   'active'),
  ('FE-08', 'Ben Carter',      'Carter Family Trust',         '28 671 820 116', 'ben@carterfamily.example',     '0419 820 116', 'Allianz',  'PL-90345', current_date + 300, 'active'),
  ('FE-09', 'Wiremu Parata',   'Parata Kai Ltd',              '9429051234567',  'wiremu@paratakai.example',     '021 455 120',  'Vero',     'NZ-20871', current_date + 180, 'active'),
  ('FE-10', 'Grace Liu',       'Liu Holdings Ltd',            '9429057654321',  'grace@liuholdings.example',    '021 633 904',  'Vero',     'NZ-31560', current_date + 270, 'active'),
  ('FE-11', 'Olivia Nguyen',   'Nguyen Bakehouse Pty Ltd',    '39 680 911 302', 'olivia@nguyenbakehouse.example','0420 911 302','QBE',      'PL-99102', current_date + 345, 'active'),
  ('FE-12', 'James Whitford',  'Whitford Ventures Pty Ltd',   '40 691 004 778', 'james@whitford.example',       '0421 004 778', 'CGU',      'PL-20118', current_date + 360, 'active'),
  ('FE-13', 'Peter Lowe',      'Lowe Foods Pty Ltd',          '51 602 377 640', 'peter@lowefoods.example',      '0422 377 640', null,       null,       null,               'former')
on conflict (ref) do nothing;

insert into sites (ref, name, franchisee_id, field_manager_id, address, suburb, state, country, currency, territory, status, opened_on, lease_expires_on, audit_every_days)
select v.ref, v.name, (select id from franchisees where ref = v.fe), (select id from staff where name = v.fm),
       v.address, v.suburb, v.state, v.country, v.currency, v.territory, v.status, current_date - v.open_days, current_date + v.lease_days, 90
from (values
  ('S-101', 'Fortitude Valley', 'FE-01', 'Josh Tan',    '212 Brunswick St',   'Fortitude Valley', 'QLD', 'AU', 'AUD', 'Brisbane inner north', 'trading', 2400, 900),
  ('S-102', 'New Farm',         'FE-01', 'Josh Tan',    '85 Merthyr Rd',      'New Farm',         'QLD', 'AU', 'AUD', 'Brisbane inner east',  'trading', 1500, 1200),
  ('S-103', 'Chermside',        'FE-02', 'Josh Tan',    'Shop 14, Gympie Rd', 'Chermside',        'QLD', 'AU', 'AUD', 'Brisbane north',       'trading', 1675, 160),
  ('S-104', 'Indooroopilly',    'FE-03', 'Josh Tan',    '322 Moggill Rd',     'Indooroopilly',    'QLD', 'AU', 'AUD', 'Brisbane west',        'trading', 1100, 800),
  ('S-105', 'Southport',        'FE-04', 'Josh Tan',    '41 Nerang St',       'Southport',        'QLD', 'AU', 'AUD', 'Gold Coast north',     'trading', 900,  1000),
  ('S-106', 'Parramatta',       'FE-05', 'Aroha Ngata', '150 Church St',      'Parramatta',       'NSW', 'AU', 'AUD', 'Western Sydney',       'trading', 1580, 600),
  ('S-107', 'Newtown',          'FE-06', 'Aroha Ngata', '288 King St',        'Newtown',          'NSW', 'AU', 'AUD', 'Inner West Sydney',    'trading', 1300, 700),
  ('S-108', 'Chatswood',        'FE-07', 'Aroha Ngata', '9 Victoria Ave',     'Chatswood',        'NSW', 'AU', 'AUD', 'Lower North Shore',    'trading', 1000, 1100),
  ('S-109', 'Manly',            'FE-08', 'Aroha Ngata', '33 The Corso',       'Manly',            'NSW', 'AU', 'AUD', 'Northern Beaches',     'trading', 1800, 500),
  ('S-110', 'Dee Why',          'FE-08', 'Aroha Ngata', '20 Howard Ave',      'Dee Why',          'NSW', 'AU', 'AUD', 'Northern Beaches',     'trading', 700,  1300),
  ('S-111', 'Ponsonby',         'FE-09', 'Aroha Ngata', '170 Ponsonby Rd',    'Ponsonby',         'AKL', 'NZ', 'NZD', 'Auckland central',     'trading', 1200, 900),
  ('S-112', 'Takapuna',         'FE-10', 'Aroha Ngata', '12 Hurstmere Rd',    'Takapuna',         'AKL', 'NZ', 'NZD', 'Auckland North Shore', 'trading', 600,  1400),
  ('S-113', 'Paddington',       'FE-11', 'Josh Tan',    '190 Given Tce',      'Paddington',       'QLD', 'AU', 'AUD', 'Brisbane inner west',  'trading', 2000, 1000),
  ('S-114', 'Newstead',         'FE-12', 'Josh Tan',    '60 Skyring Tce',     'Newstead',         'QLD', 'AU', 'AUD', 'Brisbane inner north', 'opening', -60,  1825)
) as v(ref, name, fe, fm, address, suburb, state, country, currency, territory, status, open_days, lease_days)
on conflict (ref) do nothing;

-- Agreements. Five year terms; Chermside's ends in five months with no notice
-- given, Parramatta's ends in eight, Paddington was transferred nine days
-- after disclosure, Newstead signed five days ago.
insert into agreements (ref, site_id, franchisee_id, kind, status, disclosure_given_on, signed_on, term_start, term_end,
                        royalty_pct, marketing_pct, min_royalty_cents, end_of_term_notice_on, end_of_term_intent, ended_on, end_reason)
select v.ref, (select id from sites where ref = v.site), (select id from franchisees where ref = v.fe), v.kind, v.status,
       current_date - v.disc_days, current_date - v.sign_days, current_date - v.start_days, current_date + v.end_days,
       v.royalty, v.marketing, v.min_royalty, current_date - v.notice_days, v.intent,
       current_date - v.ended_days, v.end_reason
from (values
  ('A-501', 'S-101', 'FE-01', 'renewal',  'active', 640,  610,  580,  1245, 6.00, 2.00, 0,      null::int, null,         null::int, null),
  ('A-502', 'S-102', 'FE-01', 'new',      'active', 1560, 1530, 1500, 200,  6.00, 2.00, 0,      10,        'extend',     null,      null),
  ('A-503', 'S-103', 'FE-02', 'new',      'active', 1720, 1700, 1675, 150,  6.00, 2.00, 0,      null,      null,         null,      null),
  ('A-504', 'S-104', 'FE-03', 'new',      'active', 1150, 1125, 1100, 725,  6.00, 2.00, 0,      null,      null,         null,      null),
  ('A-505', 'S-105', 'FE-04', 'new',      'active', 960,  930,  900,  925,  6.00, 2.00, 0,      null,      null,         null,      null),
  ('A-506', 'S-106', 'FE-05', 'new',      'active', 1630, 1610, 1580, 240,  6.00, 2.00, 0,      null,      null,         null,      null),
  ('A-507', 'S-107', 'FE-06', 'new',      'active', 1350, 1330, 1300, 525,  6.00, 2.00, 0,      null,      null,         null,      null),
  ('A-508', 'S-108', 'FE-07', 'new',      'active', 1060, 1030, 1000, 825,  6.00, 2.00, 0,      null,      null,         null,      null),
  ('A-509', 'S-109', 'FE-08', 'renewal',  'active', 75,   45,   20,   1805, 6.00, 2.00, 300000, null,      null,         null,      null),
  ('A-510', 'S-110', 'FE-08', 'new',      'active', 750,  725,  700,  1125, 6.00, 2.00, 0,      null,      null,         null,      null),
  ('A-511', 'S-111', 'FE-09', 'new',      'active', 1250, 1225, 1200, 625,  6.00, 2.00, 0,      null,      null,         null,      null),
  ('A-512', 'S-112', 'FE-10', 'new',      'active', 650,  625,  600,  1225, 6.00, 2.00, 0,      null,      null,         null,      null),
  ('A-513', 'S-113', 'FE-13', 'new',      'ended',  2060, 2030, 2000, -175, 6.00, 2.00, 0,      null,      null,         20,        'Transferred to Olivia Nguyen'),
  ('A-514', 'S-113', 'FE-11', 'transfer', 'active', 29,   20,   20,   1805, 6.00, 2.00, 0,      null,      null,         null,      null),
  ('A-515', 'S-114', 'FE-12', 'new',      'active', 40,   5,    5,    1820, 6.00, 2.00, 0,      null,      null,         null,      null)
) as v(ref, site, fe, kind, status, disc_days, sign_days, start_days, end_days, royalty, marketing, min_royalty, notice_days, intent, ended_days, end_reason)
on conflict (ref) do nothing;

-- Seven months of sales reports per trading site. Parramatta's last quarter is
-- down a fifth; Southport has not paid the two months before last; Chatswood has
-- not reported the last two months.
insert into sales_reports (site_id, agreement_id, period, gross_sales_cents, reported_on, royalty_cents, marketing_cents, due_on, paid_cents, paid_on)
select s.id, a.id, m.period,
       case when s.ref = 'S-108' and m.k <= 2 then null else g.gross end,
       case when s.ref = 'S-108' and m.k <= 2 then null else least(current_date, (m.period + interval '1 month')::date + 2) end,
       case when s.ref = 'S-108' and m.k <= 2 then 0 else greatest(round(g.gross * a.royalty_pct / 100), a.min_royalty_cents) end,
       case when s.ref = 'S-108' and m.k <= 2 then 0 else round(g.gross * a.marketing_pct / 100) end,
       (m.period + interval '1 month')::date + 6,
       case when s.ref = 'S-108' and m.k <= 2 then 0
            when s.ref = 'S-105' and m.k <= 3 then 0
            else greatest(round(g.gross * a.royalty_pct / 100), a.min_royalty_cents) + round(g.gross * a.marketing_pct / 100) end,
       case when (s.ref = 'S-108' and m.k <= 2) or (s.ref = 'S-105' and m.k <= 3) then null
            else least(current_date, (m.period + interval '1 month')::date + 5) end
from sites s
cross join lateral (select k, (date_trunc('month', current_date) - make_interval(months => k))::date as period from generate_series(1, 7) k) m
join lateral (select * from agreements a where a.site_id = s.id and a.status = 'active' order by a.term_start desc limit 1) a on true
cross join lateral (
  select (case s.ref
            when 'S-101' then 10800000 when 'S-102' then 8900000 when 'S-103' then 9600000 when 'S-104' then 8200000
            when 'S-105' then 7400000  when 'S-106' then 9900000 when 'S-107' then 8700000 when 'S-108' then 9100000
            when 'S-109' then 11600000 when 'S-110' then 6800000 when 'S-111' then 9400000 when 'S-112' then 7900000
            else 8000000 end
          * (1 + ((m.k * 37 + substring(s.ref from 3)::int * 11) % 9 - 4) / 100.0)
          * (case when s.ref = 'S-106' and m.k <= 3 then 0.80 else 1 end))::bigint as gross
) g
where s.status = 'trading'
on conflict (site_id, period) do nothing;

-- Field visits: the latest and the one before it. Indooroopilly's last was 130
-- days ago. Newtown's cool room failed ten days ago.
insert into audits (ref, site_id, staff_id, kind, status, scheduled_on, visited_on, score, summary)
select v.ref, (select id from sites where ref = v.site), (select id from staff where name = v.by), v.kind, v.status,
       current_date - v.days, case when v.status = 'completed' then current_date - v.days end, v.score, v.summary
from (values
  ('V-801', 'S-101', 'Josh Tan',    'quality',     'completed', 35,   92,   'Strong morning trade, counter displays to standard.'),
  ('V-802', 'S-102', 'Josh Tan',    'quality',     'completed', 40,   81,   'Good service; exterior signage faded, menu boards out of date.'),
  ('V-803', 'S-103', 'Josh Tan',    'quality',     'completed', 55,   84,   'Solid. Owner asked about the renewal terms.'),
  ('V-804', 'S-104', 'Josh Tan',    'quality',     'completed', 130,  88,   'Tidy store, new barista trained.'),
  ('V-805', 'S-105', 'Josh Tan',    'quality',     'completed', 28,   74,   'Short staffed, two items off menu, royalties discussed.'),
  ('V-806', 'S-106', 'Aroha Ngata', 'quality',     'completed', 60,   79,   'Foot traffic down since the arcade works began.'),
  ('V-807', 'S-107', 'Aroha Ngata', 'food safety', 'completed', 10,   61,   'Cool room at 8 degrees on arrival; temperature log not kept for nine days.'),
  ('V-808', 'S-108', 'Aroha Ngata', 'quality',     'completed', 45,   86,   'Good. Point of sale export to head office still manual.'),
  ('V-809', 'S-109', 'Aroha Ngata', 'quality',     'completed', 20,   90,   'Busy weekend trade, team well drilled.'),
  ('V-810', 'S-110', 'Aroha Ngata', 'quality',     'completed', 50,   83,   'Fine. Supervisor certificate renewal mentioned.'),
  ('V-811', 'S-111', 'Aroha Ngata', 'quality',     'completed', 70,   89,   'Strong. Verification visit under the food control plan passed.'),
  ('V-812', 'S-112', 'Aroha Ngata', 'quality',     'completed', 65,   85,   'Good; staff turnover high.'),
  ('V-813', 'S-113', 'Josh Tan',    'quality',     'completed', 75,   80,   'Handover visit before the transfer.'),
  ('V-821', 'S-101', 'Josh Tan',    'quality',     'completed', 125,  90,   'To standard.'),
  ('V-822', 'S-102', 'Josh Tan',    'quality',     'completed', 130,  85,   'To standard.'),
  ('V-826', 'S-106', 'Aroha Ngata', 'quality',     'completed', 150,  86,   'To standard.'),
  ('V-827', 'S-107', 'Aroha Ngata', 'quality',     'completed', 100,  82,   'Temperature logs patchy; reminded.'),
  ('V-830', 'S-106', 'Aroha Ngata', 'quality',     'scheduled', -4,   null, null),
  ('V-831', 'S-114', 'Josh Tan',    'opening',     'scheduled', -21,  null, null)
) as v(ref, site, by, kind, status, days, score, summary)
on conflict (ref) do nothing;

insert into findings (ref, audit_id, item, severity, due_on, closed_on, evidence)
select v.ref, (select id from audits where ref = v.visit), v.item, v.severity, current_date + v.due_days,
       current_date - v.closed_days, v.evidence
from (values
  ('V-807-1', 'V-807', 'Cool room holding above 5 degrees: service the compressor and log temperatures twice a day', 'critical', -3,  null::int, null),
  ('V-807-2', 'V-807', 'Temperature log not kept for nine days', 'major', -3, null, null),
  ('V-802-1', 'V-802', 'Exterior signage faded: replace to the current brand standard', 'major', -12, null, null),
  ('V-802-2', 'V-802', 'Menu boards show last season''s range', 'minor', 10, null, null),
  ('V-805-1', 'V-805', 'Two core lines off the menu during the visit', 'minor', 2, null, null),
  ('V-827-1', 'V-827', 'Temperature logs incomplete', 'minor', -85, 80, 'Photos of two full weeks of logs sent to Aroha.')
) as v(ref, visit, item, severity, due_days, closed_days, evidence)
on conflict (ref) do nothing;

insert into tickets (ref, site_id, subject, category, priority, owner_id, opened_on, status, resolved_on, resolution)
select v.ref, (select id from sites where ref = v.site), v.subject, v.category, v.priority, (select id from staff where name = v.owner),
       current_date - v.days, v.status, current_date - v.resolved_days, v.resolution
from (values
  ('T-301', 'S-109', 'Deck oven down, no bread bake possible', 'equipment', 'urgent', 'Sophie Kerr', 3, 'open', null::int, null),
  ('T-302', 'S-112', 'Need NZ pricing on the spring menu boards', 'marketing', 'normal', 'Sophie Kerr', 4, 'open', null, null),
  ('T-303', 'S-105', 'Supplier short-delivered flour two weeks running', 'supply', 'high', 'Josh Tan', 6, 'waiting on franchisee', null, null),
  ('T-304', 'S-108', 'Point of sale will not export monthly sales', 'systems', 'high', null, 12, 'open', null, null),
  ('T-305', 'S-101', 'Roster template for school holidays', 'people', 'low', 'Sophie Kerr', 20, 'resolved', 18, 'Sent the holiday roster template.'),
  ('T-306', 'S-106', 'Local area marketing plan for the arcade works', 'marketing', 'normal', 'Megan Hartley', 30, 'resolved', 25, 'Plan agreed; letterbox drop booked.')
) as v(ref, site, subject, category, priority, owner, days, status, resolved_days, resolution)
on conflict (ref) do nothing;

insert into certificates (site_id, holder, kind, required, issued_on, expires_on)
select (select id from sites where ref = v.site), v.holder, v.kind, true, current_date - v.issued_days, current_date + v.expires_days
from (values
  ('S-101', 'Priya Shah',     'Food safety supervisor', 900,  925),
  ('S-102', 'Lena Morris',    'Food safety supervisor', 1800, 20),
  ('S-103', 'Tom Gallagher',  'Food safety supervisor', 600,  1225),
  ('S-104', 'Mei Lin Zhou',   'Food safety supervisor', 400,  1425),
  ('S-105', 'Daniel Brooks',  'Food safety supervisor', 800,  1025),
  ('S-106', 'Sarah O''Neill', 'Food safety supervisor', 300,  1525),
  ('S-107', 'Hamish Reid',    'Food safety supervisor', 1000, 825),
  ('S-108', 'Fatima Haddad',  'Food safety supervisor', 700,  1125),
  ('S-109', 'Ben Carter',     'Food safety supervisor', 200,  1625),
  ('S-110', 'Kara Walsh',     'Food safety supervisor', 1837, -12),
  ('S-111', 'Wiremu Parata',  'Food control plan training', 500, 595),
  ('S-112', 'Grace Liu',      'Food control plan training', 400, 695),
  ('S-113', 'Olivia Nguyen',  'Food safety supervisor', 25,   1800),
  ('S-113', 'Olivia Nguyen',  'Brand induction',        25,   340)
) as v(site, holder, kind, issued_days, expires_days)
where not exists (select 1 from certificates c where c.site_id = (select id from sites where ref = v.site) and c.holder = v.holder and c.kind = v.kind);

insert into breach_notices (ref, agreement_id, issued_on, breach, remedy, remedy_by, remedied_on, status)
select v.ref, (select id from agreements where ref = v.agreement), current_date - v.issued_days, v.breach, v.remedy,
       current_date - v.issued_days + v.remedy_days, current_date - v.remedied_days, v.status
from (values
  ('B-01', 'A-505', 25,  'Royalties and marketing levy unpaid for two months', 'Pay the outstanding royalties and levy in full', 30, null::int, 'open'),
  ('B-02', 'A-507', 300, 'Trading hours below the operations manual minimum', 'Open 6.30am to 3pm Monday to Saturday', 10, 292, 'remedied')
) as v(ref, agreement, issued_days, breach, remedy, remedy_days, remedied_days, status)
on conflict (ref) do nothing;

insert into prospects (ref, name, email, phone, territory_wanted, source, stage, owner_id, enquired_on, last_contact_on, disclosure_given_on, lost_reason, site_id)
select v.ref, v.name, v.email, v.phone, v.territory, v.source, v.stage, (select id from staff where name = 'Liam Byrne'),
       current_date - v.enquired_days, current_date - v.contact_days, current_date - v.disclosure_days, v.lost_reason,
       (select id from sites where ref = v.site)
from (values
  ('P-901', 'Rachel Simmons', 'rachel.s@example.com',  '0430 112 908', 'Gold Coast south',  'Franchise portal',  'enquiry',          60, 21,  null::int, null, null),
  ('P-902', 'Arjun Mehta',    'arjun.m@example.com',   '0431 220 431', 'Brisbane south',    'Website',           'disclosure given', 30, 6,   6,         null, null),
  ('P-903', 'Kate Holloway',  'kate.h@example.com',    '0432 309 774', 'Sydney Inner West', 'Expo',              'discovery day',    45, 9,   null,      null, null),
  ('P-904', 'Tane Wilson',    'tane.w@example.com',    '022 418 3302', 'Wellington',        'Referral',          'lost',             120, 70, null,      'Could not raise the fit-out finance', null),
  ('P-905', 'James Whitford', 'james@whitford.example','0421 004 778', 'Brisbane inner north','Website',         'signed',           150, 5,  40,        null, 'S-114'),
  ('P-906', 'Lucy Chen',      'lucy.c@example.com',    '0433 551 260', 'Auckland east',     'Franchise portal',  'qualified',        25, 18,  null,      null, null)
) as v(ref, name, email, phone, territory, source, stage, enquired_days, contact_days, disclosure_days, lost_reason, site)
on conflict (ref) do nothing;

-- The franchisor's years. The year before last is done; last year's disclosure
-- update, Register update and marketing fund statement are not.
insert into franchisor_years (fy_end, disclosure_updated_on, register_updated_on, fund_statement_prepared_on, fund_statement_given_on, fund_audited_on, fund_audit_opt_out)
values
  ((fy_end_for(current_date) - interval '2 years')::date, (fy_end_for(current_date) - interval '2 years' + interval '3 months')::date,
   (fy_end_for(current_date) - interval '2 years' + interval '4 months')::date, (fy_end_for(current_date) - interval '2 years' + interval '3 months')::date,
   (fy_end_for(current_date) - interval '2 years' + interval '3 months 20 days')::date, (fy_end_for(current_date) - interval '2 years' + interval '3 months 10 days')::date, false),
  ((fy_end_for(current_date) - interval '1 year')::date, null, null, null, null, null, false),
  (fy_end_for(current_date), null, null, null, null, null, false)
on conflict (fy_end) do nothing;

insert into fund_spend (spent_on, category, supplier, amount_cents, note)
select current_date - v.days, v.category, v.supplier, v.amount, v.note
from (values
  (200, 'Digital ads',          'Meta and Google',          1850000, 'Autumn range campaign'),
  (170, 'Creative',             'Field Day Studio',          960000, 'Winter menu photography'),
  (140, 'Digital ads',          'Meta and Google',          2100000, 'Winter range campaign'),
  (110, 'Local area marketing', 'Letterbox Co',              420000, 'Parramatta and Chermside drops'),
  (100, 'Admin',                'Daybreak Bakehouse',        600000, 'Fund administration, quarter'),
  (60,  'Digital ads',          'Meta and Google',          1700000, 'Spring range campaign'),
  (30,  'Creative',             'Field Day Studio',          780000, 'Spring menu boards')
) as v(days, category, supplier, amount, note)
where not exists (select 1 from fund_spend f where f.spent_on = current_date - v.days and f.category = v.category and f.supplier = v.supplier);

insert into notes (franchisee_id, site_id, staff_id, noted_on, kind, body)
select (select id from franchisees where ref = v.fe), (select id from sites where ref = v.site), (select id from staff where name = v.by),
       current_date - v.days, v.kind, v.body
from (values
  ('FE-04', 'S-105', 'Josh Tan',    28, 'visit',   'Daniel says cash is tight after the road works; will catch up the royalties by month end.'),
  ('FE-02', 'S-103', 'Josh Tan',    55, 'meeting', 'Tom wants to extend. Asked what the refurbishment requirement would be.'),
  ('FE-05', 'S-106', 'Aroha Ngata', 30, 'call',    'Arcade works run to March. Agreed a local area marketing plan.'),
  ('FE-07', 'S-108', 'Aroha Ngata', 12, 'email',   'Fatima says the point of sale export is broken. Ticket T-304 raised.')
) as v(fe, site, by, days, kind, body)
where not exists (select 1 from notes n where n.body = v.body);
