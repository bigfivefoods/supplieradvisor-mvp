export type AfsLine = {
  code: string;
  name: string;
  note?: string | null;
  current: number;
  prior: number;
  bold?: boolean;
  indent?: boolean;
};

export type AfsSection = {
  key: string;
  title: string;
  lines: AfsLine[];
  total: { current: number; prior: number };
};

export type AfsNote = {
  number: string;
  title: string;
  body?: string;
  lines?: AfsLine[];
};

export type AfsPack = {
  company: {
    name: string;
    legal_name: string | null;
    trading_name: string | null;
    registration_number: string | null;
    vat_number: string | null;
    tax_number: string | null;
    country: string | null;
    currency: string;
  };
  period: {
    from: string;
    to: string;
    label: string;
    priorFrom: string;
    priorTo: string;
    priorLabel: string;
  };
  statementOfFinancialPosition: {
    sections: AfsSection[];
    assets: { current: number; prior: number };
    liabilities: { current: number; prior: number };
    equity: { current: number; prior: number };
    balanced: { current: boolean; prior: boolean };
  };
  statementOfProfitOrLoss: {
    sections: AfsSection[];
    revenue: { current: number; prior: number };
    cogs: { current: number; prior: number };
    grossProfit: { current: number; prior: number };
    expenses: { current: number; prior: number };
    netIncome: { current: number; prior: number };
  };
  statementOfChangesInEquity: {
    lines: AfsLine[];
    opening: { current: number; prior: number };
    profit: { current: number; prior: number };
    other: { current: number; prior: number };
    closing: { current: number; prior: number };
  };
  statementOfCashFlows: {
    operating: AfsLine[];
    investing: AfsLine[];
    financing: AfsLine[];
    netOperating: { current: number; prior: number };
    netInvesting: { current: number; prior: number };
    netFinancing: { current: number; prior: number };
    netChange: { current: number; prior: number };
    openingCash: { current: number; prior: number };
    closingCash: { current: number; prior: number };
    reconciled: { current: boolean; prior: boolean };
  };
  notes: AfsNote[];
  policies: Array<{ title: string; body: string }>;
  compilation: {
    basis: string;
    unaudited: true;
    journalCount: number;
    warning?: string;
  };
};
