// Split URL into url, params, and hash components
export function splitUrl(url) {
  let hash = '';
  let params = '';
  let index = url.indexOf('#');

  if (index >= 0) {
    hash = url.slice(index);
    url = url.slice(0, index);
  }

  // Handle combo URLs: http://domain.com/path/??file1.css,file2.css
  const comboSign = url.indexOf('??');

  if (comboSign >= 0) {
    if ((comboSign + 1) !== url.lastIndexOf('?')) {
      index = url.lastIndexOf('?');
    }
  } else {
    index = url.indexOf('?');
  }

  if (index >= 0) {
    params = url.slice(index);
    url = url.slice(0, index);
  }

  return { url, params, hash };
}

// Extract path from full URL (removes protocol, host, port)
export function pathFromUrl(url) {
  if (!url) {
    return '';
  }

  let path;
  ({ url } = splitUrl(url));

  if (url.indexOf('file://') === 0) {
    path = url.replace(new RegExp('^file://(localhost)?'), '');
  } else {
    // Remove http://hostname:8080/
    path = url.replace(new RegExp('^([^:]+:)?//([^:/]+)(:\\d*)?/'), '/');
  }

  return decodeURIComponent(path);
}

// Count matching path segments from the end (right to left)
export function numberOfMatchingSegments(left, right) {
  left = left.replace(/^\/+/, '').toLowerCase();
  right = right.replace(/^\/+/, '').toLowerCase();

  if (left === right) {
    return 10000; // Exact match gets high score
  }

  const comps1 = left.split(/\/|\\/).reverse();
  const comps2 = right.split(/\/|\\/).reverse();
  const len = Math.min(comps1.length, comps2.length);

  let eqCount = 0;

  while ((eqCount < len) && (comps1[eqCount] === comps2[eqCount])) {
    ++eqCount;
  }

  return eqCount;
}

// Pick best matching object from collection based on path similarity
export function pickBestMatch(path, objects, pathFunc = s => s) {
  let bestMatch = { score: 0 };

  for (const object of objects) {
    const score = numberOfMatchingSegments(path, pathFunc(object));

    if (score > bestMatch.score) {
      bestMatch = { object, score };
    }
  }

  if (bestMatch.score === 0) {
    return null;
  }

  return bestMatch;
}

// Generate cache-busting URL by appending timestamp
export function generateCacheBustUrl(url) {
  const { url: cleanUrl, params, hash } = splitUrl(url);
  const separator = params ? '&' : '?';
  return `${cleanUrl}${params}${separator}livereload=${Date.now()}${hash}`;
}

// Wait for stylesheet to load using onload event and polling fallback
export function waitForStylesheetLoad(linkElement, timeout = 15000) {
  return new Promise((resolve) => {
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    // Try onload event (supported by modern browsers)
    linkElement.onload = () => {
      finish();
    };

    // Polling fallback for browsers that don't support onload
    const pollInterval = 50;
    const startTime = Date.now();

    const poll = () => {
      if (resolved) return;

      // Check if stylesheet is loaded by accessing sheet property
      if (linkElement.sheet) {
        finish();
        return;
      }

      // Timeout check
      if (Date.now() - startTime > timeout) {
        finish();
        return;
      }

      setTimeout(poll, pollInterval);
    };

    // Start polling after a short delay (gives onload a chance to fire)
    setTimeout(poll, pollInterval);

    // Absolute timeout failsafe
    setTimeout(finish, timeout);
  });
}
