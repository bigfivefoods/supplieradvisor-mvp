# SupplierAdvisor® company profile (A4 PDF)

Builds `public/supplieradvisor-company-profile.pdf`, linked as
"Download company profile (PDF)" from `/pricing` and `/industries` (never from `/`).

```bash
npx playwright install chromium   # once, or set CHROME_PATH to a local Chrome
npm run profile:pdf               # → public/supplieradvisor-company-profile.pdf
node scripts/company-profile/build.mjs --out /tmp/profile.pdf --html /tmp/profile.html
npx --yes tsx lib/marketing/company-profile.test.ts   # exists, < 5 MB, linked
```

- **Facts stay in sync with the app.** Prices, tier savings, trial length, Industry
  pack price, referral rates, contact details, the B2G industry copy and the
  compare matrix are read from `lib/billing`, `lib/product`, `lib/marketing` and
  `components/marketing/ComparePlatforms.tsx` at build time. Rebuild after a
  pricing change.
- **Copy** lives in `content.mjs`; each block is tagged with its source (home
  sections, /pricing, /verification-sla, /join, /me, /privacy, the Big Five Group
  update, and the Big Five Group company profile for the KZN case-study scope).
- **Brand:** "SupplierAdvisor®" and "SchoolAdvisor®" get ® automatically in text,
  never in URLs, emails or domains. Product mocks are labelled as sample data.
- **Output:** A4, tagged PDF with bookmarks, clickable links, document metadata and
  embedded Inter (static weights, SIL OFL, `fonts/OFL.txt`). Images come from
  `public/marketing` and `public/sa-logo.png`, cropped in the browser.
- **QA:** `pdftoppm -r 110 -png public/supplieradvisor-company-profile.pdf /tmp/p`
  and check every page; the build also warns if a page overflows into the footer.
