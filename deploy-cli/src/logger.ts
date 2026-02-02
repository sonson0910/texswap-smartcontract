import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';

export const createLogger = async (logFile: string): Promise<pino.Logger> => {
    // Ensure log directory exists
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    const streams = [
        { stream: pino.destination(logFile) },
        {
            stream: (await import('pino-pretty')).default({
                colorize: true,
                sync: true,
            }),
        },
    ];

    return pino(
        {
            level: 'info',
            base: undefined,
        },
        pino.multistream(streams),
    );
};
