import { Idiomorph } from 'idiomorph';
import {
  pathFromUrl,
  pickBestMatch,
  generateCacheBustUrl,
  waitForStylesheetLoad
} from './utils.js';

export class Morpher {
  constructor(window, console, Timer, importCacheWaitPeriod = 200) {
    this.window = window;
    this.console = console;
    this.Timer = Timer;
    this.document = window.document;

    // WebKit @import workaround delay (default 200ms for compatibility)
    // Set to 0 to disable workaround for modern browsers
    this.importCacheWaitPeriod = importCacheWaitPeriod;
  }

  reload(path, options = {}) {
    // Determine what kind of reload based on options from protocol
    const isCSSFile = path.match(/\.css(?:\.map)?$/i);
    const isHTMLFile = path.match(/\.html?$/i);

    // CSS files (including source maps) with liveCSS enabled
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
      // CSS reload uses the clone-and-replace strategy for <link> tags
      // and CSSOM rule replacement for @import rules.
      //
      // For <link> tags:
      // 1. Clone with cache-busted URL
      // 2. Insert clone next to original
      // 3. Wait for new stylesheet to load
      // 4. Remove the original
      //
      // For @import rules:
      // 1. Pre-cache with temp <link> (WebKit workaround)
      // 2. Replace rule in CSSOM with cache-busted URL
      // 3. Repeat for good measure

      // Collect all <link rel="stylesheet"> elements (exclude those pending removal)
      const links = Array.from(this.document.getElementsByTagName('link'))
        .filter(link => link.rel && link.rel.match(/^stylesheet$/i) && !link.__LiveReload_pendingRemoval);

      // Collect all @import rules from <style> and <link> tags
      const imported = [];

      // Check <style> tags for @import rules
      for (const style of Array.from(this.document.getElementsByTagName('style'))) {
        if (style.sheet) {
          this.collectImportedStylesheets(style, style.sheet, imported);
        }
      }

      // Check <link> tags for @import rules
      for (const link of links) {
        if (link.sheet) {
          this.collectImportedStylesheets(link, link.sheet, imported);
        }
      }

      // Handle prefixfree (converts <link> to <style data-href>)
      if (this.window.StyleFix && this.document.querySelectorAll) {
        for (const style of Array.from(this.document.querySelectorAll('style[data-href]'))) {
          links.push(style);
        }
      }

      this.console.log(`CSS reload: found ${links.length} LINKed stylesheets, ${imported.length} @imported stylesheets`);

      // Find best match from both <link> tags and @import rules
      const match = pickBestMatch(
        path,
        links.concat(imported),
        item => pathFromUrl(item.href || this.linkHref(item))
      );

      if (!match) {
        // No match found - check if we should reload all stylesheets
        if (options.reloadMissingCSS !== false) {
          this.console.log(`CSS reload: no match found for '${path}', reloading all stylesheets`);

          // Reload all <link> tags
          for (const link of links) {
            await this.reattachStylesheetLink(link);
          }
        } else {
          this.console.log(`CSS reload: no match found for '${path}', skipping (reloadMissingCSS=false)`);
        }
        return;
      }

      // Route to appropriate reload method
      if (match.object.rule) {
        // It's an @import rule
        this.console.log(`CSS reload: reloading @imported stylesheet: ${match.object.href}`);
        await this.reattachImportedRule(match.object);
      } else {
        // It's a <link> tag
        this.console.log(`CSS reload: reloading stylesheet: ${this.linkHref(match.object)}`);
        await this.reattachStylesheetLink(match.object);
      }

    } catch (error) {
      this.console.error(`Stylesheet reload failed: ${error.message}`);
      this.console.error('Stack:', error.stack);
    }
  }

  // Reload a <link> or <style> tag by cloning with cache-busted URL
  async reattachStylesheetLink(link) {
    // Skip if already pending removal
    if (link.__LiveReload_pendingRemoval) {
      return;
    }

    // Mark as pending removal to prevent race conditions
    link.__LiveReload_pendingRemoval = true;

    let clone;
    if (link.tagName === 'STYLE') {
      // Prefixfree converts <link> to <style> - recreate as <link>
      clone = this.document.createElement('link');
      clone.rel = 'stylesheet';
      clone.media = link.media;
      clone.disabled = link.disabled;
    } else {
      clone = link.cloneNode(false);
    }

    clone.href = generateCacheBustUrl(this.linkHref(link));

    // Insert clone after original (both active during load)
    const parent = link.parentNode;
    if (parent.lastChild === link) {
      parent.appendChild(clone);
    } else {
      parent.insertBefore(clone, link.nextSibling);
    }

    // Wait for new stylesheet to fully load
    await waitForStylesheetLoad(clone);

    // Additional wait time for browser to apply styles (browser-specific quirk)
    const additionalWait = /AppleWebKit/.test(this.window.navigator.userAgent) ? 5 : 200;
    await new Promise(resolve => this.Timer.start(additionalWait, resolve));

    // Remove old stylesheet - clean swap complete, no FOUC
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }

    // Call prefixfree if present
    if (this.window.StyleFix) {
      this.window.StyleFix.link(clone);
    }
  }

  reloadPage() {
    this.window.location.reload();
  }

  // Get href from link or style element (prefixfree compatibility)
  linkHref(link) {
    // prefixfree uses data-href when it turns LINK into STYLE
    return link.href || (link.getAttribute && link.getAttribute('data-href'));
  }

  // Recursively collect @import rules from stylesheets
  collectImportedStylesheets(link, styleSheet, result) {
    // In WebKit, styleSheet.cssRules is null for inaccessible stylesheets
    // Firefox/Opera may throw exceptions for cross-origin sheets
    let rules;

    try {
      rules = (styleSheet || {}).cssRules;
    } catch (e) {
      // CORS error - can't access cross-origin stylesheet rules
      return;
    }

    if (rules && rules.length) {
      for (let index = 0; index < rules.length; index++) {
        const rule = rules[index];

        switch (rule.type) {
          case CSSRule.CHARSET_RULE:
            continue; // Skip charset rules
          case CSSRule.IMPORT_RULE:
            // Store imported rule with metadata
            result.push({ link, rule, index, href: rule.href });
            // Recursively collect from imported stylesheet
            this.collectImportedStylesheets(link, rule.styleSheet, result);
            break;
          default:
            break; // @import rules can only be preceded by @charset
        }
      }
    }
  }

  // Reload an @import rule by replacing it in the CSSOM
  async reattachImportedRule({ rule, index, link }) {
    const parent = rule.parentStyleSheet;
    const href = generateCacheBustUrl(rule.href);
 
    // Try to get media query - may fail due to CORS
    let media = '';
    try {
      media = rule.media.length ? [].join.call(rule.media, ', ') : '';
    } catch (e) {
      // SecurityError is thrown when accessing cross-origin stylesheet properties
      if (e.name !== 'SecurityError') {
        this.console.error(`Unexpected error accessing @import media: ${e.name}: ${e.message}`);
      }
    }

    const newRule = `@import url("${href}") ${media};`;

    // Mark this rule with new href to detect concurrent reload attempts
    rule.__LiveReload_newHref = href;

    if (this.importCacheWaitPeriod > 0) {
      // LEGACY WEBKIT WORKAROUND (~2012): Old WebKit versions reset all styles
      // if we add an @import'ed stylesheet that hasn't been cached yet.
      // Workaround: pre-cache the stylesheet by temporarily adding it as a LINK tag.
      //
      // Set importCacheWaitPeriod to 0 to disable this for modern browsers.
      const tempLink = this.document.createElement('link');
      tempLink.rel = 'stylesheet';
      tempLink.href = href;
      tempLink.__LiveReload_pendingRemoval = true; // Exclude from path matching

      if (link.parentNode) {
        link.parentNode.insertBefore(tempLink, link);
      }

      // Wait for temp link to cache the stylesheet
      await new Promise(resolve => this.Timer.start(this.importCacheWaitPeriod, resolve));

      // Remove temp link
      if (tempLink.parentNode) {
        tempLink.parentNode.removeChild(tempLink);
      }

      // If another reattachImportedRule call is in progress, abandon this one
      if (rule.__LiveReload_newHref !== href) {
        return;
      }
    }

    // Replace the @import rule in the CSSOM
    parent.insertRule(newRule, index);
    parent.deleteRule(index + 1);

    if (this.importCacheWaitPeriod > 0) {
      // Save the new rule so we can detect another reattachImportedRule call
      const updatedRule = parent.cssRules[index];
      updatedRule.__LiveReload_newHref = href;

      // Wait again and repeat "for good measure" (original behavior from 2012)
      await new Promise(resolve => this.Timer.start(this.importCacheWaitPeriod, resolve));

      // If another reattachImportedRule call is in progress, abandon this one
      if (updatedRule.__LiveReload_newHref !== href) {
        return;
      }

      // Replace again for good measure
      parent.insertRule(newRule, index);
      parent.deleteRule(index + 1);
    }
  }
}
