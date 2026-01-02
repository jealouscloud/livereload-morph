import { Connector } from './connector.js';
import { Timer } from './timer.js';
import { Options } from './options.js';
import { Morpher } from './morpher.js';
import { ProtocolError } from './protocol.js';

export class LiveMorph {
  constructor(window) {
    this.window = window;
    this.listeners = {};

    // Check for WebSocket support
    if (!(this.WebSocket = this.window.WebSocket || this.window.MozWebSocket)) {
      console.error('[LiveMorph] Disabled because the browser does not support WebSockets');
      return;
    }

    // Extract options from script tag or window.LiveMorphOptions
    this.options = Options.extract(this.window.document);

    if (!this.options) {
      console.error('[LiveMorph] Disabled - no configuration found');
      console.error('[LiveMorph] Set window.LiveMorphOptions = { host: "localhost", port: 35729 }');
      return;
    }

    console.log('[LiveMorph] Options loaded:', JSON.stringify({
      host: this.options.host,
      port: this.options.port,
      morphHTML: this.options.morphHTML,
      verbose: this.options.verbose
    }));

    // Set up console logging based on verbose option
    this.console = this._setupConsole();

    // Create morpher for handling reloads
    this.morpher = new Morpher(
      this.window,
      this.console,
      Timer,
      this.options.importCacheWaitPeriod
    );

    // Create connector for WebSocket communication
    this.connector = new Connector(this.options, this.WebSocket, Timer, {
      connecting: () => {},

      socketConnected: () => {},

      connected: protocol => {
        if (typeof this.listeners.connect === 'function') {
          this.listeners.connect();
        }

        const { host } = this.options;
        const port = this.options.port ? `:${this.options.port}` : '';

        this.log(`Connected to ${host}${port} (protocol v${protocol})`);

        return this.sendInfo();
      },

      error: e => {
        if (e instanceof ProtocolError) {
          return console.log(`[LiveMorph] ${e.message}`);
        } else {
          return console.log(`[LiveMorph] Internal error: ${e.message}`);
        }
      },

      disconnected: (reason, nextDelay) => {
        if (typeof this.listeners.disconnect === 'function') {
          this.listeners.disconnect();
        }

        const { host } = this.options;
        const port = this.options.port ? `:${this.options.port}` : '';
        const delaySec = (nextDelay / 1000).toFixed(0);

        switch (reason) {
          case 'cannot-connect':
            return this.log(`Cannot connect to ${host}${port}, will retry in ${delaySec} sec`);
          case 'broken':
            return this.log(`Disconnected from ${host}${port}, reconnecting in ${delaySec} sec`);
          case 'handshake-timeout':
            return this.log(`Cannot connect to ${host}${port} (handshake timeout), will retry in ${delaySec} sec`);
          case 'handshake-failed':
            return this.log(`Cannot connect to ${host}${port} (handshake failed), will retry in ${delaySec} sec`);
          case 'manual':
          case 'error':
          default:
            return this.log(`Disconnected from ${host}${port} (${reason}), reconnecting in ${delaySec} sec`);
        }
      },

      message: message => {
        switch (message.command) {
          case 'reload':
            return this.performReload(message);
          case 'alert':
            return this.performAlert(message);
        }
      }
    });

    this.initialized = true;
  }

  _setupConsole() {
    const hasConsole = this.window.console && this.window.console.log && this.window.console.error;

    if (!hasConsole) {
      return { log() {}, error() {} };
    }

    if (this.options.verbose) {
      return this.window.console;
    }

    return {
      log() {},
      error: this.window.console.error.bind(this.window.console)
    };
  }

  on(eventName, handler) {
    this.listeners[eventName] = handler;
  }

  log(message) {
    return this.console.log(`[LiveMorph] ${message}`);
  }

  performReload(message) {
    this.log(`Received reload request for: ${message.path}`);

    const options = {
      liveCSS: message.liveCSS != null ? message.liveCSS : true,
      liveImg: message.liveImg != null ? message.liveImg : true,
      reloadMissingCSS: message.reloadMissingCSS != null ? message.reloadMissingCSS : true,
      morphHTML: this.options.morphHTML,
      morphShadowDOM: this.options.morphShadowDOM
    };

    this.log(`Reload options: ${JSON.stringify(options)}`);

    return this.morpher.reload(message.path, options);
  }

  performAlert(message) {
    return alert(message.message);
  }

  sendInfo() {
    if (!this.initialized) {
      return;
    }

    if (!(this.connector.protocol >= 7)) {
      return;
    }

    this.connector.sendCommand({
      command: 'info',
      plugins: {},
      url: this.window.location.href
    });
  }

  shutDown() {
    if (!this.initialized) {
      return;
    }

    this.connector.disconnect();
    this.log('Disconnected');

    if (typeof this.listeners.shutdown === 'function') {
      this.listeners.shutdown();
    }
  }
}
