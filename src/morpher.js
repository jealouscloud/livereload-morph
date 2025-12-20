import { Idiomorph } from 'idiomorph';
import {
  pathFromUrl,
  pickBestMatch,
  generateCacheBustUrl,
  waitForStylesheetLoad
} from './utils.js';

export class Morpher {
  constructor(window, console, Timer) {
    this.window = window;
    this.console = console;
    this.Timer = Timer;
    this.document = window.document;
  }

  reload(path, options = {}) {
    // Determine what kind of reload based on options from protocol
    const isCSSFile = path.match(/\.css$/i);
    const isHTMLFile = path.match(/\.html?$/i);

    // CSS files with liveCSS enabled
    if (isCSSFile && options.liveCSS) {
      return this.reloadStylesheet(path, options);
    }

    // HTML files with morphHTML enabled
    if (isHTMLFile && options.morphHTML) {
      return this.morphHTML(path, options);
    }

    // Everything else: full page reload
    this.reloadPage();
  }

  async morphHTML(path, options = {}) {
    try {

      // Fetch current page with fresh content (no cache)
      const response = await fetch(this.window.location.href, {
        cache: 'no-cache',
        headers: { 'X-Live-Morph': 'true' }
      });

      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
      }

      let html = await response.text();

      // Strip DOCTYPE to avoid "Cannot have more than one DocumentType child" error
      html = html.replace(/<!DOCTYPE[^>]*>/i, '').trim();

      // Morph the full page as shown in idiomorph docs
      Idiomorph.morph(this.document.documentElement, html, {
        head: {
          style: 'merge',
          shouldPreserve: (elt) => {
            // Preserve our live-morph script
            if (elt.tagName === 'SCRIPT' && elt.src) {
              const src = elt.src.toLowerCase();
              return src.includes('live-morph') ||
                     src.includes('livereload') ||
                     src.includes('dist/index.js');
            }
            return false;
          }
        },
        callbacks: {
          beforeAttributeUpdated: (attributeName, node, mutationType) => {
            // IMPORTANT: idiomorph reuses DOM nodes (good!) but still syncs attributes (bad for livereload)
            //
            // idiomorph was designed for server-rendered apps where the server echoes back current state.
            // For example: user types "test" → server receives it → server sends back <input value="test">
            //
            // But for livereload, we fetch static HTML files that don't have runtime state.
            // So idiomorph sees <input> (no value) and tries to clear the existing value.
            //
            // This callback is the standard pattern used by morphdom, StimulusReflex, and Turbo
            // to preserve client-side state that isn't in the HTML source.

            // Form elements - preserve value and checked state
            if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') {
              if (attributeName === 'value' || attributeName === 'checked') {
                return false;  // Block update - keep existing state
              }
            }

            // Interactive elements - preserve open/expanded state
            if (node.tagName === 'DETAILS' && attributeName === 'open') {
              return false;
            }

            // Allow all other attribute updates
            return true;
          }
        }
      });

      this.console.log('HTML morphed successfully');

    } catch (error) {
      this.console.error(`Morph failed: ${error.message}`);

      // Fallback to full reload on any error
      if (options.fallbackToReload !== false) {
        this.console.log('Falling back to full page reload');
        this.reloadPage();
      }
    }
  }

  async reloadStylesheet(path, options = {}) {
    try {
      // CSS reload uses the clone-and-replace strategy:
      // 1. Find the matching <link> element
      // 2. Clone it with a cache-busted URL (adds ?livereload=timestamp)
      // 3. Insert clone next to original
      // 4. Wait for new stylesheet to load
      // 5. Remove the original
      //
      // This prevents flash of unstyled content (FOUC) because both stylesheets
      // are active during the transition, then we cleanly swap to the new one.

      // Find all stylesheet link elements
      const links = Array.from(this.document.getElementsByTagName('link'))
        .filter(link => link.rel && link.rel.match(/^stylesheet$/i));

      // Find best matching stylesheet by comparing path segments from the end
      // e.g., "styles.css" matches "/test/styles.css" and "/dist/styles.css"
      const match = pickBestMatch(path, links, link => pathFromUrl(link.href));

      if (!match) {
        this.console.log(`No matching stylesheet found for ${path}`);
        return;
      }

      const link = match.object;

      // Clone the link element with cache-busted URL to force browser refetch
      const clone = link.cloneNode(false);
      const newHref = generateCacheBustUrl(link.href);
      clone.href = newHref;

      // Insert clone after original (both active during load)
      const parent = link.parentNode;
      if (parent.lastChild === link) {
        parent.appendChild(clone);
      } else {
        parent.insertBefore(clone, link.nextSibling);
      }

      // Wait for new stylesheet to fully load before removing old one
      await waitForStylesheetLoad(clone);

      // Remove old stylesheet - clean swap complete, no FOUC
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }

    } catch (error) {
      this.console.error(`Stylesheet reload failed: ${error.message}`);
      this.console.error('Stack:', error.stack);
    }
  }

  reloadPage() {
    this.window.location.reload();
  }
}
