# Refactoring Plan: live-morph

## Goal
Build a minimal, working livereload.js replacement using idiomorph. Start simple, add complexity only when needed.

## Principles
1. **Understand before implementing** - Know why each line exists
2. **Test each feature incrementally** - Don't build everything then test
3. **Delete aggressively** - If we're not sure we need it, we don't
4. **Comment the "why"** - Explain edge cases and non-obvious decisions

## Phase 1: Get HTML Morphing Working (Current Priority)

**Goal:** Make the core feature actually work in the browser.

### 1.1 Fix Options Extraction
**Problem:** Script tag detection fails when loaded as `dist/index.js`

**Solution:**
```javascript
Options.extract = function(document) {
  // Simple: Just look for window.LiveMorphOptions first
  const win = document.defaultView || window;
  if (win && win.LiveMorphOptions) {
    return createOptionsFromObject(win.LiveMorphOptions);
  }

  // Fallback: Look for ANY script with data-live-morph attribute
  // <script type="module" src="dist/index.js" data-live-morph></script>
  const script = document.querySelector('script[data-live-morph]');
  if (script) {
    return parseOptionsFromScript(script);
  }

  return null;
}
```

**Why:** Don't try to be clever with regex. Use explicit markers.

### 1.2 Remove Path Matching from morphHTML
**Problem:** Comparing `/home/noah/.../index.html` to `/test/` - they never match

**Solution:**
```javascript
async morphHTML(path, options = {}) {
  // Just morph! We're fetching the current page anyway
  this.console.log(`Morphing HTML for ${path}`);

  const response = await fetch(this.window.location.href, {
    cache: 'no-cache'
  });

  const newHtml = await response.text();

  Idiomorph.morph(this.document.documentElement, newHtml, {
    morphStyle: 'outerHTML',
    // ... idiomorph config
  });
}
```

**Why:** We fetch the current page. Path parameter is just for logging. Don't overthink it.

### 1.3 Test HTML Morphing
- [ ] Rebuild with fixes
- [ ] Load test page
- [ ] Verify connection in console
- [ ] Edit test/index.html
- [ ] Verify morph happens (check console logs)
- [ ] Verify input state preserved
- [ ] Verify no full page reload

## Phase 2: Simplify Path Utilities

**Goal:** Remove 90% of utils.js - we don't need it.

### 2.1 Identify What's Actually Used
Current utils.js exports:
- `splitUrl` - Used by generateCacheBustUrl ✓
- `pathFromUrl` - Used by CSS matching ✓
- `numberOfMatchingSegments` - Used by pickBestMatch ✓
- `pickBestMatch` - Used by CSS reload ✓
- `pathsMatch` - **NOT USED ANYMORE** ✗
- `generateCacheBustUrl` - Used by CSS reload ✓
- `waitForStylesheetLoad` - Used by CSS reload ✓

### 2.2 Simplify CSS Path Matching
**Current:** Complex segment-based scoring from livereload.js

**Question:** Do we actually need this? Or can we just:
```javascript
// Find stylesheet by filename
const cssFilename = path.split('/').pop(); // "styles.css"
const link = Array.from(document.querySelectorAll('link[rel=stylesheet]'))
  .find(link => link.href.includes(cssFilename));
```

**Decision:** Try simple approach first. Only add complexity if it fails in practice.

### 2.3 Remove Dead Code
- Delete `pathsMatch` if truly unused
- Simplify `numberOfMatchingSegments` if we keep it - remove magic 10000

## Phase 3: Clean Up morpher.js

**Goal:** Make the core logic crystal clear.

### 3.1 Consistent Option Handling
**Current:** Messy - some options checked in caller, some in method

**Fix:**
```javascript
reload(path, options = {}) {
  // Let options.liveCSS and options.morphHTML control behavior
  // File extension is just a hint

  if (path.endsWith('.css') && options.liveCSS) {
    return this.reloadStylesheet(path);
  }

  if (path.endsWith('.html') && options.morphHTML) {
    return this.morphHTML(path);
  }

  // Default: full reload
  this.reloadPage();
}
```

**Why:** Simple, clear, no redundant checks.

### 3.2 Document idiomorph Config
**Current:** Config exists but no explanation

**Fix:**
```javascript
Idiomorph.morph(this.document.documentElement, newHtml, {
  morphStyle: 'outerHTML',  // Replace entire <html> element

  head: {
    style: 'merge',  // Intelligently merge <head> changes
    shouldPreserve: (elt) => {
      // Keep our live-morph script so we don't lose connection
      if (elt.tagName === 'SCRIPT' && elt.src) {
        return elt.src.includes('dist/index.js') ||
               elt.src.includes('live-morph');
      }
      return false;
    }
  },

  callbacks: {
    beforeNodeRemoved: (node) => {
      // Double-check: don't remove our script
      if (node.tagName === 'SCRIPT' && node.src) {
        if (node.src.includes('dist/index.js') ||
            node.src.includes('live-morph')) {
          return false;  // Cancel removal
        }
      }
    }
  }
});
```

**Why:** Future maintainer (or us in 2 weeks) needs to understand this config.

## Phase 4: Error Handling Review

**Goal:** Make sure errors are helpful, not silent.

### 4.1 Better Error Messages
**Current:** Generic "Morph failed" messages

**Fix:**
```javascript
catch (error) {
  // Be specific about what failed
  if (error.name === 'TypeError') {
    this.console.error(`Morph failed: Invalid HTML response - ${error.message}`);
  } else if (error.message.includes('fetch')) {
    this.console.error(`Morph failed: Network error - ${error.message}`);
  } else {
    this.console.error(`Morph failed: ${error.message}`);
  }

  // Show stack in verbose mode
  if (this.options.verbose) {
    this.console.error(error.stack);
  }

  this.reloadPage();
}
```

### 4.2 User-Visible Feedback
**Consider:** Show toast/notification when morph happens?
```javascript
// Optional enhancement
if (options.showToast) {
  this.showToast('Page updated');
}
```

**Decision:** Defer to Phase 5 - not critical.

## Phase 5: CSS Reload Polish

**Goal:** Make CSS updates buttery smooth.

### 5.1 Verify No Flash
- [ ] Test CSS color change
- [ ] Verify no white flash
- [ ] Test with slow network (throttle in DevTools)

### 5.2 Handle @import Rules
**Current:** Not implemented

**Decision:**
- If `@import` is in inline `<style>`: Need to handle
- If `@import` is in external CSS: Link reload should work
- Test with real-world case before implementing

### 5.3 Handle Multiple Stylesheets
**Question:** What if page has `main.css` and `components.css`?

**Test:**
- [ ] Create test with 2 stylesheets
- [ ] Edit second stylesheet
- [ ] Verify correct one updates

## Phase 6: Documentation

**Goal:** Make project maintainable.

### 6.1 Inline Comments
Add "why" comments for:
- idiomorph config options
- Script preservation logic
- Any browser-specific workarounds (if we add any)

### 6.2 README Updates
- [ ] Real usage examples
- [ ] Troubleshooting section
- [ ] Known limitations
- [ ] Comparison with livereload.js (when to use which)

### 6.3 API Documentation
```javascript
/**
 * Morph HTML content using idiomorph
 *
 * @param {string} path - Changed file path (for logging only)
 * @param {Object} options
 * @param {boolean} options.morphHTML - Enable morphing (default: true)
 * @returns {Promise<void>}
 *
 * @example
 * morpher.morphHTML('/index.html', { morphHTML: true });
 */
async morphHTML(path, options = {}) { ... }
```

## Phase 7: Advanced Features (Future)

These are NOT current priorities:

### 7.1 Image Updates
- Replace `<img>` src with cache-busting
- Update background-image CSS
- **When:** After core features rock-solid

### 7.2 Partial Morphing
- Only morph changed sections
- Use MutationObserver or custom markers
- **When:** Performance becomes an issue

### 7.3 Plugin System
- Allow custom morph strategies
- Custom reload handlers
- **When:** Users request it

### 7.4 Dev Tools Extension
- Visualize what changed
- Toggle morphing on/off
- **When:** Project is mature

## Success Metrics

### Phase 1 Success (This Week)
- [ ] HTML morphing works in browser
- [ ] Input state preserved during morph
- [ ] Console shows clear success/error messages
- [ ] No false errors in console

### Phase 2 Success
- [ ] utils.js under 100 lines
- [ ] All code in utils.js is actually used
- [ ] CSS reload works with simple filename matching

### Phase 3 Success
- [ ] morpher.js is easy to read
- [ ] Every non-obvious line has a comment
- [ ] No "magic" behavior

### Overall Success
- [ ] Source code under 500 lines (currently 857)
- [ ] Every line can be explained in plain English
- [ ] Works with real LiveReload servers (guard, browser-sync)
- [ ] Zero errors in typical usage

## Anti-Goals

Things we're explicitly NOT doing:

- ❌ Supporting IE11 or old browsers
- ❌ Building a server (use existing LiveReload servers)
- ❌ Hot module replacement (that's bundler territory)
- ❌ Framework-specific integrations (keep it vanilla)
- ❌ Image morphing (defer until requested)
- ❌ Plugin system (YAGNI until proven needed)

## Next Action (Right Now)

**Start with Phase 1.1:** Fix options extraction so script tag detection works.

```javascript
// Quick fix for testing
Options.extract = function(document) {
  const win = document.defaultView || window;
  if (win && win.LiveMorphOptions) {
    const options = new Options();
    for (const [key, value] of Object.entries(win.LiveMorphOptions)) {
      options.set(key, value);
    }
    return options;
  }
  return null;
}
```

Then rebuild, test, and verify connection works.
