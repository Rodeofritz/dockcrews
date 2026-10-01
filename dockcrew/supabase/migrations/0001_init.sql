-- Dockcrew: initial schema
-- Run in the Supabase SQL editor or with `supabase db push`.
-- Money is stored in euro cents (integer). Times are timestamptz.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type company_type   as enum ('supplier', 'team');
create type entity_form    as enum ('bv', 'vof', 'cooperative', 'eenmanszaak', 'other');
create type company_status as enum ('pending', 'approved', 'suspended', 'rejected');
create type user_role      as enum ('owner', 'planner', 'team_lead', 'member');
create type vehicle_type   as enum ('20ft', '40ft', '40ft_hc', 'truck');
create type service_type   as enum ('unload', 'unload_seal', 'load', 'restack');
create type shift_type     as enum ('day', 'night');
create type driver_source  as enum ('supplier', 'team');
create type job_status     as enum ('draft', 'open', 'quoting', 'awarded', 'in_progress',
                                    'confirming', 'invoiced', 'paid', 'rated', 'expired', 'cancelled');
create type quote_status   as enum ('submitted', 'accepted', 'declined', 'withdrawn');
create type container_status as enum ('planned', 'checked_out', 'confirmed', 'flagged');
create type document_type  as enum ('kvk_extract', 'liability_insurance', 'vca', 'driver_certificate',
                                    'payroll_statement', 'sna_certificate', 'other');
create type document_status as enum ('pending', 'approved', 'rejected', 'expired');
create type invoice_status as enum ('draft', 'open', 'paid', 'void');
create type rating_direction as enum ('supplier_rates_team', 'team_rates_supplier');

-- ---------------------------------------------------------------------------
-- Companies and people
-- ---------------------------------------------------------------------------
create table companies (
  id              uuid primary key default gen_random_uuid(),
  type            company_type not null,
  name            text not null,
  kvk_number      text not null unique check (kvk_number ~ '^[0-9]{8}$'),
  entity_form     entity_form,
  vat_number      text,
  iban            text,
  billing_email   text,
  billing_address text,
  status          company_status not null default 'pending',
  -- Teams: capabilities
  offers_driver   boolean not null default false,
  regions         text[] not null default '{}',
  -- Declarations signed at onboarding
  self_billing_accepted_at     timestamptz,
  no_solicitation_declared_at  timestamptz,   -- "no partner is bound by a clause with a previous principal that this work would breach"
  staffing_declared_at         timestamptz,   -- "owners / employees only; no hourly zzp'ers"
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid references companies(id) on delete set null,
  role        user_role not null default 'member',
  full_name   text not null,
  phone       text,
  locale      text not null default 'nl' check (locale in ('nl','en','pl','ro','ru')),
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table sites (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  name          text not null,
  address       text not null,
  postcode      text not null,
  city          text not null,
  dock_notes    text,
  safety_sheet  text,
  gas_check_by  driver_source not null default 'supplier',
  created_at    timestamptz not null default now()
);

create table team_members (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  full_name           text not null,
  is_owner            boolean not null default false,
  vca_number          text,
  vca_expires_on      date,
  driver_certified    boolean not null default false,
  driver_cert_expires date,
  right_to_work_declared_at timestamptz,
  created_at          timestamptz not null default now()
);

create table documents (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  team_member_id uuid references team_members(id) on delete cascade,
  type           document_type not null,
  storage_path   text not null,
  expires_on     date,
  status         document_status not null default 'pending',
  reviewed_by    uuid references users(id),
  reviewed_at    timestamptz,
  note           text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Price table
-- ---------------------------------------------------------------------------
create table price_tables (
  id          uuid primary key default gen_random_uuid(),
  valid_from  date not null unique,
  driver_supplement_cents integer not null check (driver_supplement_cents >= 0),
  note        text,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

create table price_bands (
  id              uuid primary key default gen_random_uuid(),
  price_table_id  uuid not null references price_tables(id) on delete cascade,
  vehicle_type    vehicle_type not null,
  service         service_type not null,
  shift           shift_type not null,
  colli_from      integer not null check (colli_from >= 1),
  colli_to        integer check (colli_to is null or colli_to >= colli_from),
  floor_cents     integer not null check (floor_cents >= 0),
  reference_cents integer not null check (reference_cents >= floor_cents),
  unique (price_table_id, vehicle_type, service, shift, colli_from)
);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
create table jobs (
  id                 uuid primary key default gen_random_uuid(),
  supplier_id        uuid not null references companies(id),
  site_id            uuid not null references sites(id),
  created_by         uuid not null references users(id),
  status             job_status not null default 'draft',
  starts_at          timestamptz not null,
  ends_at            timestamptz not null check (ends_at > starts_at),
  driver_source      driver_source not null default 'supplier',
  offered_cents      integer not null check (offered_cents >= 0),
  floor_cents        integer not null check (floor_cents >= 0),
  reference_cents    integer not null,
  price_table_id     uuid not null references price_tables(id),
  quoting_closes_at  timestamptz,
  awarded_team_id    uuid references companies(id),
  awarded_quote_id   uuid,
  agreed_cents       integer,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (offered_cents >= floor_cents)
);

create table job_containers (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs(id) on delete cascade,
  position        integer not null,
  vehicle_type    vehicle_type not null,
  service         service_type not null,
  shift           shift_type not null,
  expected_colli  integer not null check (expected_colli >= 1),
  container_number text,
  -- Checkout (doclist)
  status          container_status not null default 'planned',
  actual_colli    integer check (actual_colli is null or actual_colli >= 1),
  started_at      timestamptz,
  finished_at     timestamptz,
  doclist_path    text,
  photo_paths     text[] not null default '{}',
  damage_note     text,
  checked_out_by  uuid references users(id),
  checked_out_at  timestamptz,
  confirmed_by    uuid references users(id),
  confirmed_at    timestamptz,
  auto_confirmed  boolean not null default false,
  flag_reason     text,
  agreed_cents    integer,
  final_cents     integer,
  unique (job_id, position)
);

create table quotes (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references jobs(id) on delete cascade,
  team_id          uuid not null references companies(id),
  submitted_by     uuid not null references users(id),
  price_cents      integer not null check (price_cents >= 0),
  driver_included  boolean not null default false,
  message          text,
  status           quote_status not null default 'submitted',
  created_at       timestamptz not null default now(),
  unique (job_id, team_id)
);

alter table jobs add constraint jobs_awarded_quote_fk
  foreign key (awarded_quote_id) references quotes(id);

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------
create table invoices (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null unique references jobs(id),
  team_id         uuid not null references companies(id),   -- issuer (self-billing)
  supplier_id     uuid not null references companies(id),   -- payer
  number          text not null unique,
  issued_on       date not null default current_date,
  due_on          date not null,
  net_cents       integer not null,
  vat_cents       integer not null,
  gross_cents     integer not null,
  payment_reference text not null unique,
  status          invoice_status not null default 'open',
  paid_at         timestamptz,
  pdf_path        text,
  created_at      timestamptz not null default now()
);

create table fee_charges (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references companies(id),
  job_container_id  uuid not null unique references job_containers(id),
  amount_cents      integer not null check (amount_cents >= 0),
  period            date not null,            -- first day of the month
  fee_invoice_id    uuid,
  created_at        timestamptz not null default now()
);

create table ratings (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  direction   rating_direction not null,
  rated_by    uuid not null references users(id),
  score_1     smallint not null check (score_1 between 1 and 5),   -- speed / dock readiness
  score_2     smallint not null check (score_2 between 1 and 5),   -- tidiness / colli accuracy
  score_3     smallint not null check (score_3 between 1 and 5),   -- damage / paid on time
  score_4     smallint check (score_4 between 1 and 5),            -- punctuality / (unused)
  comment     text,
  created_at  timestamptz not null default now(),
  unique (job_id, direction)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function current_company_id() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from users where id = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from users where id = auth.uid()), false)
$$;

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger companies_touch before update on companies for each row execute function touch_updated_at();
create trigger jobs_touch      before update on jobs      for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- Rule of thumb: a company sees its own rows; suppliers see open jobs' quotes
-- only for their own jobs; teams see open jobs in their regions; admin sees all.
-- ---------------------------------------------------------------------------
alter table companies      enable row level security;
alter table users          enable row level security;
alter table sites          enable row level security;
alter table team_members   enable row level security;
alter table documents      enable row level security;
alter table price_tables   enable row level security;
alter table price_bands    enable row level security;
alter table jobs           enable row level security;
alter table job_containers enable row level security;
alter table quotes         enable row level security;
alter table invoices       enable row level security;
alter table fee_charges    enable row level security;
alter table ratings        enable row level security;

-- companies: own company, or any approved team's public profile, or admin
create policy companies_select on companies for select using (
  id = current_company_id() or is_admin() or (type = 'team' and status = 'approved')
);
create policy companies_update on companies for update using (
  (id = current_company_id() and exists (select 1 from users where id = auth.uid() and role in ('owner','planner','team_lead')))
  or is_admin()
);
create policy companies_insert on companies for insert with check (auth.uid() is not null);

-- users: self, same company, admin
create policy users_select on users for select using (
  id = auth.uid() or company_id = current_company_id() or is_admin()
);
create policy users_update_self on users for update using (id = auth.uid() or is_admin());
create policy users_insert_self on users for insert with check (id = auth.uid());

-- sites: own supplier, admin; teams see sites of jobs awarded to them (via jobs join in app layer)
create policy sites_all_own on sites for all using (company_id = current_company_id() or is_admin());
create policy sites_select_awarded on sites for select using (
  exists (select 1 from jobs j where j.site_id = sites.id and j.awarded_team_id = current_company_id())
);

-- team members and documents: own company or admin
create policy team_members_own on team_members for all using (company_id = current_company_id() or is_admin());
create policy documents_own    on documents    for all using (company_id = current_company_id() or is_admin());

-- price table: everyone signed in may read; admin writes
create policy price_tables_read  on price_tables for select using (auth.uid() is not null);
create policy price_bands_read   on price_bands  for select using (auth.uid() is not null);
create policy price_tables_admin on price_tables for all using (is_admin());
create policy price_bands_admin  on price_bands  for all using (is_admin());

-- jobs: supplier sees own; approved teams see open/quoting jobs and jobs awarded to them; admin all
create policy jobs_supplier on jobs for all using (supplier_id = current_company_id() or is_admin());
create policy jobs_team_select on jobs for select using (
  exists (select 1 from companies c where c.id = current_company_id() and c.type = 'team' and c.status = 'approved')
  and (status in ('open','quoting') or awarded_team_id = current_company_id())
);

-- containers follow their job; awarded team may update checkout fields
create policy containers_select on job_containers for select using (
  exists (select 1 from jobs j where j.id = job_id)   -- visibility delegated to jobs policy
);
create policy containers_supplier on job_containers for all using (
  exists (select 1 from jobs j where j.id = job_id and (j.supplier_id = current_company_id() or is_admin()))
);
create policy containers_team_update on job_containers for update using (
  exists (select 1 from jobs j where j.id = job_id and j.awarded_team_id = current_company_id())
);

-- quotes: a team sees and writes its own; the supplier sees quotes on its jobs; admin all
create policy quotes_team on quotes for all using (team_id = current_company_id() or is_admin());
create policy quotes_supplier_select on quotes for select using (
  exists (select 1 from jobs j where j.id = job_id and j.supplier_id = current_company_id())
);

-- invoices: the two parties and admin
create policy invoices_parties on invoices for select using (
  team_id = current_company_id() or supplier_id = current_company_id() or is_admin()
);
create policy invoices_admin on invoices for all using (is_admin());

-- fee charges: own team and admin
create policy fees_team  on fee_charges for select using (team_id = current_company_id() or is_admin());
create policy fees_admin on fee_charges for all using (is_admin());

-- ratings: parties to the job may read; the rater's company may insert once
create policy ratings_select on ratings for select using (
  exists (select 1 from jobs j where j.id = job_id and (j.supplier_id = current_company_id() or j.awarded_team_id = current_company_id()))
  or is_admin()
);
create policy ratings_insert on ratings for insert with check (
  rated_by = auth.uid() and exists (
    select 1 from jobs j where j.id = job_id and j.status in ('paid','rated')
    and (j.supplier_id = current_company_id() or j.awarded_team_id = current_company_id())
  )
);

-- ---------------------------------------------------------------------------
-- Storage buckets (private). Access is granted per path in a later migration.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('documents', 'documents', false),   -- KvK, insurance, VCA, IDs: stricter access
  ('doclists',  'doclists',  false),   -- checkout photos and doclists
  ('invoices',  'invoices',  false)
on conflict (id) do nothing;
