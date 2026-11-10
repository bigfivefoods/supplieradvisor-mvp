/** How-to guide shape. Copy is prose for people using the product. */

export type GuideError = {
  /** The message the screen or the API actually returns. */
  message: string;
  fix: string;
};

export type GuideFaq = {
  q: string;
  a: string;
};

export type GuideNode = {
  id: string;
  label: string;
  hint?: string;
};

export type GuideFeature = {
  id: string;
  name: string;
  href: string | null;
  /** What the feature is for. Steps must not repeat this sentence. */
  summary: string;
  /** Who can use it, from the role checks in the code. */
  who: string;
  prerequisites: string[];
  steps: string[];
  behind: string[];
  errors: GuideError[];
  faqs: GuideFaq[];
};

export type ModuleGuide = {
  id: string;
  name: string;
  href: string;
  purpose: string;
  roles: string[];
  features: GuideFeature[];
  faqs: GuideFaq[];
  flow: GuideNode[];
  outcome: string;
};
