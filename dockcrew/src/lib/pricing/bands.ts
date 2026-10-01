/**
 * Price bands and floor-price logic.
 *
 * A job is a list of containers. Each container has a vehicle type, an
 * expected (later: actual) number of colli, a service and a shift. The floor
 * table says, per combination, the minimum price a supplier may offer and a
 * team may quote. A job's floor is the sum of its containers' floors plus a
 * driver supplement when the team must bring the EPT driver.
 *
 * All amounts are in euro cents to avoid floating-point errors.
 */

export type VehicleType = "20ft" | "40ft" | "40ft_hc" | "truck";
export type Service = "unload" | "unload_seal" | "load" | "restack";
export type Shift = "day" | "night";

export interface PriceBand {
  vehicleType: VehicleType;
  service: Service;
  shift: Shift;
  /** Inclusive lower bound of colli for this band. */
  colliFrom: number;
  /** Inclusive upper bound of colli, or null for open-ended. */
  colliTo: number | null;
  /** Minimum price per container, euro cents. */
  floorCents: number;
  /** Suggested price shown as guidance, euro cents. */
  referenceCents: number;
}

export interface PriceTable {
  /** Bands, any order. */
  bands: PriceBand[];
  /** Fixed supplement per container when the team supplies the EPT driver, euro cents. */
  driverSupplementCents: number;
  /** Date from which this table applies (ISO date). */
  validFrom: string;
}

export interface ContainerSpec {
  vehicleType: VehicleType;
  service: Service;
  shift: Shift;
  colli: number;
}

export interface JobSpec {
  containers: ContainerSpec[];
  /** True when the team must bring the EPT driver. */
  teamProvidesDriver: boolean;
}

export interface JobFloor {
  floorCents: number;
  referenceCents: number;
  perContainer: Array<{ band: PriceBand; floorCents: number; referenceCents: number }>;
  driverSupplementCents: number;
}

export class NoBandError extends Error {
  constructor(spec: ContainerSpec) {
    super(
      `No price band for ${spec.vehicleType} / ${spec.service} / ${spec.shift} / ${spec.colli} colli`,
    );
    this.name = "NoBandError";
  }
}

/** Find the band that covers a container, or throw. */
export function findBand(table: PriceTable, spec: ContainerSpec): PriceBand {
  if (!Number.isInteger(spec.colli) || spec.colli < 1) {
    throw new RangeError(`colli must be a positive integer, got ${spec.colli}`);
  }
  const band = table.bands.find(
    (b) =>
      b.vehicleType === spec.vehicleType &&
      b.service === spec.service &&
      b.shift === spec.shift &&
      spec.colli >= b.colliFrom &&
      (b.colliTo === null || spec.colli <= b.colliTo),
  );
  if (!band) throw new NoBandError(spec);
  return band;
}

/** Compute a job's floor and reference price from the table. */
export function jobFloor(table: PriceTable, job: JobSpec): JobFloor {
  if (job.containers.length === 0) {
    throw new RangeError("a job needs at least one container");
  }
  const perContainer = job.containers.map((c) => {
    const band = findBand(table, c);
    const supplement = job.teamProvidesDriver ? table.driverSupplementCents : 0;
    return {
      band,
      floorCents: band.floorCents + supplement,
      referenceCents: band.referenceCents + supplement,
    };
  });
  const driverSupplementCents = job.teamProvidesDriver
    ? table.driverSupplementCents * job.containers.length
    : 0;
  return {
    floorCents: perContainer.reduce((s, c) => s + c.floorCents, 0),
    referenceCents: perContainer.reduce((s, c) => s + c.referenceCents, 0),
    perContainer,
    driverSupplementCents,
  };
}

export type PriceCheck =
  | { ok: true }
  | { ok: false; reason: "below_floor"; floorCents: number; shortfallCents: number };

/** A supplier's offered price or a team's quote must be at or above the floor. */
export function checkPrice(table: PriceTable, job: JobSpec, priceCents: number): PriceCheck {
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    throw new RangeError(`price must be a non-negative integer in cents, got ${priceCents}`);
  }
  const { floorCents } = jobFloor(table, job);
  if (priceCents >= floorCents) return { ok: true };
  return { ok: false, reason: "below_floor", floorCents, shortfallCents: floorCents - priceCents };
}

/**
 * Final price after the doclist: the quote was agreed per the expected bands.
 * If the actual colli land in a higher band, the container is repriced at the
 * ratio between the actual and expected band floors. It never goes below the
 * agreed amount for that container.
 */
export function finalContainerPrice(
  table: PriceTable,
  expected: ContainerSpec,
  actualColli: number,
  agreedCents: number,
): number {
  const expectedBand = findBand(table, expected);
  const actualBand = findBand(table, { ...expected, colli: actualColli });
  if (actualBand.floorCents <= expectedBand.floorCents) return agreedCents;
  // Scale the agreed price by the band ratio, rounded to the cent.
  return Math.round((agreedCents * actualBand.floorCents) / expectedBand.floorCents);
}

/** Format euro cents as "€ 1.234,56" (Dutch notation). */
export function formatEuro(cents: number): string {
  const euros = Math.floor(Math.abs(cents) / 100);
  const rest = Math.abs(cents) % 100;
  const sign = cents < 0 ? "-" : "";
  const grouped = euros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}€ ${grouped},${rest.toString().padStart(2, "0")}`;
}
