export const siteUrl = "https://wardrobe-assistants.ch";
export const siteName = "Wardrobe Assistants";
export const defaultTitle =
  "Wardrobe Assistants — Backstage Crews in Switzerland";
export const description =
  "Professional tour wardrobe assistants for theatres, concerts and festivals across Switzerland. Quick changes, ironing, repairs, laundry and load-in support.";
export const contactEmail = "hello@wardrobe-assistants.ch";

// Legal operator details for the Impressum and privacy policy.
// Swiss law (UWG Art. 3(1)(s)) requires the legal name and a real postal
// address (not a PO box) on any commercial website. Replace the placeholders
// below with the actual registered details before going to production.
type OperatorConfig = {
  legalName: string;
  addressLines: readonly string[];
  email: string;
  // Optional. Leave empty string to omit from the Impressum.
  phone: string;
  // Commercial Register / VAT identifiers. Leave undefined for sole
  // proprietors below the CHF 100'000 threshold and not in the Handelsregister.
  uid: string | undefined; // e.g. "CHE-123.456.789"
  vat: string | undefined; // e.g. "CHE-123.456.789 MWST"
  commercialRegister: string | undefined; // e.g. "Handelsregister Kanton Zürich"
  responsibleForContent: string;
};

export const operator: OperatorConfig = {
  legalName: "TODO: Operator legal name",
  addressLines: ["TODO: Street and number", "TODO: Postcode City", "Schweiz"],
  email: contactEmail,
  phone: "",
  uid: undefined,
  vat: undefined,
  commercialRegister: undefined,
  responsibleForContent: "TODO: Responsible person name",
};

// Date of last legal-text update. Bump whenever Impressum or
// privacy policy content changes.
export const legalLastUpdated = "2026-05-04";
