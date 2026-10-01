import { describe, expect, it } from "vitest";
import {
  checkPrice,
  finalContainerPrice,
  findBand,
  formatEuro,
  jobFloor,
  NoBandError,
  type ContainerSpec,
} from "./bands";
import { EXAMPLE_TABLE as T } from "./example-table";

const c = (colli: number, extra: Partial<ContainerSpec> = {}): ContainerSpec => ({
  vehicleType: "40ft",
  service: "unload",
  shift: "day",
  colli,
  ...extra,
});

describe("findBand", () => {
  it("picks the band by inclusive colli bounds", () => {
    expect(findBand(T, c(1)).colliFrom).toBe(1);
    expect(findBand(T, c(999)).colliTo).toBe(999);
    expect(findBand(T, c(1000)).colliFrom).toBe(1000);
    expect(findBand(T, c(2499)).colliTo).toBe(2499);
    expect(findBand(T, c(2500)).colliFrom).toBe(2500);
  });

  it("uses the open-ended top band", () => {
    expect(findBand(T, c(8000)).colliTo).toBeNull();
    expect(findBand(T, c(25000)).colliTo).toBeNull();
  });

  it("rejects non-positive or fractional colli", () => {
    expect(() => findBand(T, c(0))).toThrow(RangeError);
    expect(() => findBand(T, c(12.5))).toThrow(RangeError);
  });

  it("throws when no band covers the combination", () => {
    const table = { ...T, bands: T.bands.filter((b) => b.vehicleType !== "truck") };
    expect(() => findBand(table, c(500, { vehicleType: "truck" }))).toThrow(NoBandError);
  });

  it("night and sealing bands are dearer than day unloading", () => {
    const day = findBand(T, c(3000)).floorCents;
    const night = findBand(T, c(3000, { shift: "night" })).floorCents;
    const seal = findBand(T, c(3000, { service: "unload_seal" })).floorCents;
    expect(night).toBeGreaterThan(day);
    expect(seal).toBeGreaterThan(day);
  });
});

describe("jobFloor", () => {
  it("sums container floors", () => {
    const floor = jobFloor(T, { containers: [c(500), c(3000)], teamProvidesDriver: false });
    expect(floor.floorCents).toBe(
      findBand(T, c(500)).floorCents + findBand(T, c(3000)).floorCents,
    );
    expect(floor.driverSupplementCents).toBe(0);
  });

  it("adds the driver supplement per container when the team brings the driver", () => {
    const without = jobFloor(T, { containers: [c(500), c(500), c(500)], teamProvidesDriver: false });
    const withDriver = jobFloor(T, { containers: [c(500), c(500), c(500)], teamProvidesDriver: true });
    expect(withDriver.floorCents - without.floorCents).toBe(3 * T.driverSupplementCents);
    expect(withDriver.driverSupplementCents).toBe(3 * T.driverSupplementCents);
  });

  it("rejects an empty job", () => {
    expect(() => jobFloor(T, { containers: [], teamProvidesDriver: false })).toThrow(RangeError);
  });
});

describe("checkPrice", () => {
  const job = { containers: [c(500), c(500)], teamProvidesDriver: false };
  const floor = jobFloor(T, job).floorCents;

  it("accepts a price at or above the floor", () => {
    expect(checkPrice(T, job, floor)).toEqual({ ok: true });
    expect(checkPrice(T, job, floor + 1)).toEqual({ ok: true });
  });

  it("rejects a price below the floor and reports the shortfall", () => {
    const r = checkPrice(T, job, floor - 2500);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("below_floor");
      expect(r.floorCents).toBe(floor);
      expect(r.shortfallCents).toBe(2500);
    }
  });

  it("rejects negative or fractional prices", () => {
    expect(() => checkPrice(T, job, -1)).toThrow(RangeError);
    expect(() => checkPrice(T, job, 10.5)).toThrow(RangeError);
  });
});

describe("finalContainerPrice", () => {
  it("keeps the agreed price when actual colli stay in the same band", () => {
    expect(finalContainerPrice(T, c(800), 950, 20000)).toBe(20000);
  });

  it("keeps the agreed price when actual colli fall into a lower band", () => {
    expect(finalContainerPrice(T, c(3000), 800, 30000)).toBe(30000);
  });

  it("scales the agreed price up by the band ratio when actual colli are higher", () => {
    const expectedFloor = findBand(T, c(800)).floorCents;
    const actualFloor = findBand(T, c(3000)).floorCents;
    const agreed = 20000;
    expect(finalContainerPrice(T, c(800), 3000, agreed)).toBe(
      Math.round((agreed * actualFloor) / expectedFloor),
    );
  });
});

describe("formatEuro", () => {
  it("formats in Dutch notation", () => {
    expect(formatEuro(0)).toBe("€ 0,00");
    expect(formatEuro(17000)).toBe("€ 170,00");
    expect(formatEuro(123456)).toBe("€ 1.234,56");
    expect(formatEuro(-500)).toBe("-€ 5,00");
  });
});
