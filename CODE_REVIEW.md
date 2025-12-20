# Live-Morph Code Review

**Date:** 2025-12-20
**Reviewer:** strict-code-reviewer agent
**Status:** In Progress

---

## Completed ✅

### 1. @import Stylesheet Handling
**Status:** ✅ Fixed

Added `collectImportedStylesheets()` and `reattachImportedRule()` with WebKit workaround.

### 2. __LiveReload_pendingRemoval Flag
**Status:** ✅ Fixed

Added flag to prevent race conditions on rapid CSS reloads.

### 3. Additional Wait Time After Load
**Status:** ✅ Fixed

Added browser-specific wait (5ms WebKit, 200ms others) before removing old stylesheet.

### 4. CSS Map File Support
**Status:** ✅ Fixed

Changed regex to `/\.css(?:\.map)?$/i`.

### 5. morphCSS Dead Code
**Status:** ✅ Fixed

Removed unused `morphCSS` option.

### 7. StyleFix/Prefixfree Support
**Status:** ✅ Fixed

Added `linkHref()` helper and prefixfree detection.

### 8. reloadMissingCSS Fallback
**Status:** ✅ Fixed

Added option support, reloads all stylesheets when no match found.

### 13. Timer Parameter
**Status:** ✅ Now Used

Timer is used for @import workaround delays.

### 20. CORS Error Handling
**Status:** ✅ Fixed

Added try/catch in `collectImportedStylesheets()` and `reattachImportedRule()`.

---

## Remaining Issues

### 6. Image Reload Support
**Status:** ✅ Documented

README now says "Everything else (.js, images, etc.) → Full page reload".

### 11. overrideURL Option
**Status:** 🟢 Skip

Proxy setups are edge case. Document if users request it.

### 12. waitForStylesheetLoad Timeout
**Status:** 🟢 Won't fix

Timeout silently resolves. This is fine - we proceed with the swap regardless, and logging would just add noise.

### 15. Expanded State Preservation
**Status:** 🟢 Add as needed

Could preserve `<audio>`/`<video>` currentTime, `<dialog>` open state. Add when users report issues.

### 16. DOCTYPE Stripping
**Status:** 🟢 OK for now

Modern HTML uses `<!DOCTYPE html>` which works fine. Legacy XHTML edge case.

### 17. Hardcoded Script Preservation
**Status:** ✅ Fixed

Renamed build output to `dist/live-morph.js`. Filter now only matches `live-morph` in script src.

---

## Not Needed

- **Issue #9:** Plugin system (intentionally omitted)
- **Issue #10:** Chrome extension reload (confirmed not needed)
- **Issue #19:** Async/await pattern (already correct)
- **Issue #22:** Return value contract (no plugin system)
