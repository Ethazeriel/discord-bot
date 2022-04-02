import * as db from './database.js';
import helmet from 'helmet';
import express from 'express';
import path from 'path';
import { logLine } from './logger.js';
import chalk from 'chalk';

const app = express();
const port = 2468;

app.use(helmet());
app.use(express.static('./react/build'));
app.use(express.json());


app.get('/', (req, res) => {
  logLine('get', [`Endpoint ${chalk.blue('/')}`]);
  res.sendFile(path.resolve(__dirname, './react/build', 'index.html'));
});


app.get('/tracks/:type(youtube|goose|spotify)-:id([\\w-]{11}|[a-zA-Z0-9]{22}|[0-9a-f]{10})', async (req, res) => {
  logLine('get', [`Endpoint ${chalk.blue('/tracks')}, type ${chalk.green(req.params.type)}, id ${chalk.green(req.params.id)}`]);
  const search = `${req.params.type}.id`;
  const track = await db.getTrack({ [search]:req.params.id });
  res.json(track);
});

app.listen(port, () => {
  logLine('info', [`Web server active at http://localhost:${port}`]);
});