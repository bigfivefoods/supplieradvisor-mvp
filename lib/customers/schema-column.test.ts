/**
 * Run: npx --yes tsx lib/customers/schema-column.test.ts
 */
import assert from 'node:assert/strict';
import { missingSchemaColumn } from './schema-column';

assert.equal(
  missingSchemaColumn(
    "Could not find the 'payment_terms' column of 'customer_quotes' in the schema cache"
  ),
  'payment_terms'
);
assert.equal(
  missingSchemaColumn('column "contact_phone" of relation "customer_invoices" does not exist'),
  'contact_phone'
);
assert.equal(missingSchemaColumn('duplicate key value violates unique constraint'), null);
assert.equal(missingSchemaColumn(''), null);

console.log('schema-column.test.ts ok');
