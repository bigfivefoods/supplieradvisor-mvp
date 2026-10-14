/**
 * Brief 105 — public routes must not mail strangers anonymously.
 * Run: npx --yes tsx lib/http/brief105-public-mailers.test.ts
 *
 * Every app/api/public route that sends mail (getResend, resend.emails.send,
 * sendEmail) must authenticate a user, company, or portal/invite token, or sit
 * on PUBLIC_MAILER_ALLOWLIST with a one-line reason. Allowlisted routes that
 * interpolate request-body strings into email HTML must run them through an
 * escape helper. The retired directory invite mailer fails this test even if
 * someone adds auth or an allowlist entry.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const RETIRED_SEGMENT = 'directory-invite';

/** Routes that mail the submitter and do not authenticate. Token-gated portal routes pass via auth instead. */
const PUBLIC_MAILER_ALLOWLIST: Record<string, string> = {
  'app/api/public/founding-waitlist/route.ts':
    'Mails only the address that submitted the form; body text in the HTML goes through escapeHtml.',
};

const EMAIL_SEND = /\bgetResend\b|\bresend\.emails\.send\b|\bsendEmail\b/;
const ESCAPE_NAMES = new Set(['escapeHtml', 'escape']);

function isRetiredAnonymousMailer(rel: string): boolean {
  return rel.split(/[/\\]/).includes(RETIRED_SEGMENT);
}

function sendsEmail(source: string): boolean {
  return EMAIL_SEND.test(source);
}

function isAuthenticated(source: string): boolean {
  if (/\brequireVerifiedUser\b/.test(source)) return true;
  if (/\brequireCompanyAccess\b/.test(source)) return true;
  const lookup =
    /\bresolve(?:ByToken|GuestViewer|Member|Coach|Gym)\s*\(/.test(source) ||
    /\.eq\(\s*['"]invite_token['"]/.test(source) ||
    /\.eq\(\s*['"]portal_token['"]/.test(source) ||
    /\bportal_token\s*===/.test(source);
  if (!lookup) return false;
  return (
    /\bbody\.(?:token|invite_token|portal_token|gym_token)\b/.test(source) ||
    /(?:searchParams|form)\.get\(\s*['"](?:token|invite_token|portal_token|gym_token)['"]\s*\)/.test(
      source
    )
  );
}

function mailerProblem(
  rel: string,
  source: string,
  allowlist: Record<string, string>
): string | null {
  if (isRetiredAnonymousMailer(rel)) {
    return `${rel} is the retired anonymous directory invite mailer`;
  }
  if (!sendsEmail(source)) return null;
  if (Object.prototype.hasOwnProperty.call(allowlist, rel)) {
    const reason = allowlist[rel]?.trim() ?? '';
    if (!reason || reason.includes('\n')) {
      return `${rel} needs a one-line allowlist reason`;
    }
    return null;
  }
  if (isAuthenticated(source)) return null;
  return `${rel} sends email with no auth and no allowlist entry`;
}

function walkRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkRoutes(path));
    else if (entry.isFile() && /^route\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

function toRel(path: string): string {
  return relative(process.cwd(), path).split('\\').join('/');
}

type FnInfo = {
  params: string[];
  bindings: { name: string; initializer: ts.Expression }[];
  calls: ts.CallExpression[];
};

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

function functionName(node: ts.FunctionLikeDeclaration): string | null {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  return null;
}

function paramNames(fn: ts.FunctionLikeDeclaration): string[] {
  return fn.parameters.map((param) => (ts.isIdentifier(param.name) ? param.name.text : ''));
}

function unwrap(expr: ts.Expression): ts.Expression {
  let node = expr;
  for (;;) {
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isAwaitExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      (typeof ts.isTypeAssertionExpression === 'function' &&
        ts.isTypeAssertionExpression(node))
    ) {
      node = node.expression;
      continue;
    }
    return node;
  }
}

function isLiteral(node: ts.Node): boolean {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  );
}

function isEscapeCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false;
  const expr = node.expression;
  if (ts.isIdentifier(expr)) return ESCAPE_NAMES.has(expr.text);
  if (ts.isPropertyAccessExpression(expr)) return ESCAPE_NAMES.has(expr.name.text);
  return false;
}

function isBodyAccess(node: ts.Node): boolean {
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) {
    return false;
  }
  return ts.isIdentifier(node.expression) && node.expression.text === 'body';
}

function isRequestJsonCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  const expr = node.expression;
  return (
    ts.isPropertyAccessExpression(expr) &&
    expr.name.text === 'json' &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === 'request'
  );
}

function propertyName(node: ts.PropertyAccessExpression | ts.ElementAccessExpression): string | null {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  const arg = node.argumentExpression;
  return arg && ts.isStringLiteral(arg) ? arg.text : null;
}

function propNameOf(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function calleeName(call: ts.CallExpression): string | null {
  return ts.isIdentifier(call.expression) ? call.expression.text : null;
}

function templateHasHtml(node: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral): boolean {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text.includes('<');
  if (node.head.text.includes('<')) return true;
  return node.templateSpans.some((span) => span.literal.text.includes('<'));
}

function htmlEscapeViolations(source: string): string[] {
  const sf = ts.createSourceFile(
    'route.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const fns = new Map<string, FnInfo>();
  const ensure = (name: string): FnInfo => {
    let info = fns.get(name);
    if (!info) {
      info = { params: [], bindings: [], calls: [] };
      fns.set(name, info);
    }
    return info;
  };

  const visit = (node: ts.Node, currentFn: string) => {
    if (isFunctionLike(node)) {
      const name = functionName(node) ?? `anon@${node.pos}`;
      ensure(name).params = paramNames(node);
      ts.forEachChild(node, (child) => visit(child, name));
      return;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      !isFunctionLike(node.initializer)
    ) {
      ensure(currentFn).bindings.push({ name: node.name.text, initializer: node.initializer });
    }
    if (ts.isCallExpression(node)) ensure(currentFn).calls.push(node);
    ts.forEachChild(node, (child) => visit(child, currentFn));
  };
  visit(sf, 'module');

  const bindingTaint = new Set<string>();
  const memberTaint = new Set<string>();
  const bindingKey = (fn: string, name: string) => `${fn}::${name}`;
  const isBindingTainted = (fn: string, name: string) =>
    bindingTaint.has(bindingKey(fn, name)) ||
    (fn !== 'module' && bindingTaint.has(bindingKey('module', name)));

  const isTainted = (expr: ts.Expression, fn: string): boolean => {
    const node = unwrap(expr);
    if (isEscapeCall(node)) return false;
    if (isBodyAccess(node) || isRequestJsonCall(node)) return true;
    if (ts.isIdentifier(node)) return isBindingTainted(fn, node.text);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        const prop = propertyName(node);
        if (prop && memberTaint.has(`${fn}::${node.expression.text}.${prop}`)) return true;
        if (isBindingTainted(fn, node.expression.text)) return true;
      }
      return isTainted(node.expression, fn);
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) &&
        isTainted(callee.expression, fn)
      ) {
        return true;
      }
      return node.arguments.some((arg) => isTainted(arg, fn));
    }
    if (ts.isConditionalExpression(node)) {
      return isTainted(node.whenTrue, fn) || isTainted(node.whenFalse, fn);
    }
    if (ts.isBinaryExpression(node)) return isTainted(node.left, fn) || isTainted(node.right, fn);
    if (ts.isTemplateExpression(node)) {
      return node.templateSpans.some((span) => isTainted(span.expression, fn));
    }
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
      return isTainted(node.operand, fn);
    }
    if (isLiteral(node)) return false;
    return false;
  };

  for (let i = 0; i < 32; i += 1) {
    let changed = false;
    for (const [caller, info] of fns) {
      for (const call of info.calls) {
        const name = calleeName(call);
        if (!name || ESCAPE_NAMES.has(name) || !fns.has(name)) continue;
        const param = fns.get(name)?.params[0];
        const arg0 = call.arguments[0];
        if (!param || !arg0) continue;
        if (ts.isObjectLiteralExpression(arg0)) {
          for (const prop of arg0.properties) {
            let keyName: string | null = null;
            let tainted = false;
            if (ts.isShorthandPropertyAssignment(prop)) {
              keyName = prop.name.text;
              tainted = isBindingTainted(caller, keyName);
            } else if (ts.isPropertyAssignment(prop)) {
              keyName = propNameOf(prop.name);
              tainted = isTainted(prop.initializer, caller);
            }
            if (!keyName || !tainted) continue;
            const key = `${name}::${param}.${keyName}`;
            if (!memberTaint.has(key)) {
              memberTaint.add(key);
              changed = true;
            }
          }
        } else if (isTainted(arg0, caller)) {
          const key = bindingKey(name, param);
          if (!bindingTaint.has(key)) {
            bindingTaint.add(key);
            changed = true;
          }
        }
      }
    }
    for (const [fnName, info] of fns) {
      for (const binding of info.bindings) {
        if (!isTainted(binding.initializer, fnName)) continue;
        const key = bindingKey(fnName, binding.name);
        if (!bindingTaint.has(key)) {
          bindingTaint.add(key);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  const violations: string[] = [];
  const scan = (node: ts.Node, fn: string) => {
    if (isFunctionLike(node)) {
      const name = functionName(node) ?? `anon@${node.pos}`;
      ts.forEachChild(node, (child) => scan(child, name));
      return;
    }
    if (ts.isTemplateExpression(node) && templateHasHtml(node)) {
      for (const span of node.templateSpans) {
        if (!isTainted(span.expression, fn)) continue;
        const text = span.expression.getText(sf).replace(/\s+/g, ' ').slice(0, 160);
        violations.push(`unescaped request-body value in email HTML: \${${text}}`);
      }
    }
    ts.forEachChild(node, (child) => scan(child, fn));
  };
  scan(sf, 'module');
  return violations;
}

function hasRealEscapeHelper(source: string): boolean {
  const sf = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let real = false;
  const visit = (node: ts.Node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      ESCAPE_NAMES.has(node.name.text) &&
      node.body
    ) {
      const text = node.body.getText(sf);
      if (
        text.includes('&amp;') &&
        text.includes('&lt;') &&
        text.includes('&gt;') &&
        text.includes('&quot;')
      ) {
        real = true;
      }
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.includes('html-escape') &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      for (const el of node.importClause.namedBindings.elements) {
        if (el.name.text === 'escapeHtml') real = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return real;
}

const publicRoot = join(process.cwd(), 'app/api/public');
const routes = walkRoutes(publicRoot);
assert.ok(routes.length > 10, 'expected to scan the public API routes');

const seen = new Set<string>();
for (const abs of routes) {
  const rel = toRel(abs);
  seen.add(rel);
  const source = readFileSync(abs, 'utf8');
  const problem = mailerProblem(rel, source, PUBLIC_MAILER_ALLOWLIST);
  assert.equal(problem, null, problem ?? rel);
  if (!Object.prototype.hasOwnProperty.call(PUBLIC_MAILER_ALLOWLIST, rel)) continue;
  const violations = htmlEscapeViolations(source);
  assert.deepEqual(violations, [], `${rel}\n${violations.join('\n')}`);
  assert.equal(hasRealEscapeHelper(source), true, `${rel} must escape HTML with a real helper`);
}

for (const [rel, reason] of Object.entries(PUBLIC_MAILER_ALLOWLIST)) {
  assert.equal(isRetiredAnonymousMailer(rel), false, rel);
  assert.equal(reason.trim().includes('\n'), false, rel);
  assert.ok(reason.trim().length > 20, rel);
  assert.ok(seen.has(rel), `allowlisted route is missing: ${rel}`);
  assert.equal(sendsEmail(readFileSync(rel, 'utf8')), true, `${rel} is allowlisted but does not send email`);
}

assert.equal(existsSync(join(publicRoot, RETIRED_SEGMENT)), false, 'directory invite route must be deleted');

const founding = readFileSync('app/api/public/founding-waitlist/route.ts', 'utf8');
assert.equal(sendsEmail(founding), true);
assert.equal(isAuthenticated(founding), false, 'founding-waitlist stays allowlisted because it does not authenticate');
assert.ok(mailerProblem('app/api/public/founding-waitlist/route.ts', founding, {}));

for (const rel of ['app/api/public/fitgraph/route.ts', 'app/api/public/portals/trade/act/route.ts']) {
  const source = readFileSync(rel, 'utf8');
  assert.equal(sendsEmail(source), true, rel);
  assert.equal(isAuthenticated(source), true, rel);
  assert.equal(mailerProblem(rel, source, {}), null, rel);
}

const retiredRel = `app/api/public/${RETIRED_SEGMENT}/route.ts`;
assert.ok(mailerProblem(retiredRel, 'requireVerifiedUser(); getResend();', PUBLIC_MAILER_ALLOWLIST));
assert.ok(
  mailerProblem(
    'app/api/public/not-a-real-route/route.ts',
    'const resend = getResend(); await resend.emails.send({ html: "<p>hi</p>" });',
    PUBLIC_MAILER_ALLOWLIST
  )
);

const unescaped = `
export async function POST(request: NextRequest) {
  const body = await request.json();
  const companyName = body.companyName ? String(body.companyName).slice(0, 200) : 'your company';
  const note = body.message ? String(body.message).slice(0, 400) : '';
  await resend.emails.send({
    html: \`<p><strong>\${companyName}</strong></p>\${note ? \`<p>\${note}</p>\` : ''}\`,
  });
}
`;
assert.ok(htmlEscapeViolations(unescaped).length >= 2, 'unescaped body fields must fail');

const escaped = `
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
async function send(opts: { companyName: string | null; note: string }) {
  const name = opts.companyName ? escapeHtml(opts.companyName) : 'your company';
  const note = opts.note ? escapeHtml(opts.note) : '';
  await resend.emails.send({ html: \`<p><strong>\${name}</strong></p>\${note ? \`<p>\${note}</p>\` : ''}\` });
}
export async function POST(request: NextRequest) {
  const body = await request.json();
  const companyName = body.companyName ? String(body.companyName).slice(0, 200) : null;
  const note = body.message ? String(body.message).slice(0, 400) : '';
  await send({ companyName, note });
}
`;
assert.deepEqual(htmlEscapeViolations(escaped), []);
assert.equal(hasRealEscapeHelper(escaped), true);

const stubEscape = `
function escapeHtml(s: string) { return s; }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const message = String(body.message || '');
  await resend.emails.send({ html: \`<p>\${escapeHtml(message)}</p>\` });
}
`;
assert.deepEqual(htmlEscapeViolations(stubEscape), []);
assert.equal(hasRealEscapeHelper(stubEscape), false, 'a no-op escape helper must not count');

console.log('brief105-public-mailers.test.ts ok');
