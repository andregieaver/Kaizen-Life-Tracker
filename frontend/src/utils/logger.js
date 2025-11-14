/**
 * Logger Utility
 * Provides environment-aware logging that only outputs in development
 * Prevents console pollution in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Logger configuration
 * Can be extended with remote logging services (Sentry, LogRocket, etc.)
 */
const config = {
  enableDebug: isDevelopment,
  enableInfo: isDevelopment,
  enableWarn: true, // Always show warnings
  enableError: true, // Always show errors
  enableTrace: isDevelopment,
};

/**
 * Format log messages with timestamp and context
 */
const formatMessage = (level, context, ...args) => {
  const timestamp = new Date().toISOString();
  const prefix = context ? `[${context}]` : '';
  return [`[${timestamp}] [${level}]`, prefix, ...args].filter(Boolean);
};

/**
 * Logger object with environment-aware methods
 */
export const logger = {
  /**
   * Debug level - only in development
   * Use for detailed debugging information
   */
  debug: (context, ...args) => {
    if (config.enableDebug && !isTest) {
      console.log(...formatMessage('DEBUG', context, ...args));
    }
  },

  /**
   * Info level - only in development
   * Use for general informational messages
   */
  info: (context, ...args) => {
    if (config.enableInfo && !isTest) {
      console.info(...formatMessage('INFO', context, ...args));
    }
  },

  /**
   * Warning level - always enabled
   * Use for potentially harmful situations
   */
  warn: (context, ...args) => {
    if (config.enableWarn && !isTest) {
      console.warn(...formatMessage('WARN', context, ...args));
    }
  },

  /**
   * Error level - always enabled
   * Use for error events
   */
  error: (context, ...args) => {
    if (config.enableError && !isTest) {
      console.error(...formatMessage('ERROR', context, ...args));
    }
    
    // In production, you might want to send errors to a service
    // if (process.env.NODE_ENV === 'production') {
    //   sendToErrorTrackingService(context, args);
    // }
  },

  /**
   * Trace level - only in development
   * Use for very detailed debugging with stack traces
   */
  trace: (context, ...args) => {
    if (config.enableTrace && !isTest) {
      console.trace(...formatMessage('TRACE', context, ...args));
    }
  },

  /**
   * Group logging - useful for related logs
   */
  group: (label) => {
    if (isDevelopment && !isTest) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (isDevelopment && !isTest) {
      console.groupEnd();
    }
  },

  /**
   * Table logging - useful for arrays/objects
   */
  table: (data) => {
    if (isDevelopment && !isTest) {
      console.table(data);
    }
  },

  /**
   * Time logging - useful for performance monitoring
   */
  time: (label) => {
    if (isDevelopment && !isTest) {
      console.time(label);
    }
  },

  timeEnd: (label) => {
    if (isDevelopment && !isTest) {
      console.timeEnd(label);
    }
  },
};

/**
 * Legacy support - direct console.log replacement
 * Use logger.debug() instead for new code
 */
export const log = (...args) => logger.debug(null, ...args);

export default logger;
