import axios, { AxiosResponse } from 'axios';
import * as db from '../../database.js';
import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import { logDebug, log } from '../../logger.js';
import crypto from 'crypto';
import chalk from 'chalk';
const { lastfm, mongo }:GooseConfig = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));
const usercol = mongo.usercollection;


type LastFMTokenResponse = {
  session: {
    name: string,
    key: string,
    subscriber: 0 | 1
  }
};

export async function auth(token:string, webClientId:string) {

  const apiSig = crypto.createHash('md5').update(`api_key${lastfm.client_id}methodauth.getSessiontoken${token}${lastfm.client_secret}`).digest('hex');
  const AxToken:void | AxiosResponse<LastFMTokenResponse> = await axios({
    url: `http://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${lastfm.client_id}&token=${token}&format=json&api_sig=${apiSig}`,
    method: 'get',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  }).catch(error => {
    log('error', ['Oauth2: ', error.stack, error?.data]);
    return;
  });

  if (AxToken?.data) {
    const fmresult = AxToken.data;
    logDebug('successful auth - saving to db');
    await saveToken(fmresult, webClientId);
    await updateUser(fmresult, webClientId);

    // if we haven't returned at this point everything should have worked
    return true;
  }
  return false;
}

async function saveToken(authtoken:LastFMTokenResponse, webClientId:string):Promise<void> {
  const dab = await db.getDb();
  try {
    const userdb = dab.collection<User>(usercol);
    const token = {
      access:authtoken.session.key,
      renew: 'not applicable',
      expiry:8640000000000000, // these don't expire, so we'll just give it 200,000 years or so
      scope: 'not applicable',
    };
    await userdb.updateOne({ webClientId: webClientId }, { $set:{ 'tokens.lastfm':token } });
    log('database', ['Saving lastfm auth token']);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

async function updateUser(authtoken:LastFMTokenResponse, webClientId:string):Promise<void> {
  const dblastfm = {
    id:authtoken.session.name, // the api documentation claims you could get this from user.getinfo, but that's a lie so we're just putting the username in both fields
    username:authtoken.session.name,
    locale:'en', // not supported
  };
  const dab = await db.getDb();
  try {
    const userdb = dab.collection<User>(usercol);
    await userdb.updateOne({ webClientId: webClientId }, { $set: { lastfm:dblastfm } });
    log('database', [`Updating LastFM userdata for ${chalk.green(dblastfm.username)}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}