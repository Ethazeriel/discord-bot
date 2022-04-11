import * as db from '../database.js';
import helmet from 'helmet';
import express from 'express';
import path from 'path';
import { logLine } from '../logger.js';
import chalk from 'chalk';
import { sanitize } from '../regexes.js';
import { parentPort } from 'worker_threads';
import crypto from 'crypto';

parentPort.on('message', async data => {
  if (data.action === 'exit') {
    logLine('info', ['Worker exiting']);
    await db.closeDB();
    process.exit();
  }
});

const app = express();
const port = 2468;

app.use(helmet());
app.use(express.static('./react/build'));
app.use(express.json());

app.get('/', (req, res) => {
  logLine(req.method, [req.originalUrl]);
  // logLine('get', [`Endpoint ${chalk.blue('/')}`]);
  res.sendFile(path.resolve(__dirname, './react/build', 'index.html'));
});

// returns a track for the given id
app.get('/tracks/:type(youtube|goose|spotify)-:id([\\w-]{11}|[a-zA-Z0-9]{22}|[0-9a-f]{10})', async (req, res) => {
  logLine(req.method, [req.originalUrl]);
  // logLine('get', [`Endpoint ${chalk.blue('/tracks')}, type ${chalk.green(req.params.type)}, id ${chalk.green(req.params.id)}`]);
  const search = `${req.params.type}.id`;
  const track = await db.getTrack({ [search]:req.params.id });
  res.json(track);
});

// returns a playlist
// this regex should match sanitizePlaylists, but without the not
app.get('/playlist/:name([\\w :/?=&-]+)', async (req, res) => {
  logLine(req.method, [req.originalUrl]);
  // logLine('get', [`Endpoint ${chalk.blue('/playlist')}, name ${chalk.green(req.params.name)}`]);
  const result = await db.getPlaylist(req.params.name);
  res.json(result);
});

// returns the list of playlists
app.get('/playlists', async (req, res) => {
  logLine(req.method, [req.originalUrl]);
  // logLine('get', [`Endpoint ${chalk.blue('/playlists')}`]);
  res.json(Array.from(await db.listPlaylists()));
});

// returns the queue for the player with the given id
app.get('/player-:playerId([0-9]{18})', async (req, res) => {
  logLine(req.method, [req.originalUrl]);
  const id = crypto.randomBytes(5).toString('hex');
  parentPort.postMessage({ type:'player', action:'get', id:id, playerId:req.params.playerId });
  const messageAction = (result) => {
    if (result?.id === id) { res.json(result); }
    parentPort.removeListener('message', messageAction);
  };
  parentPort.on('message', messageAction);
});

// take actions on the player with the given id
app.post('/player', async (req, res) => {
  const action = req.body?.action?.replace(sanitize, '');
  const playerId = req.body?.playerId?.replace(sanitize, '') || '888246961097048065';
  logLine(req.method, [req.originalUrl, chalk.green(action)]);
  // logLine('post', [`Endpoint ${chalk.blue('/player')}, code ${chalk.green(req.body.code)}`]);
  const id = crypto.randomBytes(5).toString('hex');
  parentPort.postMessage({ type:'player', action:action, id:id, playerId:playerId });
  const messageAction = (result) => {
    if (result?.id === id) { res.json(result); }
    parentPort.removeListener('message', messageAction);
  };
  parentPort.on('message', messageAction);
  // res.json(result);
});

app.listen(port, () => {
  logLine('info', [`Web server active at http://localhost:${port}`]);
});