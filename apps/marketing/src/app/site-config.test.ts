import { describe, expect, it } from "vitest";
import {
  assertOperatorReady,
  type OperatorConfig,
  operator,
} from "./site-config";

describe("assertOperatorReady", () => {
  const validOperator: OperatorConfig = {
    legalName: "Sabine Wyss",
    addressLines: ["Some Street 1", "8000 Zürich", "Schweiz"],
    email: "hello@example.ch",
    phone: "",
    uid: undefined,
    vat: undefined,
    commercialRegister: undefined,
    responsibleForContent: "Sabine Wyss",
  };

  it("does nothing outside production", () => {
    const placeholderOp: OperatorConfig = {
      ...validOperator,
      legalName: "TODO: legal name",
    };
    expect(() =>
      assertOperatorReady(placeholderOp, "development"),
    ).not.toThrow();
    expect(() => assertOperatorReady(placeholderOp, "test")).not.toThrow();
    expect(() => assertOperatorReady(placeholderOp, undefined)).not.toThrow();
  });

  it("passes in production when no operator field is a TODO placeholder", () => {
    expect(() =>
      assertOperatorReady(validOperator, "production"),
    ).not.toThrow();
  });

  it("throws in production when legalName is a TODO placeholder", () => {
    expect(() =>
      assertOperatorReady(
        { ...validOperator, legalName: "TODO: legal name" },
        "production",
      ),
    ).toThrow(/legalName/);
  });

  it("throws in production when any addressLine is a TODO placeholder", () => {
    expect(() =>
      assertOperatorReady(
        {
          ...validOperator,
          addressLines: ["Street 1", "TODO: city", "Schweiz"],
        },
        "production",
      ),
    ).toThrow(/addressLines/);
  });

  it("throws in production when responsibleForContent is a TODO placeholder", () => {
    expect(() =>
      assertOperatorReady(
        { ...validOperator, responsibleForContent: "TODO: name" },
        "production",
      ),
    ).toThrow(/responsibleForContent/);
  });

  it("checked-in operator has no TODO placeholders", () => {
    expect(() => assertOperatorReady(operator, "production")).not.toThrow();
  });
});
