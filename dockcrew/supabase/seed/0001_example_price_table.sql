-- EXAMPLE price table for development only.
-- The amounts are placeholders; replace them with figures from the platform's
-- own cost model and supplier interviews before going live.

with t as (
  insert into price_tables (valid_from, driver_supplement_cents, note)
  values ('2026-01-01', 6000, 'EXAMPLE table for development; replace before launch')
  returning id
),
base(colli_from, colli_to, floor_cents, reference_cents) as (
  values (1, 999, 15000, 18000),
         (1000, 2499, 19000, 23000),
         (2500, 3999, 23000, 28000),
         (4000, 5999, 28000, 34000),
         (6000, 7999, 34000, 41000),
         (8000, null, 40000, 48000)
),
svc(service, f) as (
  values ('unload'::service_type, 1.0), ('load'::service_type, 1.0),
         ('unload_seal'::service_type, 1.3), ('restack'::service_type, 2.5)
),
shf(shift, f) as (
  values ('day'::shift_type, 1.0), ('night'::shift_type, 1.3)
),
veh(vehicle_type) as (
  values ('20ft'::vehicle_type), ('40ft'::vehicle_type), ('40ft_hc'::vehicle_type), ('truck'::vehicle_type)
)
insert into price_bands (price_table_id, vehicle_type, service, shift, colli_from, colli_to, floor_cents, reference_cents)
select t.id, veh.vehicle_type, svc.service, shf.shift, base.colli_from, base.colli_to,
       round(base.floor_cents * svc.f * shf.f)::integer,
       round(base.reference_cents * svc.f * shf.f)::integer
from t, veh, svc, shf, base;
