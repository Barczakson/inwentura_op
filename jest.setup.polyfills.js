// Polyfill for Response object in Node.js environment
if (typeof Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      // Simple implementation for testing purposes
    }
  };
}