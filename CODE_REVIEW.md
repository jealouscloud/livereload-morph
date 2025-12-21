# Live-Morph Code Review

**Date:** 2025-12-20
**Reviewer:** Claude Opus 4.5
**Status:** APPROVED WITH RESERVATIONS

---

## Summary

Live-morph is a well-implemented livereload-js replacement that uses idiomorph for HTML morphing. The code is clean, readable, and handles the core use cases correctly. Previous review items have been addressed. There are minor issues remaining that do not block production use but should be addressed for robustness.

---

## Verdict: APPROVED WITH RESERVATIONS

The codebase is production-ready for its stated purpose. The architecture is sound, code is legible, and the critical functionality (CSS reload, HTML morphing) is correctly implemented. The reservations below are minor and can be addressed in future iterations.

---

## Critical Issues

None.

---

## Concerns

### 1. README Documents Non-Existent Option

**File:** `/home/noah/src/mine/live-morph/README.md` (line 64)
**Severity:** Low

The README references `morphCSS: true` as a configuration option, but this option does not exist in the codebase. The `options.js` file does not define `morphCSS`, and it is never read anywhere.

```markdown
morphCSS: true      // Enable CSS live reload (default: true)
```

CSS live reload is controlled by `liveCSS` from the protocol message, not by a client option. This is misleading documentation.

**Recommendation:** Remove `morphCSS` from the README or implement the option if intended.

### 2. generateCacheBustUrl Does Not Replace Existing livereload Parameter

**File:** `/home/noah/src/mine/live-morph/src/utils.js` (lines 91-96)
**Severity:** Low

The live-morph implementation always appends a new `livereload=` parameter:

```javascript
export function generateCacheBustUrl(url) {
  const { url: cleanUrl, params, hash } = splitUrl(url);
  const separator = params ? '&' : '?';
  return `${cleanUrl}${params}${separator}livereload=${Date.now()}${hash}`;
}
```

The original livereload-js replaces existing `livereload=` parameters to avoid URL bloat on repeated reloads:

```javascript
let params = oldParams.replace(/(\?|&)livereload=(\d+)/, (match, sep) => `${sep}${expando}`);
```

With rapid CSS file saves, URLs will accumulate multiple `livereload=` parameters (e.g., `?livereload=123&livereload=456&livereload=789`). This is technically harmless but untidy.

**Recommendation:** Replace existing `livereload=` parameter instead of always appending.

### 3. Disconnected Message Shows Delay in Milliseconds, Not Seconds

**File:** `/home/noah/src/mine/live-morph/src/live-morph.js` (line 79)
**Severity:** Very Low

The code converts to seconds with `.toFixed(0)`:

```javascript
const delaySec = (nextDelay / 1000).toFixed(0);
```

But the original livereload-js passes `nextDelay` directly (which is in milliseconds) and displays it as seconds. This is a style difference; the live-morph approach is actually correct and clearer.

Not an issue - just noting the intentional deviation from original.

### 4. Missing ext/extver/snipver in Hello Handshake

**File:** `/home/noah/src/mine/live-morph/src/connector.js` (lines 128-135)
**Severity:** Very Low

The original livereload-js connector sends optional `ext`, `extver`, and `snipver` fields in the hello handshake when configured:

```javascript
if (this.options.ext) {
  hello.ext = this.options.ext;
}
```

Live-morph omits these. This is fine since these are for browser extension integration which is explicitly not supported.

Not an issue - intentional omission per project scope.

### 5. waitForStylesheetLoad Has Redundant Timeout Mechanisms

**File:** `/home/noah/src/mine/live-morph/src/utils.js` (lines 98-142)
**Severity:** Very Low

The function has three timeout/completion mechanisms:

1. `linkElement.onload` event handler
2. Polling with internal timeout check (`Date.now() - startTime > timeout`)
3. Absolute timeout failsafe (`setTimeout(finish, timeout)`)

Mechanisms 2 and 3 are redundant. Either the polling timeout check OR the absolute timeout failsafe would suffice. Having both is not harmful but adds unnecessary complexity.

**Recommendation:** Consider simplifying to just polling + onload, or just onload + absolute timeout.

### 6. ~~liveImg Option Is Parsed But Never Used~~ (RETRACTED)

**Status:** This concern was incorrect.

The `liveImg` option IS used. `morpher.js` line 33-34 checks `options.liveImg` and routes to `reloadImages()`:

```javascript
if (isImageFile && options.liveImg) {
  return this.reloadImages(path);
}
```

Image reload is fully implemented for `<img>` elements, inline style backgrounds, and CSS background-image rules. See incremental review below for details.

---

## Specific Findings

### Purpose Clarity

**Verdict:** PASS

All files have clear, single purposes:

- `morpher.js` - Handles HTML morphing and CSS reloading
- `live-morph.js` - Main orchestrator connecting Morpher and Connector
- `connector.js` - WebSocket connection management
- `protocol.js` - LiveReload protocol parsing
- `timer.js` - Timer utility
- `options.js` - Configuration extraction
- `utils.js` - URL manipulation utilities
- `index.js` - Entry point and global setup

Naming is precise and intention-revealing throughout.

### Completeness

**Verdict:** PASS

No TODOs, FIXMEs, or placeholder implementations. All code paths are fully implemented. Error cases are handled with fallback to full page reload where appropriate.

Edge cases addressed:
- CORS-protected stylesheets (graceful skip)
- Prefixfree compatibility
- WebKit-specific timing quirks
- Race conditions on rapid CSS reloads (`__LiveReload_pendingRemoval` flag)
- @import rule nesting (recursive collection)

### Correctness

**Verdict:** PASS

The implementation correctly follows the original livereload-js patterns where applicable:

1. CSS clone-and-replace strategy is correctly implemented
2. @import CSSOM replacement with WebKit workaround is preserved
3. Protocol parsing matches original behavior
4. Exponential backoff reconnection logic is correct
5. Path matching algorithm (right-to-left segment comparison) is preserved from original

The HTML morphing via idiomorph is correctly configured:
- HEAD merge strategy
- Live-morph script preservation
- State preservation via `beforeAttributeUpdated` callback

### Performance

**Verdict:** PASS

No obvious performance issues:

- Stylesheet collection uses `Array.from()` appropriately
- Path matching is O(n) where n is stylesheets, which is reasonable
- No unnecessary DOM queries in hot paths
- Cache-busting uses timestamp which is sufficient

Minor note: `collectImportedStylesheets` recurses into nested @imports, which could be slow with deeply nested imports. This is unlikely to be a practical issue.

### Error Handling

**Verdict:** PASS

Error handling is consistent and appropriate:

1. `morphHTML` - try/catch with fallback to full page reload
2. `reloadStylesheet` - try/catch with error logging
3. `collectImportedStylesheets` - try/catch for CORS errors
4. `reattachImportedRule` - try/catch for media access
5. WebSocket errors - handled via `onerror` -> `onclose` -> reconnect

The pattern of logging errors and falling back to page reload is appropriate for a development tool.

### Architecture

**Verdict:** PASS

Clean separation of concerns:

- `Morpher` is pure logic with no side effects except DOM manipulation
- `Connector` manages only WebSocket lifecycle
- `Parser` handles only protocol parsing
- `Options` is a simple data container with extraction logic
- `LiveMorph` is a thin coordinator

Dependency injection is used appropriately (window, console, Timer passed to constructors).

The module structure follows the original livereload-js closely, making it easy to compare and understand.

### Comment Quality

**Verdict:** PASS

Comments explain *why*, not *what*:

```javascript
// IMPORTANT: idiomorph reuses DOM nodes (good!) but still syncs attributes (bad for livereload)
//
// idiomorph was designed for server-rendered apps where the server echoes back current state.
// For example: user types "test" -> server receives it -> server sends back <input value="test">
//
// But for livereload, we fetch static HTML files that don't have runtime state.
```

This is excellent context for why the `beforeAttributeUpdated` callback exists.

```javascript
// LEGACY WEBKIT WORKAROUND (~2012): Old WebKit versions reset all styles
// if we add an @import'ed stylesheet that hasn't been cached yet.
```

Good historical context with date estimate.

No commented-out code blocks. No stale comments.

### Code vs Original livereload-js

The following original features are intentionally omitted per project scope:

1. Image live reload (`reloadImages`, `reloadStyleImages`, `reloadStylesheetImages`)
2. Plugin system (`addPlugin`, `runPluginsByOrder`)
3. Chrome extension reload (`reloadChromeExtension`)
4. `overrideURL` option for proxy setups
5. `analyze()` plugin data collection

These omissions are documented and appropriate for the simplified scope.

The following features are preserved correctly:

1. CSS clone-and-replace strategy
2. @import CSSOM replacement with WebKit workaround
3. Path matching algorithm
4. Protocol 6 and 7 support
5. Exponential backoff reconnection
6. Prefixfree compatibility

---

## Required Changes

None required. This is approved with minor reservations noted above.

---

## Previous Review Status

All items from the previous review have been addressed:

| Issue | Status |
|-------|--------|
| @import Stylesheet Handling | Fixed |
| __LiveReload_pendingRemoval Flag | Fixed |
| Additional Wait Time After Load | Fixed |
| CSS Map File Support | Fixed |
| morphCSS Dead Code | Fixed |
| StyleFix/Prefixfree Support | Fixed |
| reloadMissingCSS Fallback | Fixed |
| Timer Parameter | Now Used |
| CORS Error Handling | Fixed |
| Image Reload Support | Fully implemented (previous review was incorrect) |
| Hardcoded Script Preservation | Fixed |

Items explicitly deferred:

| Issue | Decision |
|-------|----------|
| overrideURL Option | Skip - edge case for proxy setups |
| waitForStylesheetLoad Timeout | Won't fix - silent resolution is acceptable |
| Expanded State Preservation (audio/video/dialog) | Add when users report issues |
| DOCTYPE Stripping | OK for modern HTML |

---

## Recommendations for Future Work

1. **Remove morphCSS from README** - Documents non-existent option (if still present)
2. **Simplify waitForStylesheetLoad** - Remove redundant timeout mechanism

These are quality-of-life improvements, not blocking issues.

---

## Incremental Review: 2025-12-20

### Changes Reviewed

1. **`/home/noah/src/mine/live-morph/src/utils.js`** - `generateCacheBustUrl` fix
2. **`/home/noah/src/mine/live-morph/test/index.html`** - Image Reload Test section added

---

### Verdict: APPROVED

Both changes are correct and address previous review concerns.

---

### Finding 1: generateCacheBustUrl Fix Is Correct

**File:** `/home/noah/src/mine/live-morph/src/utils.js` (lines 91-107)
**Status:** APPROVED

The fix correctly handles all edge cases:

```javascript
export function generateCacheBustUrl(url) {
  const { url: cleanUrl, params, hash } = splitUrl(url);
  const expando = `livereload=${Date.now()}`;

  if (!params) {
    return `${cleanUrl}?${expando}${hash}`;
  }

  // Replace existing livereload param or append new one
  if (params.includes('livereload=')) {
    const newParams = params.replace(/([?&])livereload=\d+/, `$1${expando}`);
    return `${cleanUrl}${newParams}${hash}`;
  }

  return `${cleanUrl}${params}&${expando}${hash}`;
}
```

**Edge case analysis:**

| Case | Input | Output | Correct |
|------|-------|--------|---------|
| First reload, no params | `/style.css` | `/style.css?livereload=123` | Yes |
| First reload, with hash | `/style.css#section` | `/style.css?livereload=123#section` | Yes |
| First reload, existing params | `/style.css?v=1` | `/style.css?v=1&livereload=123` | Yes |
| Subsequent reload | `/style.css?livereload=100` | `/style.css?livereload=123` | Yes |
| Subsequent, multiple params | `/style.css?v=1&livereload=100` | `/style.css?v=1&livereload=123` | Yes |
| Subsequent, with hash | `/style.css?livereload=100#x` | `/style.css?livereload=123#x` | Yes |

The regex `/([?&])livereload=\d+/` correctly:
- Captures the separator character (`?` or `&`) for preservation
- Matches only the numeric timestamp, not trailing parameters
- Uses backreference `$1` to maintain URL structure

This resolves the concern from the previous review about URL bloat from repeated saves.

---

### Finding 2: Image Reload Test Is Consistent With Implementation

**File:** `/home/noah/src/mine/live-morph/test/index.html` (lines 126-146)
**Status:** APPROVED

The test section claims:
> All three boxes should update without a full page reload!

This is **correct**. Reviewing `morpher.js` reveals that image reload IS fully implemented:

```javascript
// morpher.js lines 24-35
const isImageFile = path.match(/\.(jpe?g|png|gif|svg|webp|ico)$/i);
// ...
if (isImageFile && options.liveImg) {
  return this.reloadImages(path);
}
```

The `reloadImages` method (lines 266-290) handles:
1. `<img>` elements - iterates `document.images` and cache-busts matching `src` attributes
2. Inline style backgrounds - queries elements with `[style*=background]` and `[style*=border]`
3. CSS background-image rules - walks stylesheets recursively to find and update `url()` references

**Previous review correction:** The prior review stated that `liveImg` was "set but never read" and that images "fall through to full page reload." This was incorrect. The code clearly checks `options.liveImg` at line 33 and routes to `reloadImages()`. The feature is fully implemented.

The README at line 95 correctly documents this:
> Images (`.jpg`, `.png`, `.gif`, `.svg`, `.webp`, `.ico`) -> Cache-bust `<img>` src and CSS backgrounds

---

### Finding 3: Test HTML Structure Is Sound

The test section properly covers all three image reload vectors:

```html
<img src="test-image.svg" ...>                     <!-- <img> element -->
<div class="image-box"></div>                       <!-- CSS background-image via class -->
<div style="...background-image: url('test-image.svg')...">  <!-- inline style -->
```

This provides good coverage for validating the image reload functionality.

---

### Updated Status of Previous Review Items

| Previous Concern | Status |
|-----------------|--------|
| generateCacheBustUrl appends instead of replacing | **Fixed** - now correctly replaces existing `livereload=` parameter |
| liveImg option set but never read | **Corrected** - previous review was wrong; image reload IS implemented |
| Test claims images update without reload | **Verified** - test claim is accurate per implementation |

---

### Remaining Items From Previous Review

These items from the original review remain unaddressed but are non-blocking:

1. **morphCSS in README** - Still references non-existent option (verify if still present)
2. **waitForStylesheetLoad redundancy** - Has three timeout mechanisms when two would suffice

No action required for approval.
