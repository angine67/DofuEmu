function ts() {
  return new Date().toISOString()
}

function safe(fn: (...a: unknown[]) => void, ...args: unknown[]) {
  try { fn(...args) } catch {}
}

export const logger = {
  info: (...args: unknown[]) => safe(console.log, `[${ts()}] [INFO]`, ...args),
  warn: (...args: unknown[]) => safe(console.warn, `[${ts()}] [WARN]`, ...args),
  error: (...args: unknown[]) => safe(console.error, `[${ts()}] [ERROR]`, ...args),
  debug: (...args: unknown[]) => safe(console.debug, `[${ts()}] [DEBUG]`, ...args)
}
