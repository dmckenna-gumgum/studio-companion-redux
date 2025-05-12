/**
 * Creates a deep "plain" snapshot of an object, effectively unwrapping proxies
 * for logging or other purposes where a simple, non-proxied representation is needed.
 * @param {*} data - The object, array, or primitive to snapshot.
 * @returns {*} - A plain JavaScript object/array/primitive.
 */
function getPlainObjectSnapshot(data, visited = new WeakSet()) { // Add 'visited' parameter
    if (typeof data !== 'object' || data === null) {
      return data; // Return primitives or null as is
    }
  
    if (data instanceof Date) {
      return new Date(data.getTime()); // Clone dates
    }
  
    // --- Circular reference detection ---
    if (visited.has(data)) {
      return "[Circular]"; // Or null, or a specific object, as you prefer
    }
    visited.add(data);
    // --- End circular reference detection ---
  
    if (Array.isArray(data)) {
      const plainArray = [];
      for (const item of data) {
        plainArray.push(getPlainObjectSnapshot(item, visited)); // Pass 'visited' along
      }
      visited.delete(data); // Clean up after processing this object's children
      return plainArray;
    }
  
    // For generic objects, create a new plain object
    const plainObject = {};
    for (const key in data) {
      // Ensure it's an own property and not from the prototype chain
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // Check if the property itself might be problematic (e.g. some DOM properties)
        // This check is basic; more sophisticated checks might be needed for specific complex objects
        if (typeof data[key] === 'function' && key.startsWith('on')) {
             plainObject[key] = '[Function EventHandler]'; // Or skip
        } else if ((typeof Element !== 'undefined' && data[key] instanceof Element) || (typeof Window !== 'undefined' && data[key] instanceof Window)) { 
             plainObject[key] = `[DOM Element: ${data[key].constructor.name}]`; // Or a more concise placeholder
        } else {
             plainObject[key] = getPlainObjectSnapshot(data[key], visited); // Pass 'visited' along
        }
      }
    }
    visited.delete(data); // Clean up after processing this object's children
    return plainObject;
  }


const LOG_LEVELS = {
  DEBUG: 1,
  INFO: 2,
  LOG: 2, // Alias for INFO
  WARN: 3,
  ERROR: 4,
  NONE: 5, // To disable all logs from a specific logger or globally
};

// Default global level: show all logs during development.
// You can change this in your main plugin entry point.
let globalLogLevel = LOG_LEVELS.DEBUG;

/**
 * Sets the global minimum log level for all created loggers.
 * @param {string} levelName - One of 'DEBUG', 'INFO', 'LOG', 'WARN', 'ERROR', 'NONE'.
 */
export function setGlobalLogLevel(levelName) {
  const level = LOG_LEVELS[String(levelName).toUpperCase()];
  if (level) {
    globalLogLevel = level;
    // console.log(`[GlobalLogger] Global log level set to: ${levelName}`); // Meta-log
  } else {
    console.warn(`[GlobalLogger] Unknown log level: ${levelName}. Global level remains: ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === globalLogLevel)}`);
  }
}

/**
 * Creates a new logger instance.
 * @param {object} [config={}] - Configuration for the logger.
 * @param {string} [config.prefix=''] - A prefix string to prepend to messages (e.g., 'Editor', 'MyModule').
 * @param {string} [config.initialLevel='DEBUG'] - The initial log level for this specific logger instance.
 * @returns {object} Logger instance with debug, log, info, warn, error methods.
 */
export function createLogger(config = {}) {
  const { prefix = '', initialLevel = 'DEBUG' } = config;
  let _loggerLevel = LOG_LEVELS[String(initialLevel).toUpperCase()] || globalLogLevel;
  const formatArgs = (originalArgs) => {
    return Array.from(originalArgs).map(arg =>
      typeof arg === 'object' && arg !== null ? getPlainObjectSnapshot(arg) : arg
    );
  };

  const logMessage = (nativeConsoleMethod, levelString, messageArgs) => {
    const timestamp = new Date().toISOString();
    const fullPrefix = `${timestamp} ${levelString.padEnd(5)} ${prefix ? `[${prefix}]` : ''}`.trim();
    nativeConsoleMethod.apply(console, [fullPrefix, ...formatArgs(messageArgs)]);
  };
  
  const canLog = (level) => level >=_loggerLevel && level >= globalLogLevel;

  const loggerInstance = {
    /**
     * Sets the log level for this specific logger instance.
     * @param {string} levelName - One of 'DEBUG', 'INFO', 'LOG', 'WARN', 'ERROR', 'NONE'.
     */
    setLogLevel(levelName) {
      const level = LOG_LEVELS[String(levelName).toUpperCase()];
      if (level) {
       _loggerLevel = level;
       console.log(`[Logger][${prefix}] Log level set to: ${levelName}`);
      } else {
        const currentLevelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] ===_loggerLevel);
        console.warn(`[Logger][${prefix}] Unknown log level: ${levelName}. Logger level remains: ${currentLevelName}`);
      }
    },
    debug: (...args) => {
      if (canLog(LOG_LEVELS.DEBUG)) {
        logMessage(console.debug, 'DEBUG\n', args);
      }
    },
    log: (...args) => { // Consistent with .info
      if (canLog(LOG_LEVELS.LOG)) {
        logMessage(console.log, 'INFO\n', args);
      }
    },
    info: (...args) => {
      if (canLog(LOG_LEVELS.INFO)) {
        logMessage(console.info, 'INFO\n', args);
      }
    },
    warn: (...args) => {
      if (canLog(LOG_LEVELS.WARN)) {
        logMessage(console.warn, 'WARN\n', args);
      }
    },
    error: (...args) => {
      if (canLog(LOG_LEVELS.ERROR)) {
        logMessage(console.error, 'ERROR\n', args);
      }
    },
    /**
     * Gets the current effective log level for this logger instance (considering global level).
     * @returns {string} The name of the current log level.
     */
    getCurrentLevelName() {
        const effectiveLevel = Math.max(_loggerLevel, globalLogLevel);
        return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === effectiveLevel) || 'UNKNOWN';
    }
  };
  
  // Initial log to show logger is created and its effective level
  // loggerInstance.debug(`Logger created. Effective level: ${loggerInstance.getCurrentLevelName()}`);

  return loggerInstance;
}