/**
 * Clicks on the public agreement shell happen before the Privy chunk exists.
 * These flags live in the browser module so a later mount can finish the same
 * action. Nothing here runs during render, and the module does not import Privy.
 */

let pendingLogout = false;
let pendingSam = false;
let pendingSign = false;

export function queueAgreementLogout() {
  pendingLogout = true;
}

export function consumeAgreementLogout() {
  if (!pendingLogout) return false;
  pendingLogout = false;
  return true;
}

export function queueAgreementSam() {
  pendingSam = true;
}

export function hasAgreementSam() {
  return pendingSam;
}

export function consumeAgreementSam() {
  if (!pendingSam) return false;
  pendingSam = false;
  return true;
}

export function hasAgreementSign() {
  return pendingSign;
}

export function queueAgreementSign() {
  pendingSign = true;
}

export function consumeAgreementSign() {
  if (!pendingSign) return false;
  pendingSign = false;
  return true;
}
