/**
 * Run: npx --yes tsx lib/auth/oauth-return.test.ts
 */
import assert from 'node:assert/strict';
import {
  isInAppBrowserOauthError,
  isPrivyOauthCallback,
  standaloneOauthContinueMessage,
} from './oauth-return';

assert.equal(
  isPrivyOauthCallback('privy_oauth_code=abc&privy_oauth_state=xyz'),
  true
);
assert.equal(isPrivyOauthCallback('link=mem_1'), false);
assert.equal(
  isInAppBrowserOauthError(
    new Error(
      "It looks like you're using an in-app browser. To log in, please try again using an external browser."
    )
  ),
  true
);
assert.equal(
  isInAppBrowserOauthError(new Error('Login with google is not allowed')),
  true
);
assert.equal(isInAppBrowserOauthError(new Error('network down')), false);
assert.match(
  standaloneOauthContinueMessage('google', 'Balance'),
  /come back to Balance/i
);
assert.ok(!/gym/i.test(standaloneOauthContinueMessage('google', 'Balance')));
assert.match(
  standaloneOauthContinueMessage('google'),
  /this app/
);

console.log('oauth-return tests ok');
