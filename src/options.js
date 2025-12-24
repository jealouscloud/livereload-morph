export class Options {
  constructor() {
    this.https = false;
    this.host = null;
    let port = 35729;

    // Port property with getter/setter for falsy value handling
    Object.defineProperty(this, 'port', {
      get() { return port; },
      set(v) { port = (v ? (isNaN(v) ? v : +v) : ''); }
    });

    this.mindelay = 1000;
    this.maxdelay = 60000;
    this.handshake_timeout = 5000;

    // New options for livereload-morph
    this.morphHTML = true;
    this.verbose = false;

    // WebKit @import workaround delay in milliseconds
    // Set to any value > 0 to enable workaround (default: 200)
    // Set to 0 to disable (will cause flicker on @import reloads)
    this.importCacheWaitPeriod = 200;
  }

  set(name, value) {
    if (typeof value === 'undefined') {
      return;
    }

    // Convert numeric strings to numbers
    if (!isNaN(+value)) {
      value = +value;
    }

    // Convert boolean strings
    if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    }

    this[name] = value;
  }
}

Options.extract = function(document) {
  // Primary method: Check for window.LiveMorphOptions first
  // This is the recommended way to configure livereload-morph
  const win = document.defaultView || window;
  if (win && win.LiveMorphOptions) {
    const options = new Options();
    for (const [key, value] of Object.entries(win.LiveMorphOptions)) {
      options.set(key, value);
    }
    return options;
  }

  // Fallback: Look for script tag with data-livereload-morph-host attribute
  // Example: <script src="livereload-morph.js" data-livereload-morph-host="localhost"></script>
  const scripts = Array.from(document.getElementsByTagName('script'));
  for (const script of scripts) {
    const host = script.getAttribute('data-livereload-morph-host');
    if (host) {
      const options = new Options();
      options.host = host;

      // Optional attributes
      const port = script.getAttribute('data-livereload-morph-port');
      if (port) options.port = parseInt(port, 10);

      const verbose = script.getAttribute('data-livereload-morph-verbose');
      if (verbose !== null) options.verbose = verbose === 'true';

      return options;
    }
  }

  return null;
};
