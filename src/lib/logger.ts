/**
 * Simple structured logger for the Serenity application
 * Provides consistent log formatting with timestamps and severity levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get minimum log level from environment (default: info in production, debug in development)
const MIN_LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL];
}

function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    `[${entry.module}]`,
    entry.message,
  ];

  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context));
  }

  if (entry.error) {
    parts.push(`| Error: ${entry.error.name}: ${entry.error.message}`);
  }

  return parts.join(' ');
}

function createLogEntry(
  level: LogLevel,
  module: string,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
  };

  if (context) {
    entry.context = context;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return entry;
}

function log(level: LogLevel, module: string, message: string, context?: LogContext, error?: Error) {
  if (!shouldLog(level)) return;

  const entry = createLogEntry(level, module, message, context, error);
  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'debug':
      console.debug(formatted);
      break;
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      if (entry.error?.stack) {
        console.error(entry.error.stack);
      }
      break;
  }
}

/**
 * Creates a logger instance for a specific module
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, context?: LogContext) => log('debug', module, message, context),
    info: (message: string, context?: LogContext) => log('info', module, message, context),
    warn: (message: string, context?: LogContext, error?: Error) => log('warn', module, message, context, error),
    error: (message: string, context?: LogContext, error?: Error) => log('error', module, message, context, error),
  };
}

/**
 * Utility to safely extract error details
 */
export function getErrorDetails(error: unknown): { message: string; code?: string; name: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: (error as any).code,
    };
  }
  return {
    name: 'UnknownError',
    message: String(error),
  };
}

/**
 * Create a standardized API error response
 */
export function createErrorResponse(
  message: string, 
  statusCode: number = 500,
  details?: Record<string, unknown>
) {
  return {
    success: false,
    error: message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a standardized API success response
 */
export function createSuccessResponse<T>(data: T, meta?: Record<string, unknown>) {
  return {
    success: true,
    ...data,
    ...(meta && { meta }),
    timestamp: new Date().toISOString(),
  };
}
