import * as db from './database.js';
import axios from 'axios';
import { logDebug, logLine } from './logger.js';
import fs from 'fs';
const { discord, spotify } = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url)));

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
      logLine('error', ['discordOauth: ', error.stack, error?.data]);
      return;
    });
    if (user?.data) {
      user = user.data;
      logDebug('got user data, saving to db');

      switch (type) {
        case 'discord': {
          await db.saveTokenDiscord(token, user, webClientId);
          break;}

        case 'spotify': {
          await db.saveTokenSpotify(token, webClientId);
          await db.updateSpotifyUser({ webClientId: webClientId }, user);
          break;}

        default:{ return null; }
      }
      // if we haven't returned at this point everything should have worked
      return true;
    }
  }
}