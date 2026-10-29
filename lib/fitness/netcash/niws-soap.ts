/**
 * SOAP 1.1 envelopes for the Netcash NIWS WCF services.
 * Contract checked against the public WSDL on ws.netcash.co.za
 * (namespace http://tempuri.org/, SOAPAction http://tempuri.org/INIWS_NIF/{Method}).
 * Netcash publishes one host. A test merchant uses the same host as live.
 * The service key, not the host, selects the merchant. This module refuses
 * every other host.
 */

export const NIWS_NIF_URL = 'https://ws.netcash.co.za/NIWS/niws_nif.svc';
export const NIWS_VALIDATION_URL = 'https://ws.netcash.co.za/NIWS/niws_validation.svc';

const ALLOWED_HOST = 'ws.netcash.co.za';
const ALLOWED_PATHS = new Set(['/niws/niws_nif.svc', '/niws/niws_validation.svc']);

export type NiwsGateInput = {
  url: string;
  mode: 'test' | 'live';
  companyId: number;
  allowNetwork: boolean;
  allowLive: boolean;
  allowCompany110: boolean;
};

export function assertNiwsCall(input: NiwsGateInput): { ok: true } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    return { ok: false, error: 'The Netcash address is not valid.' };
  }
  if (url.protocol !== 'https:' || url.hostname !== ALLOWED_HOST || !ALLOWED_PATHS.has(url.pathname.toLowerCase())) {
    return { ok: false, error: 'Only the published Netcash NIWS address can be called.' };
  }
  if (input.companyId === 110 && !input.allowCompany110) {
    return { ok: false, error: 'This gym is locked until debit-order go-live is approved.' };
  }
  if (!input.allowNetwork) {
    return { ok: false, error: 'Netcash network calls are off. Set the network flag only for a test merchant.' };
  }
  if (input.mode === 'live' && !input.allowLive) {
    return { ok: false, error: 'Live Netcash calls stay off until the live flag is set for this gym.' };
  }
  if (input.mode !== 'test' && input.mode !== 'live') {
    return { ok: false, error: 'Netcash mode must be test or live.' };
  }
  return { ok: true };
}

export function soapAction(service: 'INIWS_NIF' | 'INIWS_Validation', method: string): string {
  return `http://tempuri.org/${service}/${method}`;
}

export function soapEnvelope(method: string, fields: Record<string, string | boolean>): string {
  const inner = Object.entries(fields)
    .map(([name, value]) => `<${name}>${xml(value)}</${name}>`)
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body><${method} xmlns="http://tempuri.org/">${inner}</${method}></soap:Body>` +
    `</soap:Envelope>`;
}

export function soapResult(xmlBody: string, method: string): string {
  const tag = `${method}Result`;
  const match = xmlBody.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!match) return '';
  return unescapeXml(match[1].trim());
}

export function isNiwsErrorCode(value: string): boolean {
  return value === '100' || value === '101' || value === '102' || value === '200' || value === '311';
}

export function niwsErrorText(code: string): string {
  if (code === '100') return 'Netcash rejected the service key.';
  if (code === '101') return 'Netcash rejected the date. Use CCYYMMDD.';
  if (code === '102') return 'Netcash rejected a parameter on the file.';
  if (code === '200') return 'Netcash reported a general error.';
  if (code === '311') return 'That service key is not valid for this Netcash service.';
  if (code === 'FILE NOT READY') return 'The Netcash file is not ready yet.';
  return `Netcash returned ${code}.`;
}

function xml(value: string | boolean): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
