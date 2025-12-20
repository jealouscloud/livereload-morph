#!/usr/bin/env node

/**
 * Test server for live-morph development
 * Starts an HTTP server and LiveReload server to test morphing functionality
 */

import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import livereload from 'livereload';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;
const LIVERELOAD_PORT = 35729;

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Simple HTTP server
const server = createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Strip query string (for cache-busting URLs like styles.css?livereload=123)
  const urlPath = req.url.split('?')[0];

  let filePath = join(__dirname, urlPath === '/' ? '/test/index.html' : urlPath);

  // Handle /test/ prefix
  if (urlPath.startsWith('/test/')) {
    filePath = join(__dirname, urlPath);
  } else if (urlPath.startsWith('/dist/')) {
    filePath = join(__dirname, urlPath);
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  // Check if it's a directory
  if (statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  try {
    const content = readFileSync(filePath);
    const ext = extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    res.writeHead(500);
    res.end(`Error: ${error.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`\n🌐 HTTP Server running at http://localhost:${PORT}/test/`);
  console.log(`   Open http://localhost:${PORT}/test/ in your browser\n`);
});

// Start LiveReload server
const lrServer = livereload.createServer({
  port: LIVERELOAD_PORT,
  exts: ['html', 'css', 'js'],
  debug: true
});

// Watch test directory and dist directory
lrServer.watch([
  join(__dirname, 'test'),
  join(__dirname, 'dist')
]);

console.log(`🔄 LiveReload server running on port ${LIVERELOAD_PORT}`);
console.log(`   Watching: test/ and dist/\n`);
console.log(`📝 Test Instructions:`);
console.log(`   1. Open http://localhost:${PORT}/test/ in your browser`);
console.log(`   2. Edit test/index.html - content should morph without reload`);
console.log(`   3. Edit test/styles.css - styles should update without flash`);
console.log(`   4. Check browser console with verbose logging enabled\n`);
console.log(`💡 Tip: Type in the input field, then edit HTML to test state preservation\n`);
