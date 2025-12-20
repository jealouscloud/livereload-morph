# Project State

## Goal

Replace livereload.js with a version that uses **idiomorph** for intelligent DOM morphing instead of full page reloads.

**Core Principle:** Learn from livereload.js architecture, but implement HTML updates via morphing to preserve page state (input values, scroll position, focus).

## Current State

### What Works
- ✅ WebSocket connection to LiveReload Protocol 7 servers
- ✅ Basic HTML morphing implementation using idiomorph
- ✅ CSS live reload using clone-and-replace strategy
- ✅ Options configuration via script tag or `window.LiveMorphOptions`
- ✅ Test harness with HTTP + LiveReload server

### What Doesn't Work
- ❌ HTML morphing currently broken (not being triggered)
- ❌ Path matching issues between server paths and client paths
- ❌ Options extraction fails when script loaded as ES module

### Known Issues

1. **Critical Bug**: Options.extract() looks for scripts with `live-morph.js` or `livereload.js` in filename, but test loads `dist/index.js`
2. **Path Mismatch**: Server sends absolute paths like `/home/noah/...`, browser has relative paths like `/test/`
3. **Over-engineering**: Code has unnecessary complexity copied from livereload.js without understanding why it exists

## Architecture

```
src/
├── index.js         - Entry point, creates global LiveMorph instance
├── live-morph.js    - Main orchestrator, handles WebSocket messages
├── connector.js     - WebSocket connection with auto-reconnect
├── protocol.js      - Protocol 7 parser
├── morpher.js       - Core morphing logic (HTML + CSS)
├── options.js       - Config extraction from script tag
├── timer.js         - Timer utilities
└── utils.js         - Path matching, URL parsing, cache-busting
```

**Bundle Size:** 42.38 KB (includes idiomorph)

## Technical Debt

1. **Path matching complexity** - Copied from livereload.js but not adapted for our use case
2. **Unnecessary utilities** - Many path matching functions may not be needed
3. **Script detection** - Overly complex regex for finding our own script tag
4. **No tests** - Zero automated tests, only manual test harness
5. **Comments removed** - Many comments from livereload.js explaining edge cases were removed

## Next Steps

1. Fix options extraction to work with any script src (not just specific filenames)
2. Simplify or remove path matching - just morph on HTML changes
3. Test actual morphing behavior in browser
4. Identify and remove unnecessary code
5. Add inline comments explaining non-obvious behavior
