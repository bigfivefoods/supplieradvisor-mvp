/**
 * SupplierAdvisor® company profile — A4 PDF.
 *
 *   node scripts/company-profile/build.mjs [--out public/supplieradvisor-company-profile.pdf] [--html out.html]
 *
 * Prices, trial length, referral rates, industry packs, contact details and the
 * industry catalogue are read from the app's own source (lib/billing,
 * lib/product, lib/marketing), so the profile cannot drift from /pricing or the
 * footer. Product copy is taken from the live marketing pages (home sections in
 * components/marketing, /pricing, /verification-sla, /join, /me) and the Big
 * Five Group update "Found, verified, trusted and paid: SupplierAdvisor® as a
 * system for empowerment" (7 Oct 2026). The compare matrix rows are read from
 * components/marketing/ComparePlatforms.tsx.
 * See content.mjs for the source of each block.
 *
 * Rendering: Chromium via Playwright (npx playwright install chromium, or set
 * CHROME_PATH). Inter (static weights, SIL OFL) is embedded from ./fonts.
 * Images are cropped and re-encoded in the browser, so no image library is needed.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { chromium } from "@playwright/test";
import * as C from "./content.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const outPdf = path.resolve(root, arg("--out", "public/supplieradvisor-company-profile.pdf"));
const outHtml = arg("--html", null);

const SITE = "https://www.supplieradvisor.com";
const META = {
  title: "SupplierAdvisor® Company Profile",
  author: "Big Five Connect · Big Five Group™",
  subject:
    "SupplierAdvisor®, the supply-chain operating system on a verified network of companies: B2B, B2G (SchoolAdvisor®) and B2C, modules, trust and security, pricing and how to get started.",
  keywords:
    "SupplierAdvisor®, SchoolAdvisor®, supply-chain operating system, OTIFEF, verified suppliers, B2B, B2G, B2C, Big Five Connect, Big Five Group, South Africa",
};

// ── Load app data straight from lib/ (TypeScript → temp ESM) ─────────────────
async function loadLib(entries, dir) {
  const done = new Set();
  const flat = (rel) => rel.replace(/[\\/]/g, "__");
  async function transpile(rel) {
    if (done.has(rel)) return;
    done.add(rel);
    const src = await fs.readFile(path.join(root, `${rel}.ts`), "utf8");
    let js = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const deps = [];
    js = js.replace(/from\s+["']@\/([\w/-]+)["']/g, (_, p) => {
      deps.push(p);
      return `from "./${flat(p)}.mjs"`;
    });
    await fs.writeFile(path.join(dir, `${flat(rel)}.mjs`), js);
    for (const d of deps) await transpile(d);
  }
  const mods = {};
  for (const [key, rel] of Object.entries(entries)) {
    await transpile(rel);
    mods[key] = await import(pathToFileURL(path.join(dir, `${flat(rel)}.mjs`)).href);
  }
  return mods;
}

// ── Compare matrix: read the SECTIONS table out of the home page component ──
async function loadCompare(billing) {
  const src = await fs.readFile(path.join(root, "components/marketing/ComparePlatforms.tsx"), "utf8");
  const a = src.indexOf("type Cell"), b = src.indexOf("const COLS");
  if (a < 0 || b < 0) throw new Error("ComparePlatforms.tsx: SECTIONS table not found");
  const js = ts.transpileModule(src.slice(a, b), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const sections = new Function("COMPANY_SUBSCRIPTION_MONTHLY_ZAR", "COMPANY_TRIAL_DAYS", `${js}; return SECTIONS;`)(
    billing.COMPANY_SUBSCRIPTION_MONTHLY_ZAR,
    billing.COMPANY_TRIAL_DAYS,
  );
  const rows = Object.fromEntries(sections.flatMap((s) => s.rows.map((r) => [r.capability, r])));
  return C.compareRows.map((name) => {
    if (!rows[name]) throw new Error(`Compare row not found on the site: ${name}`);
    return rows[name];
  });
}

// ── Images: crop and re-encode in the browser (no native image deps) ─────────
async function prepImages(browser) {
  // Serve public/ on a fake same-origin host so canvas reads are not tainted.
  const pg = await browser.newPage();
  const ORIGIN = "http://profile.local";
  await pg.route(`${ORIGIN}/**`, async (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).slice(1);
    if (!rel) return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>img</title>" });
    const body = await fs.readFile(path.join(root, "public", rel));
    const contentType = rel.endsWith(".png") ? "image/png" : "image/jpeg";
    return route.fulfill({ contentType, body });
  });
  await pg.goto(`${ORIGIN}/`);
  const enc = async (file, opts) => {
    const src = `${ORIGIN}/${file}`;
    return pg.evaluate(
      async ({ src, crop = [0, 0, 1, 1], width, quality = 0.8, type = "image/jpeg", whiten = false }) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const [x, y, w, h] = crop;
        const sx = x * img.naturalWidth, sy = y * img.naturalHeight;
        const sw = w * img.naturalWidth, sh = h * img.naturalHeight;
        const cw = Math.min(width, Math.round(sw)), ch = Math.round((cw * sh) / sw);
        const c = document.createElement("canvas");
        c.width = cw;
        c.height = ch;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
        if (whiten) {
          // Logo for dark pages: navy "SA" letters → white; the cyan tick stays.
          const d = ctx.getImageData(0, 0, cw, ch);
          for (let i = 0; i < d.data.length; i += 4) {
            if (d.data[i + 3] > 0 && d.data[i + 1] < 150) d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
          }
          ctx.putImageData(d, 0, 0);
        }
        return c.toDataURL(type, quality);
      },
      { ...opts, src },
    );
  };
  // Site hero photography (AI-generated, as used on the home page hero). The
  // bottom band carries a generator watermark, so it is cropped off.
  const heroCrop = [0, 0, 1, 0.9];
  const img = {
    b2b: await enc("marketing/hero-b2b.jpg", { crop: heroCrop, width: 1280, quality: 0.82 }),
    b2g: await enc("marketing/hero-b2g.jpg", { crop: heroCrop, width: 1280, quality: 0.8 }),
    b2c: await enc("marketing/hero-b2c.jpg", { crop: heroCrop, width: 1100, quality: 0.8 }),
    logo: await enc("sa-logo.png", { width: 640, type: "image/png" }),
    logoLight: await enc("sa-logo.png", { width: 640, type: "image/png", whiten: true }),
    supercube: await enc("images/supercube-logo-for-home-page.png", { width: 705, type: "image/png" }),
  };
  await pg.close();
  return img;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const link = (href, text, cls = "") => `<a href="${esc(href)}"${cls ? ` class="${cls}"` : ""}>${text}</a>`;
const site = (p, text) => link(SITE + p, text ?? `supplieradvisor.com${p}`);
/**
 * Brand marks in text nodes only (never in URLs, e-mail addresses or attributes):
 * every "SupplierAdvisor" / "SchoolAdvisor" carries ®, never ®®, and each
 * *Advisor® mark stays on one line.
 */
const brand = (html) =>
  html
    .split(/(<[^>]+>)/)
    .map((part) =>
      part.startsWith("<")
        ? part
        : part
            .replace(/\b(SupplierAdvisor|SchoolAdvisor)(?!®)/g, "$1®")
            .replace(/\b([A-Z][a-z]+Advisor®)/g, '<span class="nw">$1</span>')
            .replace(/(\w)'(\w)/g, "$1\u2019$2"),
    )
    .join("");
const tick = `<svg class="tick" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8.6l3.4 3.2L13.6 3.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ticks = (items, cls = "") =>
  `<ul class="ticks ${cls}">${items.map((t) => `<li>${tick}<span>${t}</span></li>`).join("")}</ul>`;
const flow = (steps, cls = "") =>
  `<div class="flow ${cls}">${steps.map((s) => `<span>${s}</span>`).join('<i aria-hidden="true">→</i>')}</div>`;

let pageNo = 0;
function page(body, { dark = false, cls = "", footer = true } = {}) {
  pageNo += 1;
  const foot = footer
    ? `<footer class="foot"><span>SupplierAdvisor® · Company profile</span><span>${link(SITE, "www.supplieradvisor.com")}</span><span class="pn">${String(pageNo).padStart(2, "0")}</span></footer>`
    : "";
  return `<section class="page${dark ? " dark" : ""} ${cls}"><div class="band" aria-hidden="true"></div>${body}${foot}</section>`;
}
const eyebrow = (t) => `<p class="eyebrow">${t}</p>`;
const lockup = (img, cls) =>
  `<div class="lockup ${cls}"><img src="${img.logoLight}" alt=""><span>SupplierAdvisor®</span></div>`;
const mark = (v) =>
  `<i class="cm cm-${v}" role="img" aria-label="${{ strong: "Best-in-class", yes: "Covered", partial: "Partial or bolt-on", no: "Not designed for this" }[v]}"></i>`;

/** Browser-frame product mock, styled like the site's ShotWindow. Sample data only. */
const shot = (pathLabel, inner) =>
  `<figure class="shot" role="img" aria-label="Product mock with sample data"><div class="shot-bar"><i></i><i></i><i></i><span>${pathLabel}</span></div><div class="shot-body">${inner}</div></figure>`;

// ── Pages ────────────────────────────────────────────────────────────────────
function build(L, img, cmpRows) {
  const { BILLING_TERMS, COMPANY_TRIAL_DAYS, COMPANY_SUBSCRIPTION_MONTHLY_ZAR, formatZar } = L.billing;
  const { INDUSTRY_PACK_MONTHLY_ZAR } = L.packaging;
  const { REFERRAL_LEVEL_RATES_PCT: RR, REFERRAL_TOTAL_CAP_PCT: RCAP } = L.referral;
  const { FOOTER_CONTACT: CT, FOOTER_TAGLINE, FOOTER_MOTTO } = L.footer;
  const { INDUSTRIES } = L.industries;
  const zar = (n) => formatZar(n).replace(/\s/g, "\u00a0");
  const zar2 = (n) =>
    "R" + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, "\u00a0");
  const core = zar(COMPANY_SUBSCRIPTION_MONTHLY_ZAR);
  const pack = zar(INDUSTRY_PACK_MONTHLY_ZAR);
  const trial = COMPANY_TRIAL_DAYS;
  const ind = Object.fromEntries(INDUSTRIES.map((i) => [i.slug, i]));
  const pages = [];

  // 1 · Cover
  pages.push(
    page(
      `
    <div class="cover-img" style="background-image:url('${img.b2b}')" role="img" aria-label="Warehouse operations beside a glass control room"></div>
    <div class="cover-fade"></div>
    ${lockup(img, "cover-logo")}
    <div class="cover-text">
      ${eyebrow(`Company profile · 2026`)}
      <h1>Get found. Get verified.<br>Get trusted. Get paid.</h1>
      <p class="lede">SupplierAdvisor® is a supply-chain operating system built around a verified network of companies: trade, operations, quality and finance in one workspace, for B2B, B2G and B2C.</p>
      <div class="cover-chips"><span><b>B2B</b> Business to business</span><span><b>B2G</b> Business to government</span><span><b>B2C</b> Free SA Member account</span></div>
      <p class="cover-by">Big Five Connect · the Empower pillar of Big Five Group™ · ${link(SITE, "www.supplieradvisor.com")}</p>
    </div>`,
      { dark: true, cls: "cover", footer: false },
    ),
  );

  // 2 · What it is
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("What SupplierAdvisor® is")}
      <h2>The world's most trusted supplier advice, and the operating system behind it.</h2>
      <p class="lede">${C.whatItIs}</p>
      <div class="grid4 verbs">
        ${C.fourVerbs.map((v, i) => `
          <article class="card verb">
            <p class="num">0${i + 1}</p>
            <h3>${v.title}</h3>
            <p class="small">${v.body}</p>
          </article>`).join("")}
      </div>
      <p class="notband">Not Excel. Not accounting-only. Not a multi-year ERP project.</p>
      <div class="statrow">
        ${C.stats.map((s) => `<div><p class="big">${s.value === "30d" ? `${trial}d` : s.value}</p><p class="k">${s.label}</p></div>`).join("")}
      </div>
      <div class="who">
        <div>
          <p class="k">Who we are</p>
          <p class="motto">Feed. Educate. Empower.</p>
          <p class="small">${C.whoWeAre}</p>
        </div>
        <div class="pillars">
          ${C.pillars.map((p) => `<div class="pill${p.us ? " us" : ""}"><p class="k">${p.k}</p><p class="lt">${p.title}</p><p class="small">${p.body}</p></div>`).join("")}
        </div>
      </div>
      <blockquote class="pull"><p>${C.quote.text}</p><cite>${C.quote.cite}</cite></blockquote>
    </div>`),
  );

  // 3 · One fabric
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("Who the network serves")}
      <h2>B2B. B2G. B2C. One trusted fabric.</h2>
      <p class="lede">${C.fabricLede}</p>
      <div class="grid3 aud">
        ${C.audiences.map((a) => `
          <article class="card audcard">
            <div class="photo aud-photo"><img src="${img[a.id]}" alt="${esc(a.alt)}" style="object-position:${a.pos}"></div>
            <p class="code">${a.code}</p>
            <h3>${a.title}</h3>
            <p class="small">${a.body}</p>
            ${ticks(a.points, "sm")}
            <p class="cta">${site(a.href, a.cta)}</p>
          </article>`).join("")}
      </div>
      <div class="split even mt">
        <div class="card soft">
          <p class="k">Why operators join</p>
          <p class="lt">Trust is a control, not a brochure</p>
          <p class="small">${C.whyTrust}</p>
        </div>
        <div class="card soft">
          <p class="k">Built for multi-entity groups</p>
          <p class="lt">One login, clean walls</p>
          <p class="small">${C.whyGroups}</p>
        </div>
      </div>
    </div>`),
  );

  // 4 · Trust layer
  const scorecard = shot(
    "app.supplieradvisor.com/dashboard/suppliers",
    `<p class="m-k">Suppliers · OTIFEF portfolio</p>
     <div class="m-kpis"><div><b>96%</b><span>OTIFEF</span></div><div><b>28</b><span>Connected</span></div><div><b>98%</b><span>On time</span></div></div>
     ${C.sampleSuppliers.map((s, i) => `<div class="m-row"><span class="m-n">0${i + 1}</span><span>${s.name}</span><b>${s.score}</b></div>`).join("")}
     <p class="m-cap">Scored after every delivery</p>`,
  );
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("The trust layer")}
      <h2>When a lot fails, the ship stops.</h2>
      <p class="lede">Verification, ratings, lots, HACCP and SHEQ are live controls, not after-the-fact PDFs.</p>
      <div class="split otif-split">
        <div>
          <p class="k">OTIFEF · On-Time, In-Full, Error-Free</p>
          <div class="otif">
            <div><b>OT</b><span>On-Time</span></div><div><b>IF</b><span>In-Full</span></div><div><b>EF</b><span>Error-Free</span></div>
          </div>
          <p class="body-p">${C.otifef}</p>
          <p class="body-p">${C.otifefSme}</p>
        </div>
        <div>${scorecard}<p class="note">Product mock with sample data, as shown in the site's product demo.</p></div>
      </div>
      <div class="grid3 mt-l trustgrid">
        ${C.trustCards.map((t) => `<article class="card"><p class="lt">${t.title}</p><p class="small">${t.body}</p></article>`).join("")}
      </div>
      <div class="card soft loop mt-l">
        <div><p class="k">Every PO ends in a rating</p><p class="lt">${C.loop.title}</p><p class="small">${C.loop.body}</p></div>
        ${flow(["Draft", "Sent", "Accept", "Deliver", "Rate"], "big-flow")}
      </div>
    </div>`),
  );

  // 5 · Get paid · the trade loop
  const poMock = shot(
    "app.supplieradvisor.com/dashboard/suppliers",
    `<p class="m-k">Raise PO · escrow or standard</p>
     ${flow(["Draft", "Sent", "Accept", "Deliver", "Rate"], "m-flow")}
     <p class="m-k mt-s">Revenue desk · quotes · orders · AR</p>
     ${C.sampleRevenue.map((r) => `<div class="m-row"><span>${r.a}</span><b>${r.b}</b></div>`).join("")}`,
  );
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("Get paid")}
      <h2>POs, quotes, orders, invoices and payments on the same books.</h2>
      <p class="lede">${C.getPaidLede}</p>
      <div class="split">
        <div>
          ${C.tradeCards.map((t) => `<div class="row-item"><p class="lt">${t.title}</p><p class="small">${t.body}</p></div>`).join("")}
        </div>
        <div>${poMock}<p class="note">Product mock with sample data, as shown on the home page.</p>
          <div class="card escrow">
            <p class="k">Optional · on-chain</p>
            <p class="lt">Escrow on purchase orders</p>
            <p class="small">${C.escrow}</p>
          </div>
        </div>
      </div>
      <h3 class="mt-l h3">Four steps to live ops</h3>
      <div class="grid4 steps4">
        ${C.fourSteps.map((s, i) => `<article class="card"><p class="num">0${i + 1}</p><p class="lt">${s.title}</p><p class="small">${s.body}</p></article>`).join("")}
      </div>
    </div>`),
  );

  // 6 · Core OS modules
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("Modules · Core OS")}
      <h2>Every critical system. One company workspace.</h2>
      <p class="lede">${C.coreLede}</p>
      <div class="grid3 modgrid">
        <article class="card hl">
          <p class="k">Always included</p>
          <p class="price-l">Core OS <b>${core}/mo</b></p>
          <p class="small">${C.coreIncluded}</p>
          <p class="small mt-s">${trial}-day free trial · unlimited users</p>
        </article>
        ${C.coreModules.map((m, i) => `
          <article class="card mod">
            <p class="num">${String(i + 1).padStart(2, "0")}</p>
            <p class="lt">${m.name}</p>
            <p class="tag">${m.tag}</p>
            <p class="small">${m.body}</p>
          </article>`).join("")}
      </div>
    </div>`),
  );

  // 7 · Packaging + sector + people
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("How it fits")}
      <h2>Core OS, then the layers that match how you trade.</h2>
      <p class="lede">${C.packagingLede}</p>
      <div class="layers">
        ${C.layers.map((l, i) => `<div class="layer${i === 0 ? " on" : ""}"><p class="num">0${i + 1}</p><p class="lt">${l.name}</p><p class="lp">${l.price.replace("{core}", core).replace("{pack}", pack)}</p><p class="small">${l.body}</p></div>`).join("")}
      </div>
      <h3 class="mt h3">Sector modules · how you make and move</h3>
      <div class="grid3">
        ${C.sectorModules.map((m) => `<article class="card"><p class="lt">${m.name}</p><p class="tag">${m.tag}</p><p class="small">${m.body}</p>${ticks(m.points, "sm")}</article>`).join("")}
      </div>
      <div class="split even mt">
        <div class="card">
          <p class="k">Also in every workspace</p>
          ${C.alsoIncluded.map((a) => `<div class="mini"><p class="lt">${a.name}</p><p class="small">${a.body}</p></div>`).join("")}
        </div>
        <div class="card sc">
          <img class="sc-logo" src="${img.supercube}" alt="Super-Cube®">
          <p class="lt">${C.superCube.title}</p>
          <p class="small">${C.superCube.body}</p>
          ${ticks(C.superCube.points, "sm")}
        </div>
      </div>
    </div>`),
  );

  // 8 · Industry Advisors
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow(`Industry Advisors · ${pack}/mo each`)}
      <h2>Vertical depth on the same fabric.</h2>
      <p class="lede">${C.industryLede}</p>
      ${C.industryGroups.map((g) => `
        <p class="k grp">${g.label}</p>
        <div class="${g.items.length === 4 ? "grid4 g4" : "grid3"} indgrid">
          ${g.items.map((m) => `<article class="card ind"><p class="lt">${m.name}</p><p class="tag">${m.tag}</p><p class="small">${m.body}</p></article>`).join("")}
          ${g.shared ? `<article class="card soft ind"><p class="lt">Shared desk tools</p><p class="small">Clinic and fitness Advisors share ${C.clinicShared}</p></article>` : ""}
        </div>`).join("")}
    </div>`),
  );

  // 9 · B2G · SchoolAdvisor®
  const ps = ind["public-sector"];
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("B2G · public sector")}
      <h2>${esc(ps.headline)}</h2>
      <p class="lede">${esc(ps.subhead)}</p>
      <div class="split b2g-split">
        <div class="photo b2g-photo"><img src="${img.b2g}" alt="Civic plaza and public-sector offices at dusk"></div>
        <div class="pw">
          <div><p class="k">Pain today</p><ul class="dash">${ps.pains.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
          <div><p class="k">With SupplierAdvisor®</p>${ticks(ps.wins.map(esc), "sm")}</div>
        </div>
      </div>
      <div class="card school mt-l">
        <div class="school-head">
          <p class="k">Government module</p>
          <h3>SchoolAdvisor®: the public-sector pathway for school nutrition</h3>
          <p class="small">${C.school.body}</p>
        </div>
        <div class="grid3 roles">
          ${C.school.roles.map((r) => `<div class="role"><p class="lt">${r.who}</p><p class="small">${r.what}</p></div>`).join("")}
        </div>
        ${flow(C.school.tiers, "tiers")}
      </div>
      <div class="split even mt-l">
        <div class="card">
          <p class="k">HealthAdvisor® · DoH</p>
          <p class="small">${C.health}</p>
          <p class="k mt-s">Access</p>
          <p class="small">${C.b2gAccess}</p>
        </div>
        <div class="card case">
          <p class="k">Case study · DBE school nutrition network, KZN</p>
          <div class="case-nums"><div><b>~6 000</b><span>KZN schools</span></div><div><b>~1 800</b><span>service providers</span></div></div>
          <p class="note">Approximate programme scope as published in the Big Five Group company profile; not audited headcount.</p>
        </div>
      </div>
    </div>`),
  );

  // 10 · B2C · SA Member
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("B2C · SA Member · always free")}
      <h2>One personal wallet for every business on the platform.</h2>
      <div class="split member-split">
        <div>
          <p class="lede first">${C.member.lede}</p>
          <div class="card hl free">
            <p class="k">Free for members</p>
            <p class="small">${C.member.free}</p>
          </div>
        </div>
        <div class="photo member-photo"><img src="${img.b2c}" alt="Member using SA Member on their phone"></div>
      </div>
      <div class="grid3 feat mt">
        ${C.member.features.map((f) => `<div class="fi"><p class="lt">${f.t}</p><p class="small">${f.b}</p></div>`).join("")}
      </div>
      <p class="note">Open or create yours at ${site("/me")}.</p>
    </div>`),
  );

  // 11 · Compare + replace the stack
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("Compare")}
      <h2>Excel. Xero. Enterprise ERP. Or the operating system they never became.</h2>
      <p class="lede">${C.compareLede}</p>
      <div class="grid4 cmp">
        ${C.compare.map((c, i) => `<article class="card${i === 3 ? " hl" : ""}"><p class="k">${c.k}</p><p class="lt">${c.name}</p><p class="small">${c.body}</p></article>`).join("")}
      </div>
      <table class="matrix">
        <caption class="k">Capability by class of tool, from the comparison on supplieradvisor.com</caption>
        <thead><tr><th scope="col">Capability</th><th scope="col">Excel / Sheets</th><th scope="col">Xero-class</th><th scope="col">Major ERP</th><th scope="col">SupplierAdvisor®</th></tr></thead>
        <tbody>${cmpRows.map((r) => `<tr><th scope="row">${esc(r.capability)}</th><td>${mark(r.excel)}</td><td>${mark(r.xero)}</td><td>${mark(r.erp)}</td><td class="sa">${mark(r.sa)}</td></tr>`).join("")}</tbody>
      </table>
      <p class="legend">${mark("strong")} Best-in-class ${mark("yes")} Covered ${mark("partial")} Partial / bolt-on ${mark("no")} Not designed for this</p>
      <div class="split even stack">
        <div class="card">
          <p class="k">Before · fragmented</p>
          <div class="tools">${C.before.map((t) => `<span>${t}</span>`).join("")}</div>
          <p class="small mt-s">Duplicate data · version wars · no holds · no network · audit pain</p>
        </div>
        <div class="card soft">
          <p class="k">After · SupplierAdvisor®</p>
          <div class="tools on">${C.after.map((t) => `<span>${t}</span>`).join("")}</div>
          <p class="small mt-s">One company · one COA · one organogram · verified edges</p>
        </div>
      </div>
      <p class="note">${C.compareNote}</p>
    </div>`),
  );

  // 12 · Security & trust
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("Trust & security")}
      <h2>Built for operators who get audited.</h2>
      <p class="lede">B2G buyers and serious B2B partners expect roles, trails and holds, not screenshots of a spreadsheet.</p>
      <div class="grid3 mt">
        ${C.security.map((s) => `<article class="card"><p class="lt">${s.t}</p><p class="small">${s.b}</p></article>`).join("")}
      </div>
      <div class="split even mt">
        <div class="card">
          <p class="k">Live on supplieradvisor.com</p>
          ${ticks(C.webProtections, "sm")}
        </div>
        <div class="card">
          <p class="k">Africa-ready verification &amp; billing</p>
          ${ticks(C.africaReady, "sm")}
        </div>
      </div>
      <div class="card cipc mt">
        <div class="cipc-head"><p class="k">Paid CIPC verification · ${site("/verification-sla")}</p><p class="lt">${C.cipc.title}</p></div>
        <ol class="cipc-steps">${C.cipc.steps.map((s) => `<li><b>${s.t}</b><span>${s.b}</span></li>`).join("")}</ol>
      </div>
      <div class="card soft mt">
        <p class="k">Privacy</p>
        <p class="small">${C.privacy} ${site("/privacy")}</p>
      </div>
    </div>`),
  );

  // 13 · Pricing
  const tiers = BILLING_TERMS;
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("Pricing")}
      <h2>${trial} days free, then from ${core}/mo.</h2>
      <p class="lede">One plan, full platform. Priced per company workspace, not per seat: unlimited users on every tier. Pay monthly or prepay and save up to ${tiers[tiers.length - 1].discountPercent}%, with secure Paystack checkout in South African rand.</p>
      <div class="grid4 tiers4">
        ${tiers.map((t) => `
          <article class="card tier${t.id === "1y" ? " pop" : ""}">
            <p class="k">${esc(t.label)}</p>
            ${t.id === "1y" ? `<span class="badge">Most popular</span>` : t.id === "3y" ? `<span class="badge alt">Best value</span>` : ""}
            <p class="price">${zar(t.payZar)}</p>
            <p class="per">${t.months === 1 ? "per month · list rate" : `prepaid · ${t.months} months`}</p>
            <p class="small">${t.months === 1 ? "Flexible, month-to-month." : `${zar(t.listZar)} list · save ${t.discountPercent}% (${zar(t.savingsZar)})`}</p>
            <p class="eff">${t.months > 1 ? `~${zar(Math.round(t.effectiveMonthlyZar))}/mo effective` : "No prepayment"}</p>
            <p class="small tier-foot">Full platform · unlimited users</p>
          </article>`).join("")}
      </div>
      <div class="split pricing-split mt">
        <div class="card">
          <p class="k">Everything included on every tier</p>
          ${ticks(C.included(trial), "sm")}
        </div>
        <div>
          <table class="addons">
            <caption class="k">Add-ons and other fees, as listed on the site</caption>
            <tbody>
              <tr><th>Industry Advisor packs</th><td>+${pack}/mo each</td></tr>
              <tr><th>Paid CIPC verification</th><td>R69 once</td></tr>
              <tr><th>SA Member (B2C)</th><td>Free for members</td></tr>
              <tr><th>HireAdvisor® hire GMV</th><td>2.5% to the listing business</td></tr>
              <tr><th>Government &amp; bespoke</th><td>Specialist-led setup</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="split even mt">
        <div class="card hl">
          <p class="k">Founding partners</p>
          <p class="lt">First 25 companies: free for life</p>
          <p class="small">${C.founding}</p>
        </div>
        <div class="card">
          <p class="k">Paid to grow a good network</p>
          <p class="lt">Referral fees L1 ${RR[0]}% · L2 ${RR[1]}% · L3 ${RR[2]}% (max ${RCAP}%)</p>
          <p class="small">${C.referral}</p>
        </div>
      </div>
      <div class="card example mt">
        <div><p class="k">Referral example, from /pricing</p><p class="small">${C.refExample}</p></div>
        <table class="ex"><thead><tr><th>Who earns</th><th>Level</th><th>Fee</th></tr></thead><tbody>
          ${[["Company B", 0], ["Company A", 1], ["You", 2]].map(([who, i]) => `<tr><td>${who}</td><td>L${i + 1} · ${RR[i]}%</td><td>${zar2((COMPANY_SUBSCRIPTION_MONTHLY_ZAR * RR[i]) / 100)}</td></tr>`).join("")}
          <tr class="tot"><td colspan="2">Total shared (of ${core})</td><td>${zar2((COMPANY_SUBSCRIPTION_MONTHLY_ZAR * (RR[0] + RR[1] + RR[2])) / 100)}</td></tr>
        </tbody></table>
      </div>
      <p class="note">No card required for the trial · cancel anytime. Prices in ZAR as listed on ${site("/pricing")}. After the trial, subscribe in My Business → Billing and pick any tier; early renewals extend your access period.</p>
    </div>`),
  );

  // 14 · Get started + contact
  pages.push(
    page(`
    <div class="pad">
      ${eyebrow("Get started")}
      <h2>Why are you joining us? Member, business or government.</h2>
      <p class="lede">Three paths only. B2C is a free personal wallet. B2B then picks private, public or NPO. B2G waits for platform admin approval.</p>
      <div class="grid3 mt paths">
        ${C.paths.map((p) => `<article class="card${p.hl ? " hl" : ""}"><p class="k">${p.k}</p><p class="lt">${p.t}</p><p class="small">${p.b}</p><p class="cta">${site(p.href, p.cta)}</p></article>`).join("")}
      </div>
      <h3 class="mt h3">How billing works</h3>
      <ol class="bill">${C.billingSteps(trial).map((s) => `<li>${s}</li>`).join("")}</ol>
      <div class="card contactcard mt">
        <div>
          <p class="k">Talk to us</p>
          <p class="lt">${esc(FOOTER_TAGLINE)}</p>
          <p class="small">${esc(FOOTER_MOTTO)} For government programmes or bespoke process design, we scope sector, industries, packs and go-live with you.</p>
        </div>
        <dl class="dl">
          <dt>Email</dt><dd>${link(CT.email.href, esc(CT.email.label))}</dd>
          <dt>Phone</dt><dd>${link(CT.phone.href, esc(CT.phone.label))}</dd>
          <dt>WhatsApp</dt><dd>${link(CT.whatsapp.href.split("?")[0], "wa.me/27825814215")}</dd>
          <dt>Web</dt><dd>${link(SITE, "www.supplieradvisor.com")}</dd>
          <dt>Country</dt><dd>${esc(CT.country)}</dd>
        </dl>
      </div>
      <div class="grid3 mt trio">
        ${C.trio.map((t) => `<div class="tv"><p class="lt">${t.t}</p><p class="small">${t.b}</p></div>`).join("")}
      </div>
      <ul class="lnk mt">
        ${C.links.map((l) => `<li>${site(l.p, l.t)}<span>supplieradvisor.com${l.p}</span></li>`).join("")}
      </ul>
    </div>`),
  );

  // 15 · Back cover
  pages.push(
    page(
      `
    <div class="back">
      ${lockup(img, "back-logo")}
      ${eyebrow("The network is open")}
      <h2>The world's most trusted supplier advice starts here.</h2>
      <p class="lede">B2B · B2G · B2C on one verified OS. Join operators who treat verification, ratings, lots and SHEQ as live controls. ${trial} days free.</p>
      <div class="contact">
        <div><p class="k">Email</p><p class="cv">${link(CT.email.href, esc(CT.email.label))}</p></div>
        <div><p class="k">Website</p><p class="cv">${link(SITE, "www.supplieradvisor.com")}</p></div>
      </div>
      <ul class="links">
        <li>${site("/onboarding?lane=b2b", "Start free trial")}<span>supplieradvisor.com/onboarding</span></li>
        <li>${site("/pricing", "Pricing")}<span>supplieradvisor.com/pricing</span></li>
        <li>${site("/demo", "Interactive demo")}<span>supplieradvisor.com/demo</span></li>
        <li>${site("/me", "Free SA Member account")}<span>supplieradvisor.com/me</span></li>
        <li>${link(CT.phone.href, "Call us")}<span>${esc(CT.phone.label)}</span></li>
        <li>${link(CT.whatsapp.href.split("?")[0], "WhatsApp")}<span>wa.me/27825814215</span></li>
      </ul>
    </div>
    <div class="credit">
      <p class="motto">Feed. Educate. Empower.</p>
      <p>${link("https://bigfivegroup.africa/connect", "Big Five Connect")} · the Empower pillar of ${link("https://bigfivegroup.africa", "Big Five Group™")}</p>
      <p class="small">© 2026 SupplierAdvisor®. All rights reserved. Product mocks show sample data. Prices in ZAR as listed on supplieradvisor.com at the time of publication.</p>
    </div>`,
      { dark: true, cls: "backpage", footer: false },
    ),
  );

  return pages.join("\n");
}

// ── Styles ───────────────────────────────────────────────────────────────────
const CSS = (font) => `
@font-face { font-family: "Inter"; src: url("${font("Inter-400")}") format("woff"); font-weight: 400; }
@font-face { font-family: "Inter"; src: url("${font("Inter-500")}") format("woff"); font-weight: 500; }
@font-face { font-family: "Inter"; src: url("${font("Inter-600")}") format("woff"); font-weight: 600; }
@font-face { font-family: "Inter"; src: url("${font("Inter-700")}") format("woff"); font-weight: 700; }
@font-face { font-family: "Inter"; src: url("${font("Inter-800")}") format("woff"); font-weight: 800; }
@font-face { font-family: "Inter Display"; src: url("${font("InterDisplay-800")}") format("woff"); font-weight: 800; }
@font-face { font-family: "Inter Display"; src: url("${font("InterDisplay-900")}") format("woff"); font-weight: 900; }
:root { --ink: #0f172a; --ink2: #334155; --muted: #64748b; --line: #e2e8f0; --brand: #00b4d8; --deep: #0077b6; --navy: #20397b; --night: #0a1630; --soft: #f0f9ff; }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Inter", sans-serif; color: var(--ink); font-size: 9.2pt; line-height: 1.5; font-feature-settings: "cv11", "ss01"; }
a { color: inherit; text-decoration: none; border-bottom: 0.6px solid currentColor; white-space: nowrap; }
.nw { white-space: nowrap; }
h1, h2, h3 { text-wrap: balance; }
p, li, dd { text-wrap: pretty; }
.page { width: 210mm; height: 297mm; position: relative; overflow: hidden; page-break-after: always; background: #fff; }
.page:last-child { page-break-after: auto; }
.band { position: absolute; top: 0; left: 0; right: 0; height: 2.2mm; background: linear-gradient(90deg, var(--navy), var(--deep) 45%, var(--brand) 80%, #53d9f6); z-index: 3; }
.pad { padding: 16mm 17mm 0; }
.foot { position: absolute; left: 17mm; right: 17mm; bottom: 9mm; display: flex; justify-content: space-between; font-size: 7pt; color: var(--muted); border-top: 0.5px solid var(--line); padding-top: 2.5mm; letter-spacing: .02em; }
.foot a { border: 0; }
.foot .pn { font-weight: 700; color: var(--navy); }
.eyebrow { font-size: 7pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--deep); margin-bottom: 3mm; }
h1, h2, .big, .motto, .cv, .price, .price-l b { font-family: "Inter Display", "Inter", sans-serif; }
h1 { font-size: 33pt; line-height: 1.04; letter-spacing: -0.035em; font-weight: 900; }
h2 { font-size: 21pt; line-height: 1.1; letter-spacing: -0.03em; font-weight: 900; max-width: 172mm; }
h3 { font-size: 11pt; line-height: 1.25; letter-spacing: -0.015em; font-weight: 700; }
.h3 { margin-bottom: 2.5mm; }
.mt { margin-top: 6mm; }
.mt-s { margin-top: 2.5mm; }
.lede { font-size: 10.2pt; line-height: 1.5; color: var(--ink2); margin-top: 3.5mm; max-width: 172mm; }
.small { font-size: 7.9pt; line-height: 1.45; color: var(--ink2); }
.body-p { font-size: 8.6pt; line-height: 1.5; color: var(--ink2); margin-top: 2.5mm; }
.note { font-size: 6.9pt; line-height: 1.45; color: var(--muted); margin-top: 2.5mm; }
.k { font-size: 6.6pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 1.4mm; }
.lt { font-weight: 700; font-size: 9.4pt; letter-spacing: -0.01em; line-height: 1.3; margin-bottom: 1mm; }
.tag { font-size: 7.4pt; font-weight: 600; color: var(--deep); margin-bottom: 1.2mm; }
.num { font-size: 7pt; font-weight: 800; color: var(--brand); letter-spacing: .06em; margin-bottom: 1.5mm; }
.card { border: 0.6px solid var(--line); border-radius: 3.5mm; padding: 4.2mm 4.6mm; background: #fff; break-inside: avoid; }
.card.soft { background: var(--soft); border-color: #cdeefa; }
.card.hl { background: var(--night); color: #fff; border-color: var(--night); }
.card.hl .k { color: #7fdcf0; }
.card.hl .small { color: rgba(255,255,255,.8); }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3.6mm; }
.grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3.6mm; margin-top: 5mm; }
.split { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 7mm; margin-top: 6mm; align-items: start; }
.split.even { grid-template-columns: 1fr 1fr; gap: 4mm; }
.photo { border-radius: 3.5mm; overflow: hidden; background: #e2e8f0; }
.photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
.tick { width: 3.1mm; height: 3.1mm; color: var(--brand); flex: none; margin-top: .55mm; }
.ticks { list-style: none; display: grid; gap: 1.6mm; margin-top: 2mm; }
.ticks li { display: flex; gap: 1.8mm; font-size: 8.4pt; line-height: 1.4; }
.ticks.sm li { font-size: 7.8pt; }
.card.hl .tick { color: #53d9f6; }
.flow { display: flex; flex-wrap: wrap; align-items: center; gap: 1.4mm; }
.flow span { border: 0.6px solid #b9e6f4; background: #fff; color: var(--navy); border-radius: 99px; padding: .8mm 2.6mm; font-size: 7.2pt; font-weight: 700; }
.flow i { font-style: normal; color: var(--brand); font-size: 8pt; font-weight: 700; }

/* cover */
.cover { background: var(--night); color: #fff; }
.cover-img { position: absolute; inset: 0 0 auto 0; height: 168mm; background-size: cover; background-position: 40% 50%; }
.cover-fade { position: absolute; left: 0; right: 0; top: 0; height: 172mm; background: linear-gradient(180deg, rgba(10,22,48,.55) 0%, rgba(10,22,48,0) 22%, rgba(10,22,48,0) 55%, var(--night) 99%); }
.lockup { display: flex; align-items: center; gap: 3mm; }
.lockup img { width: 22mm; }
.lockup span { font-weight: 700; font-size: 15pt; letter-spacing: -0.02em; color: #fff; }
.cover-logo { position: absolute; top: 13mm; left: 17mm; z-index: 2; }
.cover-text { position: absolute; left: 17mm; right: 17mm; bottom: 18mm; }
.cover .eyebrow { color: #7fdcf0; }
.cover h1 { font-size: 36pt; }
.cover .lede { color: rgba(255,255,255,.8); font-size: 11.2pt; max-width: 160mm; margin-top: 6mm; }
.cover-chips { display: flex; flex-wrap: wrap; gap: 2.5mm; margin-top: 8mm; }
.cover-chips span { border: 0.6px solid rgba(255,255,255,.28); border-radius: 99px; padding: 1.4mm 3.4mm; font-size: 8pt; color: rgba(255,255,255,.85); }
.cover-chips b { color: #53d9f6; margin-right: 1.2mm; }
.cover-by { margin-top: 9mm; padding-top: 4mm; border-top: 0.6px solid rgba(255,255,255,.18); font-size: 8pt; color: rgba(255,255,255,.7); }

/* 2 */
.verbs .card { padding-top: 3.8mm; }
.verb h3 { margin-bottom: 1.5mm; color: var(--navy); }
.notband { margin-top: 5mm; padding: 3mm 4.6mm; background: var(--soft); border-left: 1.2mm solid var(--brand); border-radius: 1.5mm; font-weight: 700; font-size: 9.6pt; color: var(--navy); }
.statrow { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4mm; margin-top: 5mm; padding-top: 4mm; border-top: 0.6px solid var(--line); }
.big { font-size: 19pt; font-weight: 900; letter-spacing: -0.03em; line-height: 1.1; color: var(--navy); }
.statrow .k { margin-top: 1.2mm; color: var(--ink2); }
.who { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 6mm; margin-top: 6mm; padding-top: 5mm; border-top: 0.6px solid var(--line); }
.motto { font-size: 14pt; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 2.5mm; color: var(--navy); }
.pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
.pill { border: 0.6px solid var(--line); border-radius: 3mm; padding: 3.4mm; }
.pill.us { background: var(--night); color: #fff; border-color: var(--night); }
.pill.us .k { color: #7fdcf0; }
.pill.us .small { color: rgba(255,255,255,.8); }

/* 3 */
.aud { margin-top: 6mm; }
.audcard { padding: 0 0 4.2mm; display: flex; flex-direction: column; }
.audcard > :not(.aud-photo) { margin-left: 4.6mm; margin-right: 4.6mm; }
.aud-photo { height: 66mm; border-radius: 3.5mm 3.5mm 0 0; margin-bottom: 3.5mm; }
.code { font-family: "Inter Display", sans-serif; font-weight: 900; color: var(--brand); font-size: 15pt; letter-spacing: -0.02em; line-height: 1; margin-bottom: 1.2mm; }
.audcard h3 { margin-bottom: 1.5mm; }
.audcard .ticks { margin-bottom: 3mm; }
.cta { margin-top: auto; font-size: 8pt; font-weight: 700; color: var(--deep); }

/* 4 */
.otif-split { grid-template-columns: 1fr 1fr; gap: 7mm; }
.otif { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; margin-top: 2mm; }
.otif div { background: var(--night); color: #fff; border-radius: 3mm; padding: 4.5mm 4mm; }
.otif b { display: block; font-family: "Inter Display", sans-serif; font-size: 24pt; font-weight: 900; color: #53d9f6; line-height: 1; }
.otif span { font-size: 8pt; font-weight: 600; }
.shot { border: 0.6px solid #cbd5e1; border-radius: 3mm; overflow: hidden; background: #fff; box-shadow: 0 6px 18px -10px rgba(15,23,42,.35); }
.shot-bar { display: flex; align-items: center; gap: 1.2mm; padding: 1.8mm 3mm; background: #f1f5f9; border-bottom: 0.6px solid #e2e8f0; }
.shot-bar i { width: 1.8mm; height: 1.8mm; border-radius: 50%; background: #cbd5e1; display: inline-block; }
.shot-bar span { margin-left: 2mm; font-size: 6.4pt; color: var(--muted); }
.shot-body { padding: 3.2mm 3.6mm 3.6mm; }
.m-k { font-size: 6.4pt; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--deep); margin-bottom: 2mm; }
.m-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; margin-bottom: 2.4mm; }
.m-kpis div { background: var(--soft); border-radius: 2mm; padding: 2mm 2.4mm; }
.m-kpis b { display: block; font-family: "Inter Display", sans-serif; font-weight: 900; font-size: 14pt; color: var(--navy); line-height: 1.05; }
.m-kpis span { font-size: 6.4pt; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
.m-row { display: flex; gap: 2mm; align-items: baseline; padding: 1.5mm 0; border-top: 0.5px solid var(--line); font-size: 7.8pt; }
.m-row span:not(.m-n) { flex: 1; }
.m-row b { color: var(--navy); }
.m-n { font-size: 6.6pt; font-weight: 800; color: var(--brand); width: 4mm; }
.m-cap { font-size: 6.6pt; color: var(--muted); margin-top: 1.5mm; }
.m-flow { margin-bottom: 1mm; flex-wrap: nowrap; gap: 1mm; }
.m-flow span { font-size: 6.3pt; padding: .7mm 1.7mm; }
.m-flow i { font-size: 6.6pt; }
.steps4 .card { padding: 4.8mm 4.6mm; min-height: 38mm; }
.trustgrid .card { padding: 3.8mm 4.2mm; }
.cipc { display: grid; grid-template-columns: 1fr; gap: 4mm; padding: 5mm 5.5mm; }
.cipc-steps { list-style: none; display: grid; grid-template-columns: repeat(5, 1fr); gap: 4mm; counter-reset: c; }
.cipc-steps li { font-size: 7.2pt; line-height: 1.4; color: var(--ink2); counter-increment: c; }
.cipc-steps li::before { content: counter(c); display: flex; width: 4.6mm; height: 4.6mm; border-radius: 50%; background: var(--brand); color: #fff; font-weight: 800; font-size: 6.6pt; align-items: center; justify-content: center; margin-bottom: 1.2mm; }
.cipc-steps b { display: block; color: var(--ink); font-size: 7.8pt; }

/* 5 */
.row-item { padding: 2.8mm 0; border-top: 0.6px solid var(--line); }
.row-item:first-child { border-top: 0; padding-top: 0; }
.escrow { margin-top: 4mm; }
.steps4 .card { padding: 3.8mm 4.2mm; }

/* 6 */
.modgrid { margin-top: 6mm; }
.mod, .modgrid .hl { padding: 4.4mm 4.4mm; min-height: 44mm; }
.price-l { font-size: 10pt; font-weight: 700; margin-bottom: 2mm; }
.price-l b { display: block; font-size: 22pt; font-weight: 900; color: #53d9f6; letter-spacing: -0.03em; line-height: 1.1; }

/* 7 */
.layers { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.4mm; margin-top: 5.5mm; }
.layer { border: 0.6px solid var(--line); border-radius: 3mm; padding: 3.2mm; }
.layer.on { background: var(--night); color: #fff; border-color: var(--night); }
.layer.on .small { color: rgba(255,255,255,.8); }
.layer .lp { font-family: "Inter Display", sans-serif; font-weight: 900; font-size: 9pt; color: var(--deep); margin-bottom: 1.2mm; letter-spacing: -0.01em; }
.layer.on .lp { color: #53d9f6; }
.layer .small { font-size: 7.2pt; }
.mini { padding: 1.8mm 0; border-top: 0.5px solid var(--line); }
.mini:first-of-type { border-top: 0; }
.mini .lt { font-size: 8.6pt; margin-bottom: .4mm; }
.sc-logo { height: 7.5mm; margin-bottom: 3mm; }

/* 8 */
.grp { margin-top: 7mm; color: var(--deep); }
.indgrid { gap: 3mm; }
.ind { padding: 4mm 4mm; min-height: 31mm; }
.ind .small { font-size: 7.4pt; }

/* 9 */
.b2g-split { grid-template-columns: 0.95fr 1.05fr; gap: 6mm; }
.b2g-photo { height: 60mm; }
.pw { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.dash { list-style: none; display: grid; gap: 1.6mm; margin-top: 2mm; }
.dash li { font-size: 7.8pt; line-height: 1.4; color: var(--ink2); padding-left: 3.2mm; position: relative; }
.dash li::before { content: "–"; position: absolute; left: 0; color: var(--muted); }
.school { background: var(--soft); border-color: #cdeefa; }
.school-head h3 { margin-bottom: 1.5mm; color: var(--navy); }
.roles { margin: 3.5mm 0; }
.role { background: #fff; border-radius: 2.5mm; padding: 3mm 3.4mm; border: 0.6px solid #cdeefa; }
.tiers span { background: var(--night); color: #fff; border-color: var(--night); }
.case-nums { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 1.5mm; }
.case-nums b { display: block; font-family: "Inter Display", sans-serif; font-weight: 900; font-size: 26pt; color: var(--navy); letter-spacing: -0.03em; line-height: 1.1; }
.case-nums span { font-size: 7.8pt; color: var(--ink2); font-weight: 600; }

/* 10 */
.member-split { grid-template-columns: 1fr 0.9fr; gap: 6mm; margin-top: 4mm; }
.lede.first { margin-top: 0; }
.free { margin-top: 5mm; }
.member-photo { height: 74mm; }
.member-photo img { object-position: 30% 30%; }
.feat { gap: 4.6mm 5mm; }
.fi { padding: 3.4mm 0 0; border-top: 0.6px solid var(--line); }
.fi .lt { font-size: 8.8pt; color: var(--navy); }

/* 11 */
.cmp .card { padding: 3.8mm 4.2mm; }
.tools { display: flex; flex-wrap: wrap; gap: 1.6mm; margin-top: 1.5mm; }
.tools span { border: 0.6px solid var(--line); border-radius: 99px; padding: .8mm 2.6mm; font-size: 7.4pt; font-weight: 600; color: var(--ink2); background: #fff; }
.tools.on span { border-color: #b9e6f4; color: var(--navy); }
.tv { padding-top: 2.6mm; border-top: 1.2mm solid var(--brand); }

/* 2 quote */
.pull { margin-top: 10mm; padding: 5mm 6mm; background: var(--soft); border-radius: 3.5mm; border-left: 1.4mm solid var(--brand); }
.pull p { font-family: "Inter Display", sans-serif; font-weight: 800; font-size: 12pt; line-height: 1.35; letter-spacing: -0.015em; color: var(--navy); }
.pull cite { display: block; font-style: normal; font-size: 7.6pt; color: var(--muted); margin-top: 2.5mm; }
/* 4 loop */
.mt-l { margin-top: 9mm; }
.loop { padding: 5mm 5.5mm; }
.loop .small { max-width: 150mm; }
.big-flow { flex-wrap: nowrap; justify-content: space-between; margin-top: 4.5mm; }
.big-flow span { font-size: 9pt; padding: 1.8mm 0; flex: 1; text-align: center; }
.trustgrid .card { padding: 4.6mm 4.8mm; min-height: 27mm; }
/* 8 */
.g4 { margin-top: 0; gap: 3mm; }
/* 11 matrix */
.matrix { width: 100%; border-collapse: collapse; margin-top: 5mm; }
.matrix caption { text-align: left; }
.matrix th, .matrix td { font-size: 7.8pt; padding: 1.2mm 2mm; border-bottom: 0.5px solid var(--line); text-align: center; }
.matrix thead th { font-size: 6.6pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); border-bottom: 0.8px solid #cbd5e1; }
.matrix tbody th { text-align: left; font-weight: 600; color: var(--ink2); width: 42%; }
.matrix td.sa, .matrix thead th:last-child { background: var(--soft); }
.matrix thead th:last-child { color: var(--deep); }
.cm { display: inline-block; width: 3mm; height: 3mm; border-radius: 50%; vertical-align: middle; }
.cm-strong { background: var(--brand); }
.cm-yes { background: var(--navy); }
.cm-partial { background: linear-gradient(90deg, var(--navy) 50%, #dbe3ee 50%); }
.cm-no { background: #e2e8f0; width: 3mm; height: .8mm; border-radius: 1mm; }
.legend { font-size: 7pt; color: var(--muted); margin-top: 2mm; display: flex; gap: 1.5mm 3mm; align-items: center; flex-wrap: wrap; }
.legend .cm { margin-right: -1.6mm; }
.stack { margin-top: 4mm; }
/* 13 */
.tiers4 { gap: 3mm; }
.tier { padding: 3.8mm 4mm; display: flex; flex-direction: column; position: relative; }
.badge { position: absolute; top: 3.2mm; right: 3.4mm; font-size: 6.2pt; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; background: var(--brand); color: #fff; border-radius: 99px; padding: .6mm 2mm; }
.badge.alt { background: var(--navy); }
.per { font-size: 7.4pt; font-weight: 600; color: var(--muted); margin-bottom: 1.6mm; }
.example { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; align-items: center; }
.ex { width: 100%; border-collapse: collapse; }
.ex th, .ex td { font-size: 7.8pt; padding: 1.3mm 0; border-bottom: 0.5px solid var(--line); text-align: left; }
.ex th { font-size: 6.6pt; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.ex td:last-child, .ex th:last-child { text-align: right; font-weight: 700; color: var(--navy); }
.ex .tot td { font-weight: 700; border-bottom: 0; }
.tier.pop { border: 1.2px solid var(--brand); }
.price { font-size: 20pt; font-weight: 900; color: var(--navy); letter-spacing: -0.03em; line-height: 1.1; margin: 1.5mm 0 .6mm; }
.price span { font-family: "Inter", sans-serif; font-size: 7.6pt; font-weight: 600; color: var(--muted); letter-spacing: 0; margin-left: .8mm; }
.eff { font-size: 7.8pt; font-weight: 700; color: #047857; margin-top: 1.4mm; }
.tier-foot { margin-top: auto; padding-top: 2mm; font-size: 7.2pt; color: var(--muted); }
.pricing-split { grid-template-columns: 1fr 1fr; gap: 4mm; }
.addons { width: 100%; border-collapse: collapse; }
.addons caption { text-align: left; }
.addons th, .addons td { text-align: left; font-size: 8pt; padding: 2.1mm 0; border-bottom: 0.6px solid var(--line); vertical-align: top; }
.addons th { font-weight: 600; color: var(--ink2); padding-right: 3mm; }
.addons td { font-weight: 700; color: var(--navy); text-align: right; }

/* 14 */
.paths .card { display: flex; flex-direction: column; }
.paths .card .small { margin-bottom: 3mm; }
.card.hl .cta { color: #53d9f6; }
.bill { list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3.6mm; counter-reset: b; }
.bill li { font-size: 8pt; line-height: 1.45; color: var(--ink2); padding-left: 7mm; position: relative; counter-increment: b; }
.bill li::before { content: counter(b); position: absolute; left: 0; top: 0; width: 5mm; height: 5mm; border-radius: 50%; background: var(--navy); color: #fff; font-size: 7pt; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.contactcard { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.dl { display: grid; grid-template-columns: 18mm 1fr; gap: 1.6mm 3mm; font-size: 8.4pt; }
.dl dt { color: var(--muted); font-weight: 600; font-size: 7.4pt; padding-top: .3mm; }
.dl dd { font-weight: 600; }
.lnk { list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 6mm; }
.lnk li { padding: 2.2mm 0; border-bottom: 0.6px solid var(--line); font-size: 8.4pt; font-weight: 700; display: flex; flex-direction: column; }
.lnk a { border: 0; color: var(--navy); }
.lnk span { font-size: 7pt; font-weight: 400; color: var(--muted); }

/* 15 */
.backpage { background: var(--night); color: #fff; }
.back { padding: 24mm 17mm 0; }
.back-logo { margin-bottom: 16mm; }
.back-logo img { width: 26mm; }
.back-logo span { font-size: 17pt; }
.back .eyebrow { color: #7fdcf0; }
.back h2 { font-size: 27pt; max-width: 160mm; }
.back .lede { color: rgba(255,255,255,.75); }
.contact { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-top: 12mm; padding: 6mm 0; border-top: 0.6px solid rgba(255,255,255,.18); border-bottom: 0.6px solid rgba(255,255,255,.18); }
.back .k { color: rgba(255,255,255,.55); }
.cv { font-size: 16pt; font-weight: 800; letter-spacing: -0.02em; }
.cv a { border-bottom-color: rgba(83,217,246,.6); }
.links { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 0 8mm; margin-top: 8mm; }
.links li { padding: 2.4mm 0; border-bottom: 0.6px solid rgba(255,255,255,.1); font-size: 9pt; font-weight: 700; display: flex; flex-direction: column; }
.links a { border: 0; }
.links span { font-size: 7.4pt; font-weight: 400; color: rgba(255,255,255,.55); }
.credit { position: absolute; left: 17mm; right: 17mm; bottom: 16mm; }
.credit .motto { font-size: 13pt; margin-bottom: 2mm; color: #fff; }
.credit p { color: rgba(255,255,255,.78); font-size: 9pt; }
.credit a { border-bottom-color: rgba(255,255,255,.4); }
.credit .small { color: rgba(255,255,255,.5); font-size: 7.2pt; margin-top: 3mm; }
`;

async function main() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sa-profile-"));
  const L = await loadLib(
    {
      billing: "lib/billing/company-subscription",
      packaging: "lib/product/packaging-constants",
      referral: "lib/billing/referral-rates",
      footer: "lib/marketing/site-footer",
      industries: "lib/marketing/industries",
    },
    tmp,
  );
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const img = await prepImages(browser);
  const cmpRows = await loadCompare(L.billing);
  // Static Inter instances (cut from the variable font): Chromium embeds these
  // as TrueType, where a variable font would become Type 3.
  const font = (name) => pathToFileURL(path.join(here, "fonts", `${name}.woff`)).href;
  const html = `<!doctype html><html lang="en-ZA"><head><meta charset="utf-8">
<title>${esc(META.title)}</title><meta name="author" content="${esc(META.author)}"><meta name="description" content="${esc(META.subject)}">
<style>${CSS(font)}</style></head><body>${brand(build(L, img, cmpRows))}</body></html>`;
  const htmlFile = path.join(tmp, "profile.html");
  await fs.writeFile(htmlFile, html);
  if (outHtml) await fs.writeFile(path.resolve(outHtml), html);

  const pg = await browser.newPage();
  await pg.goto(pathToFileURL(htmlFile).href, { waitUntil: "load" });
  await pg.evaluate(() => document.fonts.ready);
  const overflow = await pg.evaluate(() =>
    [...document.querySelectorAll(".page")].flatMap((p, i) => {
      const box = p.getBoundingClientRect();
      const foot = p.querySelector(".foot")?.getBoundingClientRect().top ?? box.bottom;
      const worst = Math.max(...[...p.querySelectorAll(".pad > *, .back > *")].map((e) => e.getBoundingClientRect().bottom));
      return worst > foot - 2 ? [`page ${i + 1}: content ends ${Math.round(worst - foot + 2)}px into the footer`] : [];
    }),
  );
  if (overflow.length) console.warn(`Layout warning:\n  ${overflow.join("\n  ")}`);
  const pdf = await pg.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, tagged: true, outline: true });
  await browser.close();
  await fs.mkdir(path.dirname(outPdf), { recursive: true });
  const out = setInfo(pdf, META);
  await fs.writeFile(outPdf, out);
  await fs.rm(tmp, { recursive: true, force: true });
  console.log(`Wrote ${path.relative(process.cwd(), outPdf)} · ${pageNo} pages · ${(out.length / 1024).toFixed(0)} KB`);
}

/**
 * Chromium sets only /Title. Append an incremental update that rewrites the
 * Info dictionary (title, author, subject, keywords) and asks viewers to show
 * the title instead of the file name. Classic xref table (Skia/PDF 1.4).
 */
function setInfo(buf, meta) {
  const text = buf.toString("latin1");
  const trailer = text.slice(text.lastIndexOf("trailer"));
  const prev = Number(text.slice(text.lastIndexOf("startxref") + 9).trim().split(/\s/)[0]);
  const size = Number(/\/Size\s+(\d+)/.exec(trailer)[1]);
  const rootRef = /\/Root\s+(\d+)\s+0\s+R/.exec(trailer)[1];
  const infoRef = /\/Info\s+(\d+)\s+0\s+R/.exec(trailer)?.[1];
  const u16 = (s) => "<FEFF" + Buffer.from(s, "utf16le").swap16().toString("hex").toUpperCase() + ">";
  const rootBody = new RegExp(`(?:^|\\n)${rootRef} 0 obj\\s*<<([\\s\\S]*?)>>\\s*endobj`).exec(text)[1];
  const created = /\/CreationDate\s*(\([^)]*\))/.exec(text)?.[1] ?? "";
  const infoNum = infoRef ? Number(infoRef) : size;
  const objs = [
    [Number(rootRef), `<<${rootBody.replace(/\/ViewerPreferences\s*<<[^>]*>>/, "")} /ViewerPreferences << /DisplayDocTitle true >> >>`],
    [infoNum, `<< /Title ${u16(meta.title)} /Author ${u16(meta.author)} /Subject ${u16(meta.subject)} /Keywords ${u16(meta.keywords)} /Creator (scripts/company-profile/build.mjs) /Producer (Chromium Skia/PDF)${created ? ` /CreationDate ${created}` : ""} >>`],
  ].sort((a, b) => a[0] - b[0]);
  let out = text.endsWith("\n") ? "" : "\n";
  let offset = buf.length + out.length;
  const offsets = [];
  for (const [num, body] of objs) {
    const s = `${num} 0 obj\n${body}\nendobj\n`;
    offsets.push([num, offset]);
    out += s;
    offset += Buffer.byteLength(s, "latin1");
  }
  const xrefPos = offset;
  out += "xref\n";
  for (const [num, off] of offsets) out += `${num} 1\n${String(off).padStart(10, "0")} 00000 n \n`;
  const newSize = Math.max(size, infoNum + 1);
  out += `trailer\n<< /Size ${newSize} /Root ${rootRef} 0 R /Info ${infoNum} 0 R /Prev ${prev} >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.concat([buf, Buffer.from(out, "latin1")]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
