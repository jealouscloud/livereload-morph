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
    this.console.log(`Reloading page due to change in ${path}`);
    this.reloadPage();
  }

  async morphHTML(path, options = {}) {
    try {
      this.console.log(`Morphing HTML for ${path}`);

      // Fetch fresh content
      const response = await fetch(this.window.location.href, {
        cache: 'no-cache',
        headers: { 'X-Live-Morph': 'true' }
      });

      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
      }

      const newHtml = await response.text();

      // Morph the document using idiomorph
      Idiomorph.morph(this.document.documentElement, newHtml, {
        morphStyle: 'outerHTML',
        head: {
          style: 'merge',
          shouldPreserve: (elt) => {
            // Preserve live-morph script tag
            if (elt.tagName === 'SCRIPT' && elt.src) {
              return elt.src.includes('live-morph') || elt.src.includes('livereload');
            }
            return false;
          }
        },
        callbacks: {
          beforeNodeRemoved: (node) => {
            // Don't remove live-morph script
            if (node.tagName === 'SCRIPT' && node.src) {
              if (node.src.includes('live-morph') || node.src.includes('livereload')) {
                return false;
              }
            }
          }
        }
      });

      this.console.log('HTML morphed successfully');

    } catch (error) {
      this.console.error(`Morph failed: ${error.message}`);

      // Fallback to full reload
      if (options.fallbackToReload !== false) {
        this.console.log('Falling back to full page reload');
        this.reloadPage();
      }
    }
  }

  async reloadStylesheet(path, options = {}) {
    try {
      // Find all stylesheet link elements
      const links = Array.from(this.document.getElementsByTagName('link'))
        .filter(link => link.rel && link.rel.match(/^stylesheet$/i));

      this.console.log(`Found ${links.length} stylesheets on page`);

      // Find best matching stylesheet
      const match = pickBestMatch(path, links, link => pathFromUrl(link.href));

      if (!match) {
        this.console.log(`No matching stylesheet found for ${path}`);
        return;
      }

      const link = match.object;
      this.console.log(`Reloading stylesheet: ${link.href}`);

      // Clone the link element
      const clone = link.cloneNode(false);
      clone.href = generateCacheBustUrl(link.href);

      // Insert clone after original
      const parent = link.parentNode;
      if (parent.lastChild === link) {
        parent.appendChild(clone);
      } else {
        parent.insertBefore(clone, link.nextSibling);
      }

      // Wait for new stylesheet to load
      await waitForStylesheetLoad(clone);

      // Remove old stylesheet
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }

      this.console.log('Stylesheet reloaded successfully');

    } catch (error) {
      this.console.error(`Stylesheet reload failed: ${error.message}`);
    }
  }

  reloadPage() {
    this.window.location.reload();
  }
}
