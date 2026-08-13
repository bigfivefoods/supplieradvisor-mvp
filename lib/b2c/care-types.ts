/** Client-safe care feed types (no server imports). */

export type B2cCareBooking = {
  id: string;
  kind: string;
  brand: string;
  title: string;
  when: string;
  status: string;
  href: string;
};

export type B2cCareRecord = {
  kind: string;
  brand: string;
  href: string;
  summary: Record<string, unknown>;
};

export type B2cCareClinic = {
  kind: string;
  brand: string;
  bookHref: string;
  careHref: string;
  hasRecords: boolean;
};
