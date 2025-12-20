# live-morph

A livereload-js replacement that uses **idiomorph** for intelligent DOM morphing. Instead of full page reloads, live-morph preserves page state by morphing HTML changes directly into the DOM.

## Features

- **HTML Morphing**: HTML file changes update the DOM without full page reload, preserving:
  - Input field values and cursor position
  - Scroll position
  - Active elements and focus
  - Component state

- **CSS Live Reload**: CSS changes update without flash using clone-and-replace strategy

- **LiveReload Protocol 7 Compatible**: Works with existing LiveReload servers (guard-livereload, browser-sync, etc.)

- **Minimal & Fast**: ~43 KB bundle (includes idiomorph), vanilla JavaScript, no dependencies

## Quick Start

### Installation

```bash
bun install
```

### Build

```bash
bun run build
```

### Testing

Start the test server with LiveReload:

```bash
bun run test
```

Then open http://localhost:3000/test/ in your browser.

**Test HTML Morphing:**
1. Type in the input field
2. Edit `test/index.html` (change text, add elements, etc.)
3. Watch the page update without losing your input!

**Test CSS Reload:**
1. Edit `test/styles.css` (change `.color-box` background color)
2. Watch styles update with no flash

## Usage

Add to your HTML page:

```html
<script type="module">
  window.LiveMorphOptions = {
    host: 'localhost',
    port: 35729,
    verbose: true,      // Enable console logging
    morphHTML: true,    // Enable HTML morphing (default: true)
    morphCSS: true      // Enable CSS live reload (default: true)
  };
</script>
<script type="module" src="http://localhost:35729/live-morph.js"></script>
```

Or use query string parameters:

```html
<script type="module" src="http://localhost:35729/live-morph.js?host=localhost&verbose=true"></script>
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | (required) | LiveReload server hostname |
| `port` | number | 35729 | LiveReload server port |
| `path` | string | 'livereload' | WebSocket path |
| `https` | boolean | false | Use secure WebSocket (wss://) |
| `morphHTML` | boolean | true | Enable HTML morphing |
| `morphCSS` | boolean | true | Enable CSS live reload |
| `verbose` | boolean | false | Enable console logging |
| `mindelay` | number | 1000 | Min reconnection delay (ms) |
| `maxdelay` | number | 60000 | Max reconnection delay (ms) |
| `handshake_timeout` | number | 5000 | Handshake timeout (ms) |

## How It Works

1. **WebSocket Connection**: Connects to LiveReload server on port 35729
2. **File Change Detection**: Server sends `reload` command with changed file path
3. **Smart Routing**:
   - `.html` files → Morph with idiomorph
   - `.css` files → Clone-and-replace stylesheet
   - `.js` files → Full page reload (can't hot-swap)
4. **State Preservation**: idiomorph intelligently merges changes while preserving DOM state

## vs livereload-js

| Feature | live-morph | livereload-js |
|---------|------------|---------------|
| HTML updates | ✅ Morph (preserves state) | ❌ Full reload |
| CSS updates | ✅ Clone-replace | ✅ Clone-replace |
| Input state | ✅ Preserved | ❌ Lost on reload |
| Scroll position | ✅ Preserved | ❌ Lost on reload |
| Focus state | ✅ Preserved | ❌ Lost on reload |
| Bundle size | ~43 KB | ~10 KB |

## Development

```bash
# Build once
bun run build

# Build and watch for changes
bun run build:watch

# Run test server (builds + starts server)
bun run test

# Development mode (watch build + server)
bun run dev
```

## Browser Support

Modern browsers with ES6+ support:
- Chrome/Edge 60+
- Firefox 60+
- Safari 12+

## License

MIT

## Credits

- Built with [idiomorph](https://github.com/bigskysoftware/idiomorph) for DOM morphing
- Compatible with [LiveReload Protocol 7](http://livereload.com/)
