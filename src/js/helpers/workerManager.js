/**
 * Worker Manager for UXP Photoshop
 * 
 * Manages communication between the main thread and web workers
 * Handles operations that require access to the Photoshop API
 */

import { linkLayersByName } from '../actions/linkLayersByName.js';
import { unlinkLayersByName } from '../actions/unlinkLayersByName.js';

let worker = null;
const callbacks = new Map();
let callbackId = 0;

/**
 * Initialize the worker
 */
export function initWorker() {
  if (!worker) {
    try {
      worker = new Worker('../workers/layer-link-worker.js');
      worker.onmessage = handleWorkerMessage;
      console.log('[WorkerManager] Layer link worker initialized');
    } catch (error) {
      console.error('[WorkerManager] Failed to initialize worker:', error);
      worker = null;
    }
  }
  return !!worker;
}

/**
 * Handle messages from the worker
 */
function handleWorkerMessage(event) {
  const { status, operation, id, result, error } = event.data;
  
  if (status === 'request') {
    // Worker is requesting we perform an operation on the main thread
    handleWorkerRequest(event.data)
      .then(result => {
        worker.postMessage({
          status: 'response',
          operation,
          id,
          result
        });
      })
      .catch(error => {
        worker.postMessage({
          status: 'error',
          operation,
          id,
          error: error.message || String(error)
        });
      });
    return;
  }
  
  // Handle response to our request
  const callback = callbacks.get(id);
  if (callback) {
    if (status === 'error') {
      callback.reject(new Error(error));
    } else {
      callback.resolve(result);
    }
    callbacks.delete(id);
  }
}

/**
 * Handle worker requests to perform operations on the main thread
 */
async function handleWorkerRequest(request) {
  const { operation, data } = request;
  
  switch (operation) {
    case 'link':
      return await linkLayersByName();
    case 'unlink':
      return await unlinkLayersByName();
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Execute a function in the worker
 */
export function executeInWorker(operation, data = {}) {
  return new Promise((resolve, reject) => {
    if (!worker) {
      if (!initWorker()) {
        // If worker initialization fails, fall back to main thread
        return handleWorkerRequest({ operation, data })
          .then(resolve)
          .catch(reject);
      }
    }
    
    const id = callbackId++;
    callbacks.set(id, { resolve, reject });
    
    worker.postMessage({
      id,
      operation,
      data
    });
  });
}

/**
 * Link layers by name using the worker
 */
export async function linkLayersByNameAsync() {
  return executeInWorker('link');
}

/**
 * Unlink layers by name using the worker
 */
export async function unlinkLayersByNameAsync() {
  return executeInWorker('unlink');
}

/**
 * Clean up worker resources
 */
export function terminateWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    callbacks.clear();
    console.log('[WorkerManager] Worker terminated');
  }
}
