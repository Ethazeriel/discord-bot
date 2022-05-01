import * as db from '../database.js';
import helmet from 'helmet';
import express from 'express';
import cookieParser from 'cookie-parser';
import validator from 'validator';
import { logDebug, logLine } from '../logger.js';
import chalk from 'chalk';
import { sanitize, webClientId as webIdRegex } from '../regexes.js';
import { parentPort } from 'worker_threads';
import crypto from 'crypto';
import fs from 'fs';
const { discord, spotify } = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url)));
import * as oauth2 from '../oauth2.js';

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
app.use(cookieParser(discord.secret));

app.get('/', (req, res) => {
  logLine(req.method, [req.originalUrl]);
  // logLine('get', [`Endpoint ${chalk.blue('/')}`]);
  res.sendFile(new URL('../react/build/index.html', import.meta.url).pathname);
});

app.get('/load', async (req, res) => {
  logLine(req.method, [req.originalUrl]);
  const webId = req.signedCookies.id;
  logDebug(`Client load event with id ${webId}`);
  if (webId && webIdRegex.test(webId)) {
    const user = await db.getUserWeb(webId);
    user ? res.json(user) : res.json({ status:'new' });
  } else {
    // this user doesn't have a cookie or their cookie isn't valid
    const webClientId = crypto.randomBytes(64).toString('hex');
    res.cookie('id', webClientId, { maxAge:525600000000, httpOnly:true, secure:true, signed:true });
    res.json({ status:'new' });
  }
});

// this should just be /load, called every time a client loads
// should set a cookie if doesn't already exist
// then /oauth should hash that cookie and use as state, so that we can compare hashes to a cookie easily
// should only have a single /oauth that works with ?discord or ?spotify
// move the full axios flows to a helper function so we can call them from anywhere - have the ability to do oauth fully through discord and have a /export command?
app.get('/loaduser', async (req, res) => {
  logLine(req.method, [req.originalUrl]);
  const webId = req.signedCookies.id;
  logDebug(`Client load event with id ${webId}`);
  if (webIdRegex.test(webId)) {
    const user = await db.getUserWeb(webId);
    if (user) {
      user.status = 'known';
      user.id = crypto.randomBytes(16).toString('hex');
      res.json(user);
    } else {
      const stateId = crypto.randomBytes(16).toString('hex');
      // TODO - save this in a way that's useful to us here and can be referenced in the oauth flow - currently unused
      res.json({ status:'new', id:stateId });
    } // I hate having this duplicate else here but I can't think of a better way right now
  } else {
    // either id doesn't match spec or none was sent - assume this is new user and send id for use as discord state
    // https://discord.com/developers/docs/topics/oauth2#state-and-security
    const stateId = crypto.randomBytes(16).toString('hex');
    // TODO - save this in a way that's useful to us here and can be referenced in the oauth flow - currently unused
    res.json({ status:'new', id:stateId });
  }
});

// oauth flow
app.get('/oauth2', async (req, res) => {
  logLine(req.method, [req.originalUrl]);
  const webId = req.signedCookies.id;
  if (!(webId && webIdRegex.test(webId))) { res.status(400).send('This function requires a client ID cookie'); } else {
    const type = validator.escape(validator.stripLow((req.query?.type?.replace(sanitize, '') || ''))).trim(); // should always have this
    const idHash = crypto.createHash('sha256').update(webId).digest('base64'); // hash of the client's id to use for the oauth CSRF check
    const code = validator.escape(validator.stripLow(req.query?.code?.replace(sanitize, '') || '')).trim(); // only exists after the client approves, so use this to know what stage we're at
    const state = validator.escape(validator.stripLow(req.query?.state?.replace(sanitize, '') || '')).trim(); // only exists after client approval, use this to check for CSRF
    switch (type) {
      case 'discord': {
        if (!code) {
          res.redirect(303, `https://discord.com/oauth2/authorize?client_id=${discord.client_id}&redirect_uri=${discord.redirect_uri}&state=${idHash}&response_type=code&scope=identify%20email%20connections%20guilds%20guilds.members.read`);
        } else if (state !== idHash) { // if these don't match, something is very wrong and we need to not attempt auth
          res.status(409).end();
        } else {
          const auth = await oauth2.flow(type, code, webId);
          auth ? res.sendFile(new URL('../react/build/index.html', import.meta.url).pathname) : res.status(500).send('Server error during oauth2 flow');
        }
        break;
      }

      case 'spotify': {
        if (!code) {
          res.redirect(303, `https://accounts.spotify.com/authorize?client_id=${spotify.client_id}&redirect_uri=${spotify.redirect_uri}&state=${idHash}&show_dialog=true&response_type=code&scope=playlist-modify-private%20user-read-private`);
        } else if (state !== idHash) {
          res.status(409).end();
        } else {
          const auth = await oauth2.flow(type, code, webId);
          auth ? res.sendFile(new URL('../react/build/index.html', import.meta.url).pathname) : res.status(500).send('Server error during oauth2 flow');
        }
        break;
      }

      default: { res.status(400).end; break; }
    }
  }
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