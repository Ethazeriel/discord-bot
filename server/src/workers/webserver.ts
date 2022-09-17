import * as db from '../database.js';
import helmet from 'helmet';
import express from 'express';
import cookie from 'cookie';
import cookieParser from 'cookie-parser';
import validator from 'validator';
import { logDebug, log } from '../logger.js';
import chalk from 'chalk';
import { sanitize, webClientId as webIdRegex } from '../regexes.js';
import { parentPort } from 'worker_threads';
import crypto from 'crypto';
import fs from 'fs';
const { discord, spotify, napster, root_url } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../config.json', import.meta.url).toString()), 'utf-8'));
import * as oauth2 from '../oauth2.js';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';


parentPort!.on('message', async data => {
  if (data.action === 'exit') {
    log('info', ['Worker exiting']);
    await db.closeDB();
    process.exit();
  }
});

const app = express();
const port = 2468;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      // eslint-disable-next-line quotes
      'img-src': ["'self'", 'https://i.scdn.co', 'https://i.ytimg.com'],
    },
  },
}));
// app.use(express.static('./react/build'));
app.use(express.json());
app.use(cookieParser(discord.secret));

app.get('/', (req, res) => {
  // we're behind a proxy, this should never get hit
  log(req.method, [req.originalUrl]);
  // log('get', [`Endpoint ${chalk.blue('/')}`]);
  res.redirect(302, root_url);
});

// minimum requirements for endpoints
app.get('/example-endpoint', async (req, res) => {
  log(req.method, [req.originalUrl]);
  const webId = req.signedCookies.id;
  if (!(webId && webIdRegex.test(webId))) { res.status(400).send('ID Cookie not set or invalid'); } else {
    const user = await db.getUserWeb(webId);
    if (!user) { res.status(401).send('User not authenticated'); } else {
      // now we know the user has authed, we can do things
      res.json({ error:'This endpoint does nothing!' });
    }
  }
});

app.get('/load', async (req, res) => {
  log(req.method, [req.originalUrl]);
  const webId = req.signedCookies.id;
  logDebug(`Client load event with id ${webId}`);
  if (webId && webIdRegex.test(webId)) {
    const user:WebUser & {player?:PlayerStatus} | undefined = await db.getUserWeb(webId);
    if (user) {
      const id = crypto.randomBytes(5).toString('hex');
      parentPort!.postMessage({ type:'player', action: 'get', id: id, userId: user.discord.id });
      const messageAction = (result:WebParentMessage) => {
        if (result?.id === id) {
          if (!result.error) { user.player = result.status; }
          res.json({ user: user, player:result.status });
          parentPort!.removeListener('message', messageAction);
        }
      };
      parentPort!.on('message', messageAction);
    } else { res.json({ user: { status: 'new' } }); }
  } else {
    // this user doesn't have a cookie or their cookie isn't valid
    const webClientId = crypto.randomBytes(64).toString('hex');
    res.cookie('id', webClientId, { maxAge:525600000000, httpOnly:true, secure:true, signed:true });
    res.json({ user: { status: 'new' } });
  }
});

// oauth flow
app.get('/oauth2', async (req, res) => {
  log(req.method, [req.originalUrl]);
  const webId = req.signedCookies.id;
  if (!(webId && webIdRegex.test(webId))) { res.status(400).send('This function requires a client ID cookie'); } else {
    const type = validator.escape(validator.stripLow(((req.query?.type as string)?.replace(sanitize, '') || ''))).trim(); // should always have this
    const idHash = crypto.createHash('sha256').update(webId).digest('hex'); // hash of the client's id to use for the oauth CSRF check
    const code = validator.escape(validator.stripLow((req.query?.code as string)?.replace(sanitize, '') || '')).trim(); // only exists after the client approves, so use this to know what stage we're at
    const state = validator.escape(validator.stripLow((req.query?.state as string)?.replace(sanitize, '') || '')).trim(); // only exists after client approval, use this to check for CSRF
    switch (type) {
      case 'discord': {
        if (!code) {
          res.redirect(303, `https://discord.com/oauth2/authorize?client_id=${discord.client_id}&redirect_uri=${discord.redirect_uri}&state=${idHash}&response_type=code&scope=identify%20email%20connections%20guilds%20guilds.members.read`);
        } else if (state !== idHash) { // if these don't match, something is very wrong and we need to not attempt auth
          res.status(409).end();
        } else {
          const auth = await oauth2.flow(type, code, webId);
          auth ? res.redirect(302, root_url) : res.status(500).send('Server error during oauth2 flow');
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
          auth ? res.redirect(302, root_url) : res.status(500).send('Server error during oauth2 flow');
        }
        break;
      }

      case 'napster': {
        if (!code) {
          res.redirect(303, `https://api.napster.com/oauth/authorize?client_id=${napster.client_id}&redirect_uri=${napster.redirect_uri}&state=${idHash}&response_type=code`);
        } else if (state !== idHash) {
          res.status(409).end();
        } else {
          const auth = await oauth2.flow(type, code, webId);
          auth ? res.redirect(302, root_url) : res.status(500).send('Server error during oauth2 flow');
        }
        break;
      }

      default: { res.status(400).end; break; }
    }
  }
});

// returns a track for the given id
app.get('/tracks/:type(youtube|goose|spotify)-:id([\\w-]{11}|[a-zA-Z0-9]{22}|[0-9a-f]{10})', async (req, res) => {
  log(req.method, [req.originalUrl]);
  // log('get', [`Endpoint ${chalk.blue('/tracks')}, type ${chalk.green(req.params.type)}, id ${chalk.green(req.params.id)}`]);
  const webId = req.signedCookies.id;
  if (!(webId && webIdRegex.test(webId))) { res.status(400).send('ID Cookie not set or invalid'); } else {
    const user = await db.getUserWeb(webId);
    if (!user) { res.status(401).send('User not authenticated'); } else {
      const search = `${req.params.type}.id`;
      const track = await db.getTrack({ [search]:req.params.id });
      res.json(track);
    }
  }
});

// returns a playlist
// this regex should match sanitizePlaylists, but without the not
app.get('/playlist/:name([\\w :/?=&-]+)', async (req, res) => {
  log(req.method, [req.originalUrl]);
  // log('get', [`Endpoint ${chalk.blue('/playlist')}, name ${chalk.green(req.params.name)}`]);
  const webId = req.signedCookies.id;
  if (!(webId && webIdRegex.test(webId))) { res.status(400).send('ID Cookie not set or invalid'); } else {
    const user = await db.getUserWeb(webId);
    if (!user) { res.status(401).send('User not authenticated'); } else {
      const result = await db.getPlaylist(req.params.name);
      res.json(result);
    }
  }
});

// returns the list of playlists
app.get('/playlists', async (req, res) => {
  log(req.method, [req.originalUrl]);
  // log('get', [`Endpoint ${chalk.blue('/playlists')}`]);
  const webId = req.signedCookies.id;
  if (!(webId && webIdRegex.test(webId))) { res.status(400).send('ID Cookie not set or invalid'); } else {
    const user = await db.getUserWeb(webId);
    if (!user) { res.status(401).send('User not authenticated'); } else {
      res.json(Array.from((await db.listPlaylists())!.values()));
    }
  }
});

// returns the queue for the player with the given id
app.get('/player-:playerId([0-9]{18})', async (req, res) => {
  log(req.method, [req.originalUrl]);
  const webId = req.signedCookies.id;
  if (!(webId && webIdRegex.test(webId))) { res.status(400).send('ID Cookie not set or invalid'); } else {
    const user = await db.getUserWeb(webId);
    if (!user) { res.status(401).send('User not authenticated'); } else {
      const id = crypto.randomBytes(5).toString('hex');
      parentPort!.postMessage({ type:'player', action:'get', id:id, playerId:req.params.playerId });
      const messageAction = (result:WebParentMessage) => {
        if (result?.id === id) {
          res.json(result);
          parentPort!.removeListener('message', messageAction);
        }
      };
      parentPort!.on('message', messageAction);
    }
  }
});

// take actions on the player with the given id
app.post('/player', async (req, res) => {
  const webId = req.signedCookies.id;
  logDebug(`Client load event with id ${webId}`);
  if (webId && webIdRegex.test(webId)) {
    const user = await db.getUserWeb(webId);
    if (user) {
      const action = validator.escape(validator.stripLow(req.body?.action?.replace(sanitize, '') || '')).trim();
      const parameter = validator.escape(validator.stripLow(('' + req.body?.parameter)?.replace(sanitize, '') || '')).trim();
      log(req.method, [req.originalUrl, chalk.green(action)]);
      // log('post', [`Endpoint ${chalk.blue('/player')}, code ${chalk.green(req.body.code)}`]);
      const id = crypto.randomBytes(5).toString('hex');
      parentPort!.postMessage({ type:'player', action:action, parameter:parameter, id:id, userId: user.discord.id });
      const messageAction = (result:WebParentMessage) => {
        if (result?.id === id) {
          res.json(result);
          parentPort!.removeListener('message', messageAction);
        }
      };
      parentPort!.on('message', messageAction);
    } else { res.status(401).json({ error: 'You need to authenticate with Discord.' }); }
  } else { res.status(400).json({ error: 'ID Cookie not set or invalid.' }); }
});


// Websocket


const httpServer = app.listen(port, () => {
  log('info', [`Web server active at http://localhost:${port}`]);
});

const wss = new WebSocketServer<WebSocket & {isAlive:boolean}>({ server: httpServer, clientTracking: true });
// httpServer.on('upgrade', (request, socket, head) => {
//   wss.handleUpgrade(request, socket, head, (ws) => {
//     logDebug('WebSocket upgrade event—have not tested if this works.');
//     wss.emit('connection', ws, request);
//   });
// }); commenting this out because it makes us crash
const wssInterval = setInterval(() => {
  for (const client of wss.clients) {
    if (client.isAlive === false) {
      logDebug('wssInterval, terminating client');
      client.terminate();
      logDebug(`clients' size: ${wss.clients.size}`);
    } else {
      logDebug('wssInterval, pinging client');
      client.isAlive = false;
      client.ping();
    }
  }
}, 15000);
wss.on('connection', async (ws, req) => {
  // let debug;
  const cookies = cookie.parse(req.headers.cookie!)?.['id'];
  if (cookies) {
    const webId = cookieParser.signedCookie(cookies, discord.secret);
    if (webId && webIdRegex.test(webId)) {
      const user = await db.getUserWeb(webId);
      if (user) {
        // debug = user;
        logDebug(`${user.discord.username} connected—clients' size: ${wss.clients.size}`);
      } else { ws.terminate(); }
    } else { ws.terminate(); }
  } else { ws.terminate(); }
  // eslint-disable-next-line no-unused-vars
  ws.on('message', () => {
    // logDebug('WebSocketServer message from client—no handling in place');
  });
  ws.on('close', () => {
    // logDebug(`WebSocket closed by ${(debug) ? debug.discord.username : 'non-auth client'}—clients' size: ${wss.clients.size}`);
  });
  ws.on('pong', function(this:WebSocket & {isAlive?:boolean}) {
    this.isAlive = true;
    // logDebug(`WebSocket Pong from ${(debug) ? debug.discord.username : 'non-auth client'}—isAlive: ${this.isAlive}`);
  });
});
wss.on('close', () => {
  logDebug('WebSocketServer closing');
  clearInterval(wssInterval);
});

parentPort!.on('message', async data => {
  if (data.action === 'websync') {
    const message = { type:'playerStatus', queue:data.queue };
    for (const ws of wss.clients) {
      ws.send(JSON.stringify(message));
    }
  }
});