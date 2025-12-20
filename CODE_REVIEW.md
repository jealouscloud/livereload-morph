# Live-Morph Code Review

**Date:** 2025-12-20
**Reviewer:** strict-code-reviewer agent
**Verdict:** REJECTED (needs significant improvements)

## Summary

This is a livereload-js replacement using idiomorph for DOM morphing. The review compared our implementation against the original livereload-js codebase and found critical gaps in CSS reload functionality and missing features that users may expect.

---

## Critical Issues

### 1. MISSING: @import Stylesheet Handling
**File:** `src/morpher.js:113-165`
**Status:** 🔴 Not Implemented

**Issue:**
The original livereload-js has comprehensive `@import` handling at reloader.js:333-344, 388-413 (`collectImportedStylesheets`) plus `reattachImportedRule` at lines 515-565. Our implementation only looks at `<link>` elements.

```javascript
// Our code only handles <link> elements:
const links = Array.from(this.document.getElementsByTagName('link'))
  .filter(link => link.rel && link.rel.match(/^stylesheet$/i));
```

**Impact:**
CSS loaded via `@import` rules will NOT be reloaded. Users with modular CSS architectures will experience broken live reload.

**Fix Required:**
Implement `collectImportedStylesheets()` and `reattachImportedRule()` from original.

---

### 2. MISSING: __LiveReload_pendingRemoval Flag
**File:** `src/morpher.js:126-128`
**Status:** 🔴 Not Implemented

**Issue:**
The original at line 325 explicitly filters out stylesheets pending removal:
```javascript
if (link.rel.match(/^stylesheet$/i) && !link.__LiveReload_pendingRemoval) {
  result.push(link);
}
```

We don't set or check this flag.

**Impact:**
Rapid consecutive CSS changes can cause race conditions where the same stylesheet is cloned multiple times before the original is removed, leading to style conflicts and memory leaks.

**Fix Required:**
Set `link.__LiveReload_pendingRemoval = true` before cloning, check flag when collecting links.

---

### 3. MISSING: Additional Wait Time After Load
**File:** `src/morpher.js:154`
**Status:** 🔴 Not Implemented

**Issue:**
The original at lines 494-511 adds browser-specific wait times after stylesheet load:
```javascript
if (/AppleWebKit/.test(this.window.navigator.userAgent)) {
  additionalWaitingTime = 5;
} else {
  additionalWaitingTime = 200;
}
```

We remove the old stylesheet immediately after `waitForStylesheetLoad()`.

**Impact:**
Flash of unstyled content (FOUC) in non-WebKit browsers where the browser needs time to apply styles after `sheet` property becomes available.

**Fix Required:**
Add 5ms wait for WebKit, 200ms for others before removing old stylesheet.

---

### 4. MISSING: CSS Map File Support
**File:** `src/morpher.js:19`
**Status:** 🔴 Not Implemented

**Issue:**
The original handles `.css.map` files:
```javascript
if (options.liveCSS && path.match(/\.css(?:\.map)?$/i)) {
```

We only match `.css`:
```javascript
const isCSSFile = path.match(/\.css$/i);
```

**Impact:**
Changes to CSS source maps trigger full page reloads instead of CSS hot-reload when using preprocessors.

**Fix Required:**
Change regex to `/\.css(?:\.map)?$/i`

---

### 5. INCONSISTENT: morphCSS Option Defined But Never Used
**File:** `src/morpher.js:23`, `src/live-morph.js:138`, `src/options.js:19`
**Status:** 🔴 Dead Code

**Issue:**
The `morphCSS` option is defined and passed around but never actually checked in `morpher.reload()`:
```javascript
// options.js line 19:
this.morphCSS = true;

// live-morph.js line 138:
morphCSS: this.options.morphCSS

// morpher.js - only checks liveCSS, never morphCSS:
if (isCSSFile && options.liveCSS) {
  return this.reloadStylesheet(path, options);
}
```

**Impact:**
Configuration confusion. The option exists but does nothing.

**Fix Required:**
Either remove `morphCSS` option entirely or rename `liveCSS` to `morphCSS` for consistency with `morphHTML`.

---

### 6. MISSING: Image Reload Support
**File:** `src/morpher.js:17-34`
**Status:** 🟡 Intentionally Omitted (document)

**Issue:**
The original at lines 179-182 and 240-312 has comprehensive image reloading. We set `liveImg` but never use it:
```javascript
liveImg: message.liveImg != null ? message.liveImg : true,  // Set but unused
```

**Impact:**
Image changes trigger full page reloads. This is a significant regression from livereload-js behavior.

**Fix Required:**
Either implement image reloading OR explicitly document in README that image reload is not supported (recommend full page reload for images).

---

## Missing Features (User Expectations)

### 7. MISSING: StyleFix/Prefixfree Support
**File:** `src/morpher.js:126-131`
**Status:** 🟡 Intentionally Omitted (document)

**Issue:**
The original handles prefixfree's transformation of `<link>` to `<style data-href>` at lines 347-351 and 457-459.

**Impact:**
Users with prefixfree will have broken CSS reload.

**Fix Required:**
Document that prefixfree is not supported, or implement `linkHref()` helper that checks both `href` and `data-href`.

---

### 8. MISSING: reloadMissingCSS Fallback
**File:** `src/morpher.js:133-136`
**Status:** 🟡 Consider Adding

**Issue:**
The original at lines 370-382 can reload ALL stylesheets when no match is found if `options.reloadMissingCSS` is true.

We silently do nothing:
```javascript
if (!match) {
  this.console.log(`No matching stylesheet found for ${path}`);
  return;  // Silent failure
}
```

**Impact:**
CSS changes to files with non-matching paths (common in build systems) will silently fail to reload.

**Fix Required:**
Add `reloadMissingCSS` option (default false). When true, reload all stylesheets if no match found.

---

### 9. MISSING: Plugin System
**File:** N/A
**Status:** 🟢 Intentionally Omitted (OK)

**Issue:**
The original has a plugin system. We have none.

**Impact:**
Users relying on livereload plugins will have no migration path.

**Fix Required:**
Document in README that plugins are not supported. This is acceptable for a simplified replacement.

---

### 10. MISSING: Chrome Extension Reload
**File:** N/A
**Status:** 🟢 Intentionally Omitted (User confirmed)

**Issue:**
The original handles Chrome extension reloading. We don't.

**Impact:**
Chrome extension developers cannot use live-morph.

**Fix Required:**
None - user confirmed they don't care about this.

---

### 11. MISSING: overrideURL Option
**File:** N/A
**Status:** 🟡 Consider Adding

**Issue:**
The original at lines 582-589 supports URL overriding for proxy setups.

**Impact:**
Users behind development proxies cannot use live-morph.

**Fix Required:**
Document limitation OR add `overrideURL` support if proxy use cases are common.

---

## Code Quality Issues

### 12. SILENT FAILURE: waitForStylesheetLoad Never Rejects
**File:** `src/utils.js:104-142`
**Status:** 🟡 Needs Fix

**Issue:**
```javascript
export function waitForStylesheetLoad(linkElement, timeout = 15000) {
  return new Promise((resolve) => {  // Never rejects
    // ...
    if (Date.now() - startTime > timeout) {
      finish();  // Resolves on timeout - no error indication
    }
  });
}
```

**Impact:**
Callers cannot distinguish between successful load and timeout failure. Debugging CSS reload issues becomes difficult.

**Fix Required:**
Either reject on timeout OR return `{ loaded: true/false, timedOut: true/false }`.

---

### 13. DEAD CODE: Timer Parameter Never Used
**File:** `src/morpher.js:10, 13`
**Status:** 🟡 Cleanup

**Issue:**
```javascript
constructor(window, console, Timer) {
  this.window = window;
  this.console = console;
  this.Timer = Timer;  // Set but never used anywhere in class
```

**Impact:**
Misleading API suggests Timer is needed when it is not. Leftover from livereload-js architecture.

**Fix Required:**
Remove `Timer` parameter from Morpher constructor.

---

### 14. MISLEADING PARAMETER: morphCSS and liveImg in options
**File:** `src/live-morph.js:135-139`
**Status:** 🔴 See Issue #5 and #6

**Issue:**
```javascript
const options = {
  liveCSS: message.liveCSS != null ? message.liveCSS : true,
  liveImg: message.liveImg != null ? message.liveImg : true,  // Passed but never read
  morphHTML: this.options.morphHTML,
  morphCSS: this.options.morphCSS  // Passed but never read
};
```

**Impact:**
Dead code, configuration confusion.

**Fix Required:**
Related to issues #5 and #6 above.

---

### 15. INCOMPLETE STATE PRESERVATION
**File:** `src/morpher.js:83-96`
**Status:** 🟡 Consider Expanding

**Issue:**
The `beforeAttributeUpdated` callback only handles INPUT, TEXTAREA, SELECT, and DETAILS:
```javascript
if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') {
  if (attributeName === 'value' || attributeName === 'checked') {
    return false;
  }
}
```

**Missing preservation for:**
- `<audio>` / `<video>`: `currentTime`, `paused`, `volume`, `muted`
- `<select>`: `selectedIndex` (different from `value` for multi-select)
- `contenteditable` elements: selection state
- `<dialog>`: `open` attribute
- Focus state: which element has focus
- Scroll positions within elements

**Impact:**
Advanced UI states won't survive morphing.

**Fix Required:**
Add cases for media elements, dialog, and document as edge cases are discovered. May not need all upfront.

---

### 16. BRITTLE DOCTYPE STRIPPING
**File:** `src/morpher.js:52`
**Status:** 🟡 Verify Safety

**Issue:**
```javascript
html = html.replace(/<!DOCTYPE[^>]*>/i, '').trim();
```

This regex is fragile. DOCTYPEs can contain complex DTD declarations with `>` characters inside quotes:
```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
```

**Impact:**
Could fail on legacy XHTML doctypes.

**Fix Required:**
Test with various DOCTYPE formats. Modern HTML uses `<!DOCTYPE html>` which is safe. Document limitation if needed.

---

### 17. HARDCODED SCRIPT PRESERVATION
**File:** `src/morpher.js:60-65`
**Status:** 🟡 Consider Making Configurable

**Issue:**
```javascript
if (elt.tagName === 'SCRIPT' && elt.src) {
  const src = elt.src.toLowerCase();
  return src.includes('live-morph') ||
         src.includes('livereload') ||
         src.includes('dist/index.js');  // Arbitrary hardcoded path
}
```

**Impact:**
`'dist/index.js'` is overly broad and could match unrelated scripts.

**Fix Required:**
Make more specific (match full path) or make configurable via options.

---

### 18. NO ERROR HANDLING FOR linkHref
**File:** `src/morpher.js:131`
**Status:** 🟡 Related to Issue #7

**Issue:**
We directly access `link.href`:
```javascript
const match = pickBestMatch(path, links, link => pathFromUrl(link.href));
```

The original handles prefixfree's `data-href` attribute:
```javascript
linkHref (link) {
  return link.href || (link.getAttribute && link.getAttribute('data-href'));
}
```

**Impact:**
Would fail on prefixfree-transformed elements.

**Fix Required:**
Related to prefixfree support (Issue #7).

---

### 19. ASYNC/AWAIT INCONSISTENCY
**File:** `src/morpher.js:24, 28`
**Status:** 🟢 Actually OK

**Issue:**
```javascript
if (isCSSFile && options.liveCSS) {
  return this.reloadStylesheet(path, options);  // Returns Promise, not awaited
}
```

**Impact:**
The reviewer flagged this, but it's actually fine since `reload()` returns the Promise to the caller. The caller doesn't need the result.

**Fix Required:**
None - this is correct behavior.

---

### 20. MISSING CORS ERROR HANDLING
**File:** `src/utils.js:127`
**Status:** 🟡 Add Try/Catch

**Issue:**
We check `linkElement.sheet` but don't account for CORS restrictions where accessing `sheet.cssRules` would throw:
```javascript
if (linkElement.sheet) {
  finish();
  return;
}
```

**Impact:**
Could throw errors on cross-origin stylesheets.

**Fix Required:**
Wrap in try/catch:
```javascript
try {
  if (linkElement.sheet && linkElement.sheet.cssRules) {
    finish();
    return;
  }
} catch (e) {
  // CORS error - assume loaded
  finish();
  return;
}
```

---

## Tensions with Original Design

### 21. Protocol Message Handling Mismatch
**File:** `src/morpher.js:17-34`
**Status:** 🟡 Verify Intent

**Issue:**
We make decisions based on file extension. The original makes decisions based on protocol message options:
```javascript
// Our code - extension-based:
const isCSSFile = path.match(/\.css$/i);
if (isCSSFile && options.liveCSS) { ... }

// Original - option-based with extension fallback:
if (options.liveCSS && path.match(/\.css(?:\.map)?$/i)) { ... }
```

**Impact:**
The server sends `liveCSS: true` or `false` explicitly. Our extension check could conflict with server intent.

**Fix Required:**
Review whether extension check is needed or if we should trust protocol options.

---

### 22. Return Value Contract
**File:** `src/morpher.js:113-165`
**Status:** 🟢 OK (Doesn't Matter)

**Issue:**
The original returns `true` to indicate it handled the reload. We return nothing (undefined).

**Impact:**
The reviewer flagged this but it doesn't matter since we don't have a plugin system checking return values.

**Fix Required:**
None needed.

---

## Priority Ranking

### 🔴 Critical (Must Fix)
1. Issue #2: Add `__LiveReload_pendingRemoval` flag (prevents race conditions)
2. Issue #3: Add post-load wait time (prevents FOUC)
3. Issue #4: Support `.css.map` files
4. Issue #5: Remove or fix `morphCSS` option

### 🟡 Important (Should Fix)
5. Issue #1: Implement `@import` handling
6. Issue #8: Add `reloadMissingCSS` fallback option
7. Issue #12: Make `waitForStylesheetLoad` reject on timeout
8. Issue #13: Remove unused `Timer` parameter
9. Issue #20: Add CORS error handling

### 🟢 Nice to Have (Consider)
10. Issue #6: Document image reload limitation
11. Issue #7: Document prefixfree limitation
12. Issue #15: Expand state preservation (add as needed)
13. Issue #16: Verify DOCTYPE stripping with tests
14. Issue #17: Make script preservation more specific

### ✅ Not Needed
- Issue #9: Plugin system (intentionally omitted)
- Issue #10: Chrome extension reload (user confirmed)
- Issue #19: Async/await (already correct)
- Issue #22: Return value contract (no plugin system)

---

## Architectural Recommendation

The reviewer's key insight:

> "The current implementation attempts to simplify livereload-js but cuts too deep. The CSS reload mechanism in particular has evolved through years of browser quirk handling that cannot be safely ignored."

**Recommendation:** Either fully port the original `Reloader.reloadStylesheet` implementation with all edge case handling, OR explicitly document all unsupported features and target only modern browsers with simplified behavior.

The middle ground we have now inherits complexity expectations from livereload-js users while lacking the robustness they depend on.
