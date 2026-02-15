type LogLevel = 'INFO' | 'WARN' | 'ERROR'

type LogPayload = Record<string, unknown>

function writeLog(level: LogLevel, event: string, payload: LogPayload = {}) {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...payload
  }
  const serialized = JSON.stringify(entry)

  if (level === 'ERROR') {
    console.error(serialized)
    return
  }

  if (level === 'WARN') {
    console.warn(serialized)
    return
  }

  console.log(serialized)
}

export function logInfo(event: string, payload: LogPayload = {}) {
  writeLog('INFO', event, payload)
}

export function logWarn(event: string, payload: LogPayload = {}) {
  writeLog('WARN', event, payload)
}

export function logError(event: string, payload: LogPayload = {}) {
  writeLog('ERROR', event, payload)
}
