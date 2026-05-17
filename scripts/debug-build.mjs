// Debug instrumentation for build error
const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, '.cursor', 'debug-b28e8c.log');

function log(data) {
  const entry = JSON.stringify({
    sessionId: 'b28e8c',
    timestamp: Date.now(),
    ...data
  }) + '\n';
  fs.appendFileSync(logPath, entry);
}

log({ message: 'Build started', phase: process.env.NEXT_PHASE });

// Check env at startup
log({ 
  message: 'Environment check', 
  data: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PHASE: process.env.NEXT_PHASE,
    DATABASE_URL_SET: !!process.env.DATABASE_URL
  }
});

module.exports = { log };