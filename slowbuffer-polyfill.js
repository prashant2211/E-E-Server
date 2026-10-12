// Polyfill for SlowBuffer (removed in Node.js v25)
// This is needed for buffer-equal-constant-time package compatibility
// Must be loaded before any modules that use buffer-equal-constant-time

const Module = require('module');
const originalRequire = Module.prototype.require;

// Intercept require calls to patch buffer module
Module.prototype.require = function(id) {
  const result = originalRequire.apply(this, arguments);
  
  // Patch buffer module if it's being required
  if (id === 'buffer' && result && !result.SlowBuffer) {
    const { Buffer } = result;
    
    // Create SlowBuffer as a function that behaves like the old SlowBuffer class
    function SlowBuffer(...args) {
      if (!(this instanceof SlowBuffer)) {
        return new SlowBuffer(...args);
      }
      return Buffer.apply(this, args);
    }
    
    // Set up prototype chain
    Object.setPrototypeOf(SlowBuffer.prototype, Buffer.prototype);
    Object.setPrototypeOf(SlowBuffer, Buffer);
    
    // Copy static methods and properties
    Object.getOwnPropertyNames(Buffer).forEach(name => {
      if (name !== 'prototype' && name !== 'length' && name !== 'name') {
        try {
          SlowBuffer[name] = Buffer[name];
        } catch (e) {
          // Ignore read-only properties
        }
      }
    });
    
    // Add SlowBuffer to buffer module
    result.SlowBuffer = SlowBuffer;
    
    // Also make it available globally
    if (typeof global !== 'undefined') {
      global.SlowBuffer = SlowBuffer;
    }
  }
  
  return result;
};

// Also patch it immediately for already-loaded buffer module
const buffer = require('buffer');
if (buffer && !buffer.SlowBuffer) {
  const { Buffer } = buffer;
  
  function SlowBuffer(...args) {
    if (!(this instanceof SlowBuffer)) {
      return new SlowBuffer(...args);
    }
    return Buffer.apply(this, args);
  }
  
  Object.setPrototypeOf(SlowBuffer.prototype, Buffer.prototype);
  Object.setPrototypeOf(SlowBuffer, Buffer);
  
  Object.getOwnPropertyNames(Buffer).forEach(name => {
    if (name !== 'prototype' && name !== 'length' && name !== 'name') {
      try {
        SlowBuffer[name] = Buffer[name];
      } catch (e) {
        // Ignore
      }
    }
  });
  
  buffer.SlowBuffer = SlowBuffer;
  if (typeof global !== 'undefined') {
    global.SlowBuffer = SlowBuffer;
  }
}

