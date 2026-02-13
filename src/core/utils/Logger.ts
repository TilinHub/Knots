export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

export class Logger {
    private static currentLevel: LogLevel = LogLevel.INFO;
    private static filters: string[] = []; // Empty means all allowed

    static setLevel(level: LogLevel) {
        this.currentLevel = level;
    }

    static setFilters(modules: string[]) {
        this.filters = modules;
    }

    private static shouldLog(level: LogLevel, module: string): boolean {
        if (level < this.currentLevel) return false;
        if (this.filters.length > 0 && !this.filters.includes(module)) return false;
        return true;
    }

    static debug(module: string, message: string, data?: any) {
        if (this.shouldLog(LogLevel.DEBUG, module)) {
            console.debug(`[${module}] ${message}`, data || '');
        }
    }

    static info(module: string, message: string, data?: any) {
        if (this.shouldLog(LogLevel.INFO, module)) {
            console.info(`%c[${module}] ${message}`, 'color: #00bcd4; font-weight: bold;', data || '');
        }
    }

    static warn(module: string, message: string, data?: any) {
        if (this.shouldLog(LogLevel.WARN, module)) {
            console.warn(`[${module}] ${message}`, data || '');
        }
    }

    static error(module: string, message: string, error?: any) {
        if (this.shouldLog(LogLevel.ERROR, module)) {
            console.error(`[${module}] ${message}`, error || '');
        }
    }

    /**
     * Wraps a function with logging.
     * @param module The module name for the log.
     * @param fnName The name of the function being wrapped.
     * @param fn The function to wrap.
     */
    static withLog<T extends (...args: any[]) => any>(module: string, fnName: string, fn: T): T {
        return ((...args: Parameters<T>): ReturnType<T> => {
            this.debug(module, `calling ${fnName}`, args);
            try {
                const result = fn(...args);
                this.debug(module, `${fnName} returned`, result);
                return result;
            } catch (error) {
                this.error(module, `${fnName} failed`, error);
                throw error;
            }
        }) as T;
    }

    static LogLevel = LogLevel;
}

// Expose to window for runtime control
(window as any).AppLogger = Logger;
