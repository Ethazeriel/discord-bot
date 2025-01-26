import * as db from './database.js';
import axios, { AxiosResponse } from 'axios';
import { logDebug, log } from './logger.js';
import fs from 'fs';
import { fileURLToPath, URL } from 'url';
const { discord, spotify, mongo, napster }:GooseConfig = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../config.json', import.meta.url).toString()), 'utf-8'));
const usercol = mongo.usercollection;
import chalk from 'chalk';
import { APIUser } from 'discord-api-types/v9';
import type { UpdateFilter } from 'mongodb';

export async function flow(type:'discord' | 'spotify' | 'napster', code:string, webClientId:string):Promise<boolean> {

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

    case 'napster': {
      tokenconfig = {
        url: 'https://api.napster.com/oauth/access_token',
        data:`client_id=${napster.client_id}&client_secret=${napster.client_secret}&response_type=code&grant_type=authorization_code&code=${code}&redirect_uri=${napster.redirect_uri}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      };
      break;}

    default: { return false; }
  }

  const AxToken:void | AxiosResponse<AccessTokenResponse> = await axios({
    url: tokenconfig.url,
    method: 'post',
    headers: tokenconfig.headers,
    data: tokenconfig.data,
    timeout: 10000,
  }).catch(error => {
    log('error', ['Oauth2: ', error.stack, error?.data]);
    return;
  });

  if (AxToken?.data) {
    const token = AxToken.data;
    logDebug('successful auth - getting user data');

    let userconfig;
    switch (type) {
      case 'discord': { userconfig = { url: 'https://discord.com/api/v9/oauth2/@me' }; break;}
      case 'spotify': { userconfig = { url: 'https://api.spotify.com/v1/me' }; break;}
      case 'napster': { userconfig = { url: 'https://api.napster.com/v2.2/me/account' }; break;}
      default: { return false; }
    }
    const AxUser:void | AxiosResponse<any> = await axios({
      url: userconfig.url,
      method: 'get',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${token.access_token}`,
      },
    }).catch(error => {
      log('error', ['Oauth2: ', error.stack, error?.data]);
      return;
    });

    if (AxUser?.data) {
      const user = AxUser.data;
      logDebug('got user data, saving to db');

      switch (type) {
        case 'discord': {
          await saveTokenDiscord(token, user, webClientId);
          break;}

        case 'spotify': {
          await saveTokenSpotify(token, webClientId);
          await updateSpotifyUser({ webClientId: webClientId }, user);
          break;}

        case 'napster': {
          await saveTokenNapster(token, webClientId);
          await updateNapsterUser({ webClientId: webClientId }, user);
          break;}

        default: { return false; }
      }
      // if we haven't returned at this point everything should have worked
      return true;
    }
    return false;
  }
  return false;
}

export async function getToken(user:object, type:'discord' | 'spotify' | 'napster' | 'lastfm') {
  // takes a db query object, and refreshes/returns the relevant tokens, ready to use
  const dab = await db.getDb();
  try {
    const userdb = dab.collection<User>(usercol);
    const tokenuser = await userdb.findOne(user, { projection: { _id: 0 } });

    if (tokenuser?.tokens[type]) {
      const token = await updateToken(tokenuser, type);
      return token;
    }
  } catch (error:any) { log('error', ['oauth error:', error.stack]); }
}

async function updateToken(user:User, type:'discord' | 'spotify' | 'napster' | 'lastfm'):Promise<string | undefined> {
  let timeout;

  switch (type) {
    case 'discord': { timeout = 86400000; break;} // token lasts one week, so use one day as timeout
    case 'spotify': { timeout = 1800000; break;} // token lasts one hour, so use half hour as timeout
    case 'napster': { timeout = 64800000; break;} // token lasts one day, so use 18 hours as timeout
    case 'lastfm': { timeout = 64800000; break;} // token never expires, so this doesn't matter
  }
  if (user.tokens && user.tokens[type]) {
    if ((user.tokens[type]!.expiry - Date.now()) < timeout) {

      let tokenconfig;
      switch (type) {
        case 'discord': {
          tokenconfig = {
            url: 'https://discord.com/api/v9/oauth2/token',
            data: `client_id=${discord.client_id}&client_secret=${discord.secret}&grant_type=refresh_token&refresh_token=${user.tokens.discord!.renew}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          };
          break;}

        case 'spotify': {
          tokenconfig = {
            url: 'https://accounts.spotify.com/api/token',
            data:`grant_type=refresh_token&refresh_token=${user.tokens.spotify!.renew}`,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization:  `Basic ${Buffer.from(spotify.client_id + ':' + spotify.client_secret).toString('base64')}`,
            },
          };
          break;}

        case 'napster': {
          tokenconfig = {
            url: 'https://api.napster.com/oauth/access_token',
            data: `client_id=${napster.client_id}&client_secret=${napster.client_secret}&response_type=code&grant_type=refresh_token&refresh_token=${user.tokens.napster!.renew}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          };
          break;}

        case 'lastfm': {
          tokenconfig = { // nonsense values, will never get called
            url: 'https://localhost',
            data: 'ur mum',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          };
          break;}
      }

      const newtoken:void | AxiosResponse<AccessTokenResponse> = await axios({
        url: tokenconfig.url,
        method: 'post',
        headers: tokenconfig.headers,
        data: tokenconfig.data,
        timeout: 10000,
      }).catch(error => {
        log('error', ['Oauth2: ', error.stack, error?.data]);
        return;
      });
      if (newtoken?.data) {
        const tokendata = newtoken.data;
        const token = {
          access:tokendata.access_token,
          renew:(type === 'spotify') ? user.tokens.spotify!.renew : tokendata.refresh_token, // spotify doesn't give us new refresh tokens
          expiry: ((Date.now() - 1000) + (tokendata.expires_in * 1000)),
          scope:tokendata.scope,
        };
        const dab = await db.getDb();
        const userdb = dab.collection<User>(usercol);
        const target = `tokens.${type}`;
        await userdb.updateOne({ 'discord.id': user.discord.id }, { $set:{ [target]:token } } as UpdateFilter<User>);
        log('database', [`Renewed Oauth2 token type ${type} for ${chalk.blue(user.discord.id)}: expires ${chalk.green(token.expiry)}`]);
        return token.access;
      }
    } else {
      logDebug('token still valid - skipping renewal');
      return user.tokens[type]!.access;
    }
  }
}

async function saveTokenDiscord(authtoken:AccessTokenResponse, userdata:{ expires:string, user:APIUser }, webClientId:string):Promise<void> {
  // first pass - consider revising - I'm not thinking super clearly right now
  const dab = await db.getDb();
  try {
    const userdb = dab.collection<User>(usercol);
    const token = {
      access:authtoken.access_token,
      renew:authtoken.refresh_token,
      expiry:Date.parse(userdata.expires),
      scope:authtoken.scope,
    };
    await userdb.updateOne({ 'discord.id': userdata.user.id }, { $set:{ 'tokens.discord':token }, $addToSet:{ webClientId:webClientId } });
    log('database', [`Saving Oauth2 token for ${chalk.blue(userdata.user.id)}: expires ${chalk.green(token.expiry)}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

async function saveTokenSpotify(authtoken:AccessTokenResponse, webClientId:string):Promise<void> {
  // intended to be called by the webserver oauth flow - arguments are the auth and data object returned by the discord api
  // first pass - consider revising - I'm not thinking super clearly right now
  const dab = await db.getDb();
  try {
    const userdb = dab.collection<User>(usercol);
    const token = {
      access:authtoken.access_token,
      renew:authtoken.refresh_token,
      expiry:((Date.now() - 10000) + (authtoken.expires_in * 1000)), // I'm not sure this logic makes a ton of sense
      scope:authtoken.scope,
    };
    await userdb.updateOne({ webClientId: webClientId }, { $set:{ 'tokens.spotify':token } });
    log('database', [`Saving spotify Oauth2 token: expires ${chalk.green(token.expiry)}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

async function saveTokenNapster(authtoken:AccessTokenResponse, webClientId:string):Promise<void> {
  const dab = await db.getDb();
  try {
    const userdb = dab.collection<User>(usercol);
    const token = {
      access:authtoken.access_token,
      renew:authtoken.refresh_token,
      expiry:((Date.now() - 10000) + (authtoken.expires_in * 1000)),
      scope:authtoken.scope || 'no such thing',
    };
    await userdb.updateOne({ webClientId: webClientId }, { $set:{ 'tokens.napster':token } });
    log('database', [`Saving napster Oauth2 token: expires ${chalk.green(token.expiry)}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

async function updateSpotifyUser(target:object, spotifyInfo:SpotifyApi.CurrentUsersProfileResponse):Promise<void> { // usage: updateSpotifyUser({discord.id:''}, {...})
  // updates spotify user info from object formatted as per
  // https://api.spotify.com/v1/me

  const dbspotify = {
    id:spotifyInfo.id,
    username:spotifyInfo.display_name,
    locale:spotifyInfo.country,
  };
  const dab = await db.getDb();
  try {
    const userdb = dab.collection<User>(usercol);
    await userdb.updateOne(target, { $set: { spotify:dbspotify } } as UpdateFilter<User>);
    log('database', [`Updating Spotify userdata for ${chalk.green(dbspotify.username)}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

async function updateNapsterUser(target:object, napsterInfo:any):Promise<void> { // TODO - make a type for this
  const dbnapster = {
    id:napsterInfo.account.id,
    username:napsterInfo.account.screenName,
    locale:napsterInfo.account.preferredLanguage,
  };
  const dab = await db.getDb();
  try {
    const userdb = dab.collection<User>(usercol);
    await userdb.updateOne(target, { $set: { napster:dbnapster } });
    log('database', [`Updating Napster userdata for ${chalk.green(dbnapster.username)}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}