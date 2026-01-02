# livereload-morph

A drop-in replacement for [livereload-js](https://github.com/livereload/livereload-js) that uses **idiomorph** for intelligent DOM morphing. Instead of full page reloads, livereload-morph preserves page state by morphing HTML changes directly into the DOM.

## What is LiveReload?

LiveReload watches your files and automatically refreshes your browser when you save changes. To use it, you need:

1. A **LiveReload server** running on your development machine (see list below)
2. A **client script** (this library) loaded in your browser

This library implements an enhanced client that morphs HTML changes instead of doing full page reloads.

## Compatible Servers

livereload-morph works with any LiveReload Protocol 7 compatible server:
- [html-compose](https://github.com/jealouscloud/html-comose) (Python)
- [guard-livereload](https://github.com/guard/guard-livereload) (Ruby)
- [python-livereload](https://github.com/lepture/python-livereload)
- [livereload](https://www.npmjs.com/package/livereload) (Node.js)
- [browser-sync](https://browsersync.io/)
- [grunt-contrib-watch](https://github.com/gruntjs/grunt-contrib-watch)
- [LiveReload app for Mac](http://livereload.com/)
- Any server implementing the [LiveReload protocol](http://livereload.com/api/protocol/)

## Features

- **HTML Morphing**: HTML file changes update the DOM without full page reload, preserving:
  - Input field values and cursor position
  - Scroll position
  - Active elements and focus
  - Component state

- **CSS Live Reload**: CSS changes update without flash using clone-and-replace strategy

- **Minimal & Fast**: Small bundle (includes idiomorph), vanilla JavaScript, no dependencies

## Usage

Add to your HTML page:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/livereload-morph@latest/dist/livereload-morph.min.js?host=localhost"></script>
```

You can also download and serve the script locally, or install via npm:

```bash
npm install livereload-morph
```

### Configuration

Configure via query string parameters:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/livereload-morph@latest/dist/livereload-morph.min.js?host=localhost&verbose=true"></script>
```

Or via global options:

```html
<script type="module">
  window.LiveMorphOptions = {
    host: 'localhost',
    port: 35729,
    verbose: true,      // Enable console logging
    morphHTML: true     // Enable HTML morphing (default: true)
  };
</script>
<script type="module" src="https://cdn.jsdelivr.net/npm/livereload-morph@latest/dist/livereload-morph.min.js"></script>
```

## vs livereload-js

| Feature | livereload-morph | livereload-js |
|---------|------------------|---------------|
| HTML updates | Morph (preserves state) | Full reload |
| CSS updates | Clone-replace | Clone-replace |
| Input state | Preserved | Lost on reload |
| Scroll position | Preserved | Lost on reload |
| Focus state | Preserved | Lost on reload |

## How It Works

When a file changes:

- **CSS files** → Clone-and-replace for `<link>` tags, CSSOM rule replacement for `@import`
- **Images** → Cache-bust `<img>` src and CSS backgrounds
- **JavaScript** → Full page reload (no safe hot-reload)
- **Everything else** → Re-fetch page HTML and morph with idiomorph

### State Preservation

The following is preserved automatically during HTML morphs:
- Input values (text, textarea, select)
- Checkbox/radio checked state
- `<details>` open/closed state
- Scroll position

For best results, add IDs to form elements. Without IDs, idiomorph may recreate elements instead of morphing them.

### Declarative Shadow DOM

livereload-morph supports [declarative shadow DOM](https://developer.chrome.com/docs/css-ui/declarative-shadow-dom). When a `<template shadowrootmode="open">` is morphed, the library detects it and updates the shadow root content accordingly.

```html
<div id="my-component">
  <template shadowrootmode="open">
    <style>p { color: blue; }</style>
    <p>Shadow content that will be live-reloaded</p>
  </template>
</div>
```

All standard declarative shadow DOM attributes are supported:
- `shadowrootmode` - "open" or "closed"
- `shadowrootdelegatesfocus` - delegates focus to first focusable element
- `shadowrootclonable` - allows cloning via `cloneNode()`
- `shadowrootserializable` - allows serialization via `getHTML()`

Set `morphShadowDOM: false` to skip this processing (the `<template>` will remain in the light DOM after morph, and no shadow root updates will occur).

## All Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | (required) | LiveReload server hostname |
| `port` | number | 35729 | LiveReload server port |
| `path` | string | 'livereload' | WebSocket path |
| `https` | boolean | false | Use secure WebSocket (wss://) |
| `morphHTML` | boolean | true | Enable HTML morphing |
| `morphShadowDOM` | boolean | true | Process declarative shadow DOM templates during morph |
| `verbose` | boolean | false | Enable console logging |
| `importCacheWaitPeriod` | number | 200 | Legacy WebKit @import workaround delay. Set to 0 to disable |
| `mindelay` | number | 1000 | Min reconnection delay (ms) |
| `maxdelay` | number | 60000 | Max reconnection delay (ms) |
| `handshake_timeout` | number | 5000 | Handshake timeout (ms) |

## Browser Support

Modern browsers with ES6+ support (Chrome/Edge 60+, Firefox 60+, Safari 12+).

## License

MIT

## Credits

- [idiomorph](https://github.com/bigskysoftware/idiomorph) for DOM morphing
- [LiveReload Protocol 7](https://github.com/livereload/livereload-js)

---

## Contributing

```bash
bun install        # Install dependencies
bun run build      # Build once
bun run dev        # Watch mode + test server
bun run test       # Run test server
bun run test:e2e   # Run playwright tests
```
