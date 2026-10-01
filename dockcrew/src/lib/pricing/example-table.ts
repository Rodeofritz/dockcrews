import type { PriceBand, PriceTable, Service, Shift, VehicleType } from "./bands";

/**
 * EXAMPLE price table for development and tests only.
 *
 * The amounts are placeholders. The live table is loaded from the
 * `price_bands` table in the database and is set by the admin from the
 * platform's own cost model and from supplier interviews. Do not derive
 * live figures from any competitor's rate card.
 */

const VEHICLES: VehicleType[] = ["20ft", "40ft", "40ft_hc", "truck"];

// Colli bands with placeholder floors (euro cents) for day unloading.
const BASE: Array<[number, number | null, number, number]> = [
  // from, to, floor, reference
  [1, 999, 15000, 18000],
  [1000, 2499, 19000, 23000],
  [2500, 3999, 23000, 28000],
  [4000, 5999, 28000, 34000],
  [6000, 7999, 34000, 41000],
  [8000, null, 40000, 48000],
];

const SERVICE_FACTOR: Record<Service, number> = {
  unload: 1,
  load: 1,
  unload_seal: 1.3,
  restack: 2.5,
};

const SHIFT_FACTOR: Record<Shift, number> = { day: 1, night: 1.3 };

function build(): PriceBand[] {
  const bands: PriceBand[] = [];
  for (const vehicleType of VEHICLES) {
    for (const service of Object.keys(SERVICE_FACTOR) as Service[]) {
      for (const shift of Object.keys(SHIFT_FACTOR) as Shift[]) {
        for (const [colliFrom, colliTo, floor, reference] of BASE) {
          const f = SERVICE_FACTOR[service] * SHIFT_FACTOR[shift];
          bands.push({
            vehicleType,
            service,
            shift,
            colliFrom,
            colliTo,
            floorCents: Math.round(floor * f),
            referenceCents: Math.round(reference * f),
          });
        }
      }
    }
  }
  return bands;
}

export const EXAMPLE_TABLE: PriceTable = {
  bands: build(),
  driverSupplementCents: 6000,
  validFrom: "2026-01-01",
};
