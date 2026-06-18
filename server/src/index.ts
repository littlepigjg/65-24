import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { initStorage } from './utils/storage';
import configRouter from './routes/config';
import syncRouter from './routes/sync';
import conflictsRouter from './routes/conflicts';
import recordsRouter from './routes/records';
import { syncEngine } from './modules/SyncEngine';

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_DIST_DIR = path.join(__dirname, '..', 'client-dist');

app.use(cors());
app.use(express.json());

app.use('/api/config', configRouter);
app.use('/api/sync', syncRouter);
app.use('/api/conflicts', conflictsRouter);
app.use('/api/records', recordsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

if (fs.pathExistsSync(CLIENT_DIST_DIR)) {
  app.use(express.static(CLIENT_DIST_DIR));
  
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  });
}

async function startServer() {
  try {
    await initStorage();
    console.log('[Storage] Initialized');

    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });

    if (process.env.AUTO_START !== 'false') {
      await syncEngine.start();
    }
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('[Server] Shutting down...');
  await syncEngine.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Server] Shutting down...');
  await syncEngine.stop();
  process.exit(0);
});

startServer();
