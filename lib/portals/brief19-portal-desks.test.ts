/**
 * Run: npx --yes tsx lib/portals/brief19-portal-desks.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function src(rel: string) {
  return readFileSync(resolve(rel), 'utf8');
}

const loadPos = src('lib/portals/trade-portal.ts');
assert.match(loadPos, /poBelongsToSupplierViewer/);
assert.match(loadPos, /loadHostPurchaseOrders/);
assert.match(loadPos, /mergePortalDocRows/);
assert.doesNotMatch(
  loadPos,
  /sid === supplierId \|\| \(linked && spid === linked\)/
);

const ws = src('lib/portals/trade-portal-workspace.ts');
assert.match(ws, /loadHostPurchaseOrders/);
assert.match(ws, /poBelongsToSupplierViewer/);
assert.match(ws, /poPdfUrlFromMeta/);

const host = src('lib/portals/host-purchase-orders.ts');
assert.match(host, /buyer_profile_id/);
assert.match(host, /profile_id/);
assert.match(host, /company_id/);
assert.match(host, /poHostedByBuyer/);

const guest = src('components/portals/GuestTradeWorkspace.tsx');
assert.match(guest, /mergePortalDocRows\(ws\?\.purchase_orders, live\.purchase_orders\)/);
assert.doesNotMatch(guest, /ws\?\.purchase_orders \|\| live\.purchase_orders/);
assert.match(guest, /supplierPortalPoPdfHref/);
assert.doesNotMatch(guest, /window\.prompt/);

const upload = src('app/api/public/portals/trade/upload/route.ts');
assert.match(upload, /uploadPortalDocument/);
assert.doesNotMatch(upload, /hint: 'Create a public Storage bucket named company-documents\.'/);

const storage = src('lib/portals/portal-storage.ts');
assert.match(storage, /createSignedUrl/);
assert.match(storage, /createBucket/);
assert.match(storage, /PORTAL_SIGNED_URL_SECONDS/);

const pdfRoute = src('app/api/public/portals/trade/po-pdf/route.ts');
assert.match(pdfRoute, /assemblePurchaseOrderPdfInput/);
assert.match(pdfRoute, /poBelongsToSupplierViewer/);
assert.match(pdfRoute, /poHostedByBuyer/);
assert.doesNotMatch(pdfRoute, /from\('profiles'\)[\s\S]{0,200}\bphone\b/);

const send = src('app/api/suppliers/purchase-orders/send/route.ts');
assert.match(send, /poHostedByBuyer/);
assert.match(send, /buyer_profile_id: companyId/);
assert.match(send, /pdf_url/);
assert.match(send, /srm_supplier_id/);

const createPo = src('app/api/suppliers/purchase-orders/route.ts');
assert.match(createPo, /buyer_profile_id: companyId/);
assert.match(createPo, /srm_supplier_id: srmId/);

const suppliers = src('app/api/suppliers/route.ts');
assert.match(suppliers, /filterSupplierDeskRows/);
assert.match(suppliers, /party_book_role/);
assert.match(suppliers, /defaultCreateBookRole\(\s*'supplier'/);

const customers = src('app/api/customers/route.ts');
assert.match(customers, /filterCustomerDeskRows/);
assert.match(customers, /CUSTOMER_LIST_COLUMNS/);
assert.match(customers, /defaultCreateBookRole\(\s*'customer'/);
assert.doesNotMatch(
  customers,
  /select\(\s*'id, trading_name, legal_name, email, phone, contact_name, status, customer_type, city, country, industry, linked_profile_id, invite_status, credit_limit, currency, logo_url, source, created_at, updated_at'\s*\)/
);

const act = src('app/api/public/portals/trade/act/route.ts');
assert.match(act, /document_save/);
assert.match(act, /document_extra/);
assert.match(act, /mergeRequiredDocIntoMetadata/);
assert.match(act, /mergeExtraDocIntoMetadata/);
assert.doesNotMatch(act, /select\('linked_profile_id'\)/);

const sql = src('RUN_THIS_FOR_BRIEF19.sql');
assert.match(sql, /company-documents/);
assert.match(sql, /public/);

console.log('brief19-portal-desks source tests ok');
