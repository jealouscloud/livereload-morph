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

    // New options for live-morph
    this.morphHTML = true;
    this.morphCSS = true;
    this.verbose = false;
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
  // First, check for script tag with live-morph.js
  for (const element of Array.from(document.getElementsByTagName('script'))) {
    const src = element.src;
    const srcAttr = element.getAttribute('src');

    if (!src || !srcAttr) {
      continue;
    }

    const lrUrlRegexp = /^([^:]+:\/\/([^/:]+|\[[0-9a-f:]+\])(?::(\d+))?\/|\/\/|\/)?([^/].*\/)?z?(live-morph|livereload)\.js(?:\?(.*))?$/;
    const lrUrlRegexpAttr = /^(?:(?:([^:/]+)?:?)\/{0,2})([^:]+|\[[0-9a-f:]+\])(?::(\d+))?/;

    const m = src.match(lrUrlRegexp);
    const mm = srcAttr.match(lrUrlRegexpAttr);

    if (m && mm) {
      const [, , host, port, , , params] = m;
      const [, , , portFromAttr] = mm;
      const options = new Options();

      options.https = element.src.indexOf('https') === 0;
      options.host = host;

      // Use port from script tag as default
      const ourPort = parseInt(port || portFromAttr, 10) || '';
      options.port = ourPort || options.port;

      // Parse query string parameters
      if (params) {
        for (const pair of params.split('&')) {
          const keyAndValue = pair.split('=');
          if (keyAndValue.length > 1) {
            options.set(keyAndValue[0].replace(/-/g, '_'), keyAndValue.slice(1).join('='));
          }
        }
      }

      options.port = options.port || ourPort;

      return options;
    }
  }

  // Fall back to window.LiveMorphOptions
  const win = document.defaultView || window;
  if (win && win.LiveMorphOptions) {
    const options = new Options();
    for (const [key, value] of Object.entries(win.LiveMorphOptions)) {
      options.set(key, value);
    }
    return options;
  }

  return null;
};
