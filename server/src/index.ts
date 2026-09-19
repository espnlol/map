import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { router } from './routes';
import { Datasets } from './lib/datasets';

const app = express();
app.use(express.json());
app.use('/api', router);

const clientDist = path.join(__dirname, '..', '..', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

const PORT = Number(process.env.PORT ?? 8787);
app.listen(PORT, () => {
  console.log(`Fourth Quarter API listening on http://localhost:${PORT}`);
  // Rebuilding weekly stats from play-by-play is the slowest step (a minute-plus, cold). Kick it off now so
  // it's likely warm by the time someone's finished setting up their roster instead of stalling their first lookup.
  Datasets.playerStats()
    .then(() => console.log('[startup] weekly player stats warmed'))
    .catch((err) => console.warn('[startup] failed to warm weekly player stats:', (err as Error).message));
});
