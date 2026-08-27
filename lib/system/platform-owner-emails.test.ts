/**
 * Run: npx --yes tsx lib/system/platform-owner-emails.test.ts
 */
import assert from 'node:assert/strict';
import {
  platformOperatorEmails,
  platformOwnerEmails,
} from './platform-control';
import { PLATFORM_OWNER_EMAILS } from './platform-company';

delete process.env.PLATFORM_OWNER_EMAILS;
delete process.env.PLATFORM_OPERATOR_EMAILS;

assert.deepEqual(platformOperatorEmails(), []);
assert.deepEqual(platformOwnerEmails(), []);
assert.deepEqual([...PLATFORM_OWNER_EMAILS], []);

process.env.PLATFORM_OWNER_EMAILS =
  'Owner@Example.com, owner@example.com; ops@example.org';
process.env.PLATFORM_OPERATOR_EMAILS = 'ops@example.org';

assert.deepEqual(platformOwnerEmails(), ['owner@example.com', 'ops@example.org']);
assert.deepEqual(platformOperatorEmails(), ['ops@example.org']);

delete process.env.PLATFORM_OWNER_EMAILS;
assert.deepEqual(platformOwnerEmails(), ['ops@example.org']);

delete process.env.PLATFORM_OPERATOR_EMAILS;
assert.deepEqual(platformOwnerEmails(), []);

console.log('platform-owner-emails tests ok');
