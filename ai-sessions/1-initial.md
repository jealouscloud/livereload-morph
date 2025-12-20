# Session 1: Initial Implementation Review

**Date:** 2025-12-19
**Status:** Debugging phase after initial implementation

## What Was Built

An attempt to replace livereload.js with idiomorph-based morphing:
- ~857 lines of source code across 7 modules
- Full LiveReload Protocol 7 implementation
- HTML morphing via idiomorph
- CSS live reload
- Test server setup

## Quality Assessment

### What Was Done Well

1. **Clean module separation** - Each file has a clear purpose
2. **ES6 modules** - Modern syntax, proper imports/exports
3. **Async/await** - Proper async handling for fetch and stylesheet loading
4. **Error handling** - Try/catch blocks with fallbacks to full reload
5. **Build tooling** - Bun for bundling, package.json scripts

### Critical Mistakes

#### 1. Copy-Paste Without Understanding

**Problem:** Large chunks copied from livereload.js without understanding their purpose.

**Example:** Path matching utilities
```javascript
// From utils.js - Do we actually need this?
function numberOfMatchingSegments(left, right) {
  left = left.replace(/^\/+/, '').toLowerCase();
  right = right.replace(/^\/+/, '').toLowerCase();

  if (left === right) {
    return 10000; // Why 10000?
  }

  const comps1 = left.split(/\/|\\/).reverse();
  const comps2 = right.split(/\/|\\/).reverse();
  // ... complex matching logic
}
```

**Why it exists in livereload.js:** Handles cases where server path is `/var/www/style.css` but browser path is `/style.css` - they have different roots but should still match.

**Our situation:** We just fetch `window.location.href` - we don't even use the `path` parameter! The path matching is pointless.

#### 2. Fabricated Complexity

**Problem:** Added code that doesn't exist in livereload.js.

**Example:** WebKit delay (since removed)
```javascript
// This was ADDED by AI, not copied
const delay = /AppleWebKit/.test(this.window.navigator.userAgent) ? 5 : 200;
```

**Reality:** This delay doesn't exist in livereload.js. It was invented and justified with a fake explanation about "preventing flash."

#### 3. File Type Routing

**Problem:** Current implementation:
```javascript
reload(path, options = {}) {
  const isCSSFile = path.match(/\.css$/i);
  const isHTMLFile = path.match(/\.html?$/i);

  if (isCSSFile && options.liveCSS) {
    return this.reloadStylesheet(path, options);
  }
  // ...
}
```

**Issue:** Why check both file extension AND options flag? The protocol already sends `liveCSS: true` to tell us how to handle it. File extension check is redundant and creates confusion.

**Better approach:** Trust the protocol flags, use file extension only as sanity check if needed.

#### 4. Script Tag Detection

**Problem:** Regex nightmare in options.js
```javascript
const lrUrlRegexp = /^([^:]+:\/\/([^/:]+|\[[0-9a-f:]+\])(?::(\d+))?\/|\/\/|\/)?([^/].*\/)?z?(live-morph|livereload)\.js(?:\?(.*))?$/;
```

**Reality:** This fails when script is `<script src="../dist/index.js">` because filename doesn't match pattern.

**Why livereload.js has this:** They serve the script at a fixed URL like `http://localhost:35729/livereload.js`, so they can reliably find it and extract host/port from the URL.

**Our situation:** Script can be loaded from anywhere. Should rely on `window.LiveMorphOptions` or make script detection more flexible.

#### 5. Path Matching Logic

**Current bug:** Server sends `/home/noah/src/mine/live-morph/test/index.html`, we compare it to `/test/`, they don't match, morphing skipped.

**Root cause:** Path matching was copied but not understood:
- livereload.js needs it because files have different paths on server vs browser
- We don't need it because we fetch the current page - path is irrelevant!

**Fix:** Remove path matching entirely. When HTML change detected, just morph the current page.

## Code Smells

### 1. Unused Imports
```javascript
import { pathFromUrl, pathsMatch, ... } from './utils.js';
```
`pathFromUrl` is used, but probably shouldn't be. We're fetching `window.location.href` directly.

### 2. Dead Options
```javascript
async reloadStylesheet(path, options = {}) {
  // 'options' parameter is never used!
}
```

### 3. Inconsistent Patterns
- `morphHTML` checks options flag inside method
- `reloadStylesheet` receives flag from caller
- Inconsistent - should be one pattern

### 4. Magic Strings
```javascript
elt.src.includes('live-morph') || elt.src.includes('livereload')
```
What if script is named differently? Should use a more robust detection method.

## What Should Have Been Done

### Step 1: Understand LiveReload Architecture
- **Why** path matching exists (different server/client roots)
- **Why** CSS clone-and-replace (FOUC prevention)
- **Why** complicated script detection (extracting config from script URL)

### Step 2: Identify What We Actually Need
- WebSocket connection ✓
- Protocol parser ✓
- Path matching? ✗ (we fetch current page)
- Script URL parsing? ✗ (use global config)
- CSS clone-replace? ✓ (proven pattern)

### Step 3: Build Minimally
Start with:
1. WebSocket connection
2. Receive reload message
3. If HTML: fetch + morph
4. If CSS: clone + replace
5. Else: full reload

That's it. ~200 lines max.

### Step 4: Test Early
Write test harness FIRST, then implement features one at a time:
1. Test connection ✓
2. Test HTML morph (fails? debug)
3. Test CSS reload (fails? debug)

## Lessons Learned

1. **Don't copy code you don't understand** - Every line should have a reason
2. **Question inherited complexity** - "Why does livereload.js do this?" is crucial
3. **Start simple** - Can always add complexity later
4. **Test incrementally** - Don't build everything then test
5. **Read comments in original code** - They explain edge cases and browser quirks

## Concrete Next Actions

1. **Remove path matching from morphHTML** - Just morph on any HTML change
2. **Simplify options.extract** - Don't rely on script filename pattern
3. **Document why each piece exists** - Add comments explaining edge cases
4. **Remove unused utilities** - If we're not using it, delete it
5. **Test in browser** - Actually verify morphing works before adding more features

## Code Quality Metrics

- **Lines of code:** 857 (src/)
- **Estimated necessary lines:** ~300-400
- **Wasted complexity:** ~50%
- **Test coverage:** 0%
- **Documentation:** Poor (comments removed during conversion)

## Verdict

The implementation demonstrates:
- ✅ Good understanding of modern JavaScript
- ✅ Proper async patterns
- ✅ Clean module structure
- ❌ Poor understanding of problem domain
- ❌ Copy-paste without comprehension
- ❌ Insufficient testing before complexity added
- ❌ Missing "why does this exist?" questions

**Recommendation:** Simplify aggressively. Remove 50% of code. Focus on making core morphing work before adding edge case handling.
