import * as db from './database.js';
import axios from 'axios';
import { logDebug, logLine } from './logger.js';
import fs from 'fs';
const { discord, spotify, mongo } = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url)));
const usercol = mongo.usercollection;
import chalk from 'chalk';

export async function flow(type, code, webClientId) {

  let tokenconfig;
  switch (type) {
    case 'discord': {
      tokenconfig = {
        url: 'https://discord.com/api/v9/oauth2/token',
        data: `client_id=${discord.client_id}&client_secret=${discord.secret}&grant_type=authorization_code&code=${code}&redirect_uri=${discord.redirect_uri}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      };
      break;}

    case 'spotify': {
      tokenconfig = {
        url: 'https://accounts.spotify.com/api/token',
        data:`grant_type=authorization_code&code=${code}&redirect_uri=${spotify.redirect_uri}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:  `Basic ${Buffer.from(spotify.client_id + ':' + spotify.client_secret).toString('base64')}`,
        },
      };
      break;}

    default:{ return null; }
  }

  let token = await axios({
    url: tokenconfig.url,
    method: 'post',
    headers: tokenconfig.headers,
    data: tokenconfig.data,
    timeout: 10000,
  }).catch(error => {
    logLine('error', ['Oauth2: ', error.stack, error?.data]);
    return;
  });

  if (token?.data) {
    token = token.data;
    logDebug('successful auth - getting user data');

    let userconfig;
    switch (type) {
      case 'discord': {
        userconfig = {
          url: 'https://discord.com/api/v9/oauth2/@me',
        };
        break;}

      case 'spotify': {
        userconfig = {
          url: 'https://api.spotify.com/v1/me',
        };
        break;}

      default:{ return null; }
    }

    let user = await axios({
      url: userconfig.url,
      method: 'get',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${token.access_token}`,
      },
    }).catch(error => {
      logLine('error', ['Oauth2: ', error.stack, error?.data]);
      return;
    });

    if (user?.data) {
      user = user.data;
      logDebug('got user data, saving to db');

      switch (type) {
        case 'discord': {
          await saveTokenDiscord(token, user, webClientId);
          break;}

        case 'spotify': {
          await saveTokenSpotify(token, webClientId);
          await updateSpotifyUser({ webClientId: webClientId }, user);
          break;}

        default:{ return null; }
      }
      // if we haven't returned at this point everything should have worked
      return true;
    }
  }
}

export async function getToken(user, type) {
  // takes a db query object, and refreshes/returns the relevant tokens, ready to use
  await db.connected();
  try {
    const userdb = db.db.collection(usercol);
    const tokenuser = await userdb.findOne(user, { projection: { _id: 0 } });

    if (tokenuser?.tokens[type]) {
      const token = await updateToken(tokenuser, type);
      return token;
    }
  } catch (error) { logLine('error', ['oauth error:', error.stack]); }
}

async function updateToken(user, type) {
  let timeout;

  switch (type) {
    case 'discord': { timeout = 86400000; break;} // token lasts one week, so use one day as timeout
    case 'spotify': { timeout = 1800000; break;} // token lasts one hour, so use half hour as timeout
  }

  if ((user.tokens[type].expiry - Date.now()) < timeout) {

    let tokenconfig;
    switch (type) {
      case 'discord': {
        tokenconfig = {
          url: 'https://discord.com/api/v9/oauth2/token',
          data: `client_id=${discord.client_id}&client_secret=${discord.secret}&grant_type=refresh_token&refresh_token=${user.tokens.discord.renew}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        };
        break;}

      case 'spotify': {
        tokenconfig = {
          url: 'https://accounts.spotify.com/api/token',
          data:`grant_type=refresh_token&refresh_token=${user.tokens.spotify.renew}`,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization:  `Basic ${Buffer.from(spotify.client_id + ':' + spotify.client_secret).toString('base64')}`,
          },
        };
        break;}
    }

    let newtoken = await axios({
      url: tokenconfig.url,
      method: 'post',
      headers: tokenconfig.headers,
      data: tokenconfig.data,
      timeout: 10000,
    }).catch(error => {
      logLine('error', ['Oauth2: ', error.stack, error?.data]);
      return;
    });
    if (newtoken?.data) {
      newtoken = newtoken.data;
      const token = {
        access:newtoken.access_token,
        renew:(type === 'spotify') ? user.tokens.spotify.renew : newtoken.refresh_token, // spotify doesn't give us new refresh tokens
        expiry: ((Date.now() - 1000) + (newtoken.expires_in * 1000)),
        scope:newtoken.scope,
      };
      await db.connected();
      const userdb = db.db.collection(usercol);
      const target = `tokens.${type}`;
      await userdb.updateOne({ 'discord.id': user.discord.id }, { $set:{ [target]:token } });
      logLine('database', [`Renewed Oauth2 token type ${type} for ${chalk.blue(user.discord.id)}: expires ${chalk.green(token.expiry)}`]);
      return token.access;
    }
  } else {
    logDebug('token still valid - skipping renewal');
    return user.tokens[type].access;
  }

}

async function saveTokenDiscord(authtoken, userdata, webClientId) {
  // first pass - consider revising - I'm not thinking super clearly right now
  await db.connected();
  try {
    const userdb = db.db.collection(usercol);
    const token = {
      access:authtoken.access_token,
      renew:authtoken.refresh_token,
      expiry:Date.parse(userdata.expires),
      scope:authtoken.scope,
    };
    const result = await userdb.updateOne({ 'discord.id': userdata.user.id }, { $set:{ 'tokens.discord':token }, $addToSet:{ webClientId:webClientId } });
    logLine('database', [`Saving Oauth2 token for ${chalk.blue(userdata.user.id)}: expires ${chalk.green(token.expiry)}`]);
    return result;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function saveTokenSpotify(authtoken, webClientId) {
  // intended to be called by the webserver oauth flow - arguments are the auth and data object returned by the discord api
  // first pass - consider revising - I'm not thinking super clearly right now
  await db.connected();
  try {
    const userdb = db.db.collection(usercol);
    const token = {
      access:authtoken.access_token,
      renew:authtoken.refresh_token,
      expiry:((Date.now() - 10000) + (authtoken.expires_in * 1000)), // I'm not sure this logic makes a ton of sense
      scope:authtoken.scope,
    };
    const result = await userdb.updateOne({ webClientId: webClientId }, { $set:{ 'tokens.spotify':token } });
    logLine('database', [`Saving spotify Oauth2 token: expires ${chalk.green(token.expiry)}`]);
    return result;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function updateSpotifyUser(target, spotifyInfo) { // usage: updateSpotifyUser({discord.id:''}, {...})
  // updates spotify user info from object formatted as per
  // https://api.spotify.com/v1/me

  const dbspotify = {
    id:spotifyInfo.id,
    username:spotifyInfo.display_name,
    locale:spotifyInfo.country,
  };
  await db.connected();
  try {
    const userdb = db.db.collection(usercol);
    await userdb.updateOne(target, { $set: { spotify:dbspotify } });
    logLine('database', [`Updating Spotify userdata for ${chalk.green(dbspotify.username)}`]);
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}