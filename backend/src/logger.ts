import pino from "pino"

export default pino({
    level: process.env.PINO_LOG_LEVEL || 'debug',
});