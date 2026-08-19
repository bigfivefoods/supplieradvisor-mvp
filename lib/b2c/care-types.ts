/** Client-safe care feed types (no server imports). */

export type B2cCareBooking = {
  id: string;
  kind: string;
  brand: string;
  title: string;
  when: string;
  status: string;
  href: string;
  past?: boolean;
  notes?: string;
  feedback_href?: string | null;
  feedback_done?: boolean;
};

export type B2cCareRecord = {
  kind: string;
  brand: string;
  href: string;
  summary: Record<string, unknown>;
  advice?: Array<{ id: string; body: string; at?: string }>;
  follow_ups?: Array<{
    id: string;
    remind_on: string;
    title?: string;
    advice: string;
    status: string;
  }>;
};

export type B2cCareClinic = {
  kind: string;
  brand: string;
  bookHref: string;
  careHref: string;
  hasRecords: boolean;
  classesHref?: string;
  progressHref?: string;
};

export type B2cCareAnnouncement = {
  id: string;
  kind: string;
  brand: string;
  title: string;
  body: string;
  href: string;
  pinned?: boolean;
  cta_label?: string | null;
  cta_href?: string | null;
};
