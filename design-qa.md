# TASK-027 Design QA

- Source visual truth: `docs/quality/evidence/task027/option-1-reference.png`
- Normalized source: `docs/quality/evidence/task027/option-1-reference-normalized.png`
- Primary implementation screenshot: `docs/quality/evidence/task027/home-426-light.png`
- Normalized implementation: `docs/quality/evidence/task027/home-426-light-normalized.png`
- Additional evidence: `docs/quality/evidence/task027/home-375-dark.png`, `docs/quality/evidence/task027/account-375-light.png`, `docs/quality/evidence/task027/account-375-dark.png`
- Source pixels: 853 × 1844
- Implementation pixels: 426 × 927 at 426 × 927 CSS px and device scale factor 1
- Density normalization: the source was downsampled to 426 × 922; the implementation was cropped by 5 px at the bottom to the same 426 × 922 comparison frame.
- State: personal ledger, August 2026, light theme, populated monthly summary, two attention items, three recent entries.

## Browser evidence

`pnpm qa:task027` rendered `/home` and `/account` in Chrome at 320, 375, 426 and 480 px in light theme, plus 375 px in dark theme. All ten captures had five bottom-navigation items, the correct active destination, no horizontal overflow and no interactive target below 44 px. The amount-visibility control was clicked in the rendered home page and persisted `siyu-amount-hidden=true`. No console exception or failed intercepted request remained.

The browser run used controlled local API fixtures. It proves rendering and interaction behavior, not production API or public-domain availability.

## Full-view comparison

The final normalized source and implementation were opened together at 426 × 922. The implementation preserves the source hierarchy and rhythm: greeting and ledger context, prominent blue monthly summary, grouped attention card, grouped recent-entry card, and fixed five-item bottom navigation. Major region proportions, card widths, primary amount hierarchy and above-the-fold content align without clipping or overlap.

## Focused-region comparison

A separate crop was not required because the normalized 426 px comparison kept header type, hero amount, generated receipt illustration, attention icons, recent-entry icons and bottom navigation legible at native size. These regions were inspected directly in the combined full-view comparison.

## Required fidelity surfaces

- Fonts and typography: both use a Chinese system sans-serif hierarchy with close weights and line heights. The implementation keeps stronger numeric emphasis and avoids wrapping in all tested widths.
- Spacing and layout rhythm: 16 px page margins, rounded summary/card surfaces, section spacing and fixed navigation follow the source. The 320 px layout deliberately stacks context controls to prevent crowding.
- Colors and tokens: the implementation uses the approved primary, surface, income, expense and dark-theme tokens. The source's slight blue tonal variation is represented by the stable primary token rather than an ad hoc gradient; contrast remains compliant and visually equivalent.
- Image quality and asset fidelity: the receipt-and-yuan illustration is a generated 1254 px RGBA asset with transparent corners, rendered at 104 CSS px. Category and navigation symbols use the existing Ant Design icon library; no emoji, text glyph, CSS drawing or placeholder substitutes remain in the compared regions.
- Copy and content: app-specific labels remain coherent. `个人借贷` and `查看消息` are intentional product terms tied to actual privacy and routes. The decorative leaf emoji from the concept was intentionally omitted.
- Accessibility and responsiveness: 320/375/426/480 px, light/dark, 44 px targets, no horizontal overflow, amount privacy, active navigation and long-page scrolling were checked.

## Comparison history

1. Initial browser pass found two P2 accessibility mismatches: the native month input exposed a 42 px hit area and the Ant switch exposed a 22 px hit area. The month control and switch geometry were enlarged; the next browser matrix reported no undersized target.
2. Initial visual comparison found a P2 asset/content mismatch: recent entries used Chinese text glyphs and category-first copy instead of real icons and transaction-first context. Ant Design category icons plus the home-summary note/date/category hierarchy were implemented. The next capture showed real food, salary and shopping icons with source-aligned copy.
3. The second visual comparison found a P2 surface mismatch: attention and recent section headings sat outside their cards. Each heading and list was moved into one grouped surface. The final normalized comparison shows the source-aligned grouped-card structure.
4. Final comparison found no actionable P0, P1 or P2 mismatch. Remaining differences are intentional responsive/product-token choices or P3-level optical variation.

## Findings

No actionable P0, P1 or P2 findings remain.

## Follow-up polish

- P3: the reference uses a slightly lighter section-heading weight; the implementation retains the repository's established text token and weight for consistency with the rest of the app.

## Implementation checklist

- [x] Source and implementation opened in one normalized comparison input.
- [x] Earlier P2 findings fixed and recaptured.
- [x] Mobile width, theme, overflow and tap-target matrix passed.
- [x] Primary privacy interaction passed in browser.
- [x] Console and intercepted-request errors checked.

final result: passed
