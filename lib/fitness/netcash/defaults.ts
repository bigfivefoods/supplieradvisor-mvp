import type { NetcashSettings } from '@/lib/fitness/netcash/types';

export function defaultSettings(companyId: number, nowIso: string): NetcashSettings {
  return {
    companyId,
    merchantAccount: '',
    serviceKeyEnc: null,
    serviceKeyLast4: '',
    serviceKeyConfigured: false,
    accountKeyEnc: null,
    accountKeyLast4: '',
    accountKeyConfigured: false,
    mode: 'test',
    debitDay: 1,
    cadence: 'monthly',
    leadBusinessDays: 2,
    cutoffHourSast: 14,
    cutoffMinute: 0,
    pricesIncludeVat: true,
    vatBps: 1500,
    invoicePrefix: 'GYM',
    creditPrefix: 'GCN',
    lateFeeCents: 0,
    retryMaxAttempts: 2,
    autoSubmit: false,
    autoSuspendAccess: false,
    dunningEmail: true,
    allowAmountVariance: true,
    glBankCode: '1110',
    glArCode: '1180',
    glRevenueCode: '4400',
    glVatCode: '2120',
    glFeeCode: '4300',
    updatedAt: nowIso,
    updatedBy: '',
  };
}

export function toPublicSettings(settings: NetcashSettings) {
  const { serviceKeyEnc: _sealed, ...rest } = settings;
  void _sealed;
  return rest;
}

export function maskAccount(last4: string): string {
  return last4 ? `•••• ${last4}` : '';
}
