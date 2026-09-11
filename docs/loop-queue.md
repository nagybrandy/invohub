// docs/loop-queue.md
# InvoHub continuous completion loop queue

Base branch: `main`. Complete items in order unless a later tick explicitly re-prioritizes.

## Tick 1 — Marketing, content, SEO

- [x] 1. Landing visual + conversion polish (navy `#111f4a` + cornflower `#6495ed`; no green branding)
- [x] 2. Blog system with routes + 3–5 high-quality Hungarian articles (accurate topics; planned features clearly labeled)
- [x] 3. Technical SEO: sitemap, robots.txt, per-page title/description/OG, canonical URLs, JSON-LD, semantic headings, landing↔blog internal links

## Later ticks (do not start in Tick 1)

- [ ] 4. Dashboard & invoice polish (see `docs/tdd-phases.md` Phase A)
  - [x] Dashboard overdue vs outstanding + VAT from line items
  - [x] Saved invoice PDF preview via credentialed blob URL
  - [x] New invoice: client picker, company bank prefill, email/NAV on send, notes meta
  - [ ] Invoice list filters + create→preview→PDF E2E happy path
- [ ] 5. Bank matching (planned only until Phase B)
- [ ] 6. EV tax calculator (planned only until Phase C)
- [ ] 7. M2M submission hardening (roadmap Phase 4)
