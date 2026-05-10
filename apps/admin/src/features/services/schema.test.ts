import { describe, expect, it } from "vitest";
import {
  archiveServiceInput,
  serviceInput,
  serviceListItem,
  updateServiceInput,
} from "./schema";

describe("serviceInput", () => {
  const valid = {
    name: "Sewing kit",
    description: "Bring a portable sewing kit to the venue.",
    priceType: "fixed" as const,
    price: 25,
  };

  it("accepts a valid fixed-price service", () => {
    expect(serviceInput.safeParse(valid).success).toBe(true);
  });

  it("accepts a valid hourly-price service", () => {
    expect(
      serviceInput.safeParse({ ...valid, priceType: "hourly", price: 80 })
        .success,
    ).toBe(true);
  });

  it("rejects empty name", () => {
    expect(serviceInput.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(serviceInput.safeParse({ ...valid, name: "   " }).success).toBe(
      false,
    );
  });

  it("rejects empty description", () => {
    expect(serviceInput.safeParse({ ...valid, description: "" }).success).toBe(
      false,
    );
    expect(
      serviceInput.safeParse({ ...valid, description: "  " }).success,
    ).toBe(false);
  });

  it("rejects negative price", () => {
    expect(serviceInput.safeParse({ ...valid, price: -5 }).success).toBe(false);
  });

  it("rejects zero price", () => {
    expect(serviceInput.safeParse({ ...valid, price: 0 }).success).toBe(false);
  });

  it("rejects non-integer price", () => {
    expect(serviceInput.safeParse({ ...valid, price: 25.5 }).success).toBe(
      false,
    );
  });

  it("rejects invalid priceType", () => {
    expect(
      serviceInput.safeParse({ ...valid, priceType: "monthly" }).success,
    ).toBe(false);
  });
});

describe("updateServiceInput", () => {
  const valid = {
    serviceId: "svc_1",
    name: "Sewing kit",
    description: "Updated description.",
    priceType: "fixed" as const,
    price: 30,
  };

  it("accepts a valid update", () => {
    expect(updateServiceInput.safeParse(valid).success).toBe(true);
  });

  it("requires a non-empty serviceId", () => {
    expect(
      updateServiceInput.safeParse({ ...valid, serviceId: "" }).success,
    ).toBe(false);
  });
});

describe("archiveServiceInput", () => {
  it("requires a non-empty serviceId", () => {
    expect(archiveServiceInput.safeParse({ serviceId: "" }).success).toBe(
      false,
    );
    expect(archiveServiceInput.safeParse({ serviceId: "s1" }).success).toBe(
      true,
    );
  });
});

describe("serviceListItem", () => {
  it("requires the priceFormatted contract field", () => {
    const base = {
      id: "s1",
      name: "x",
      description: "d",
      priceType: "fixed" as const,
      price: 25,
      archived: false,
      createdAt: new Date(),
    };
    expect(serviceListItem.safeParse(base).success).toBe(false);
    expect(
      serviceListItem.safeParse({ ...base, priceFormatted: "CHF 25.-" })
        .success,
    ).toBe(true);
  });

  it("rejects an unknown priceType", () => {
    expect(
      serviceListItem.safeParse({
        id: "s1",
        name: "x",
        description: "d",
        priceType: "monthly",
        price: 25,
        archived: false,
        createdAt: new Date(),
        priceFormatted: "CHF 25.-",
      }).success,
    ).toBe(false);
  });
});
