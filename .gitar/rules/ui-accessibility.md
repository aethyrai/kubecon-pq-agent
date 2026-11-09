---
title: New UI component accessibility
description: Every new UI component needs an ARIA label, a keyboard path, and a contrast check
type: check
when: PRs that add or modify React components or pages under apps/web/
actions: Verify ARIA labels, keyboard operability, and contrast; request changes if any is missing
---

`apps/web/` serves three modes: full, low-bandwidth text, and screen-reader optimized. For every new or
changed component or page:

- Every interactive control has an accessible name (visible label, `aria-label`, or `aria-labelledby`).
- Every page has exactly one `h1`, landmark regions (`main`, `nav`, `header`), and a focus order that runs
  top to bottom without a trap.
- Every control is reachable and operable with the keyboard alone.
- Text and its background meet WCAG 2.2 AA contrast (4.5:1 for body text, 3:1 for large text).
- Images that carry meaning have alt text; decorative images have `alt=""`.
- The text mode works with client-side JavaScript disabled except the data fetch.
- Request changes and name the component if any item is missing.
