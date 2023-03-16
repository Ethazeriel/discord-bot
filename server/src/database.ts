import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import { Document, MongoClient } from 'mongodb';
import { log } from './logger.js';
import chalk from 'chalk';
const { mongo } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../config.json', import.meta.url).toString()), 'utf-8'));
import { sanitizePlaylists } from './regexes.js';
import { isMainThread, workerData } from 'worker_threads';
import Player from './player.js';
// Connection URL
let url = mongo.url;
const dbname = mongo.database;
const trackcol = mongo.trackcollection;
const usercol = mongo.usercollection;
if (process.env.DOCKER) { url = process.env.MONGO_CONN_STR; }
export let db:any;
let con:MongoClient | undefined;
MongoClient.connect(url, { ignoreUndefined: true }, function(err, client) {
  if (err) throw err;
  con = client;
  db = client?.db(dbname);
  if (isMainThread) {
    log('database', [`Main thread connected to db: ${dbname}`]);
  } else {
    log('database', [`${workerData?.name} worker connected to database: ${dbname}`]);
  }
});

export async function connected():Promise<boolean> { // await this in your code to wait for the db to connect before doing things
  return new Promise((resolve) => {
    const wait = (() => {
      if (db) {
        resolve(true);
      } else { setTimeout(wait, 100);}
    });
    wait();

  });
}

export async function closeDB():Promise<object | undefined> {
  // we should really only be doing this when the program exits
  try {
    db = null;
    await con!.close();
    log('database', [`Closed connection: ${dbname}`]);
  } catch (error:any) {
    log('error', ['database error:', error.message]);
    return error;
  }
}

export async function getTrack(query:object):Promise<Track | undefined> {// acquire2
  // returns the first track object that matches the query
  await connected();
  try {
    const tracks = db.collection(trackcol);
    const track = await tracks.findOne(query, { projection: { _id: 0 } });
    return track;
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}
/*
  Usage examples:
  get track by youtubeID: await getTrack({'youtube.id': 'mdh6upXZL6c'});
  spotifyID: await getTrack({ 'spotify.id': '76nqR8hb279mkQLNkQMzK1' });
  key: await getTrack({ keys:'tng%20those%20arent%20muskets' });
  */


export async function insertTrack(track:Track):Promise<object | undefined> {// acquire2
  // inserts a single track object into the database
  track.status = {}; // track status should be null, but just in case
  await connected();
  const tracks = db.collection(trackcol);
  // check if we already have this url
  const test = await tracks.findOne({ $or: [{ 'youtube.id': track.youtube[0].id }, { 'goose.id': track.goose.id }] }, { projection: { _id: 0 } });
  if (test == null || (test.youtube.id != track.youtube[0].id && test.goose.id != track.goose.id)) {
    // we don't have this in our database yet, so
    const result = await tracks.insertOne(track);
    log('database', [`Adding track ${chalk.green(track.goose.track.name)} by ${chalk.green(track.goose.artist.name)} to database`]);
    return result;
  } else { throw new Error(`Track ${track.goose.id} already exists! (youtube: ${track.youtube[0].id})`);}
  // I've removed the try/catch block here so this error is actually meaningful
  // shouldn't matter, but leaving this comment just in case
}

export async function addKey(query:object, newkey:string) {// acquire2
  // adds a new key to a track we already have
  // silently fails if we don't have the track in the DB already
  await connected();
  try {
    const tracks = db.collection(trackcol);
    await tracks.updateOne(query, { $addToSet: { keys: newkey.toLowerCase() } });
    log('database', [`Adding key ${chalk.blue(newkey.toLowerCase())} to ${chalk.green(JSON.stringify(query))}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}
// addKey({ 'spotify.id': '7BnKqNjGrXPtVmPkMNcsln' }, 'celestial%20elixr');

export async function addSourceId(query:object, type:'spotify' | 'napster', newid:string) {// acquire2
  // adds a new id of the specified type to a track we already have
  // silently fails if we don't have the track in the DB already
  await connected();
  try {
    const tracks = db.collection(trackcol);
    const target = `${type}.id`;
    await tracks.updateOne(query, { $addToSet: { [target]: newid } });
    log('database', [`Adding ${type} id ${chalk.blue(newid)} to ${chalk.green(query)}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}
// addSourceId({ 'goose.id': '12345abcde' }, 'spotify', '6i71OngJrJDr6hQIFmzYI0');

export async function addTrackSource(query:object, type:'spotify' | 'napster', source:TrackSource) {// acquire2
  await connected();
  try {
    const tracks = db.collection(trackcol);
    await tracks.updateOne(query, { $set: { [type]: source } });
    log('database', [`Adding ${type} source to ${chalk.green(query)}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

export async function addPlaylist(trackarray:Track[], listname:string) {// acquire2
  // takes an ordered array of tracks and a playlist name, and adds the playlist name and track number to those tracks in the database
  // assumes tracks already exist - if they're not in the database yet, this does nothing - but that should never happen
  const name = listname.replace(sanitizePlaylists, '');
  const test = await getPlaylist(name);
  await connected();
  if (!test.length) {
    try {
      const tracks = db.collection(trackcol);
      trackarray.forEach(async (element, index) => {
        const query = { 'goose.id': element.goose.id };
        const field = `playlists.${name}`;
        await tracks.updateOne(query, { $set: { [field]:index } });
        log('database', [`Adding playlist entry ${chalk.blue(name + ':' + index)} to ${chalk.green(element.goose.track.name)} by ${chalk.green(element.goose.artist.name)}`]);
      });
    } catch (error:any) {
      log('error', ['database error:', error.stack]);
    }
  } else {
    log('database', [`User attempted to add new playlist ${chalk.blue(listname)}, which already exists.`]);
    return `Playlist ${listname} already exists.`;
  }
}

export async function getPlaylist(listname:string):Promise<Track[]> {
  // returns a playlist as an array of tracks, ready for use
  await connected();
  let result:Track[] = [];
  try {
    const name = listname.replace(sanitizePlaylists, '');
    const tracks = db.collection(trackcol);
    const qustr = `playlists.${name}`;
    const query = { [qustr]: { $exists: true } };
    const options = { sort: { [qustr]:1 }, projection: { _id: 0 } };
    const cursor = await tracks.find(query, options);
    result = await cursor.toArray();
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
  return result;
}

export async function removePlaylist(listname:string) {
  await connected();
  try {
    const name = listname.replace(sanitizePlaylists, '');
    const tracks = db.collection(trackcol);
    const qustr = `playlists.${name}`;
    const query = { [qustr]: { $exists: true } };
    const filt = { $unset:{ [qustr]: '' } };
    const result = await tracks.updateMany(query, filt);
    log('database', [`Removed playlist ${chalk.blue(name)} from ${chalk.green(result.modifiedCount)} tracks.`]);
    return result.modifiedCount;
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

export async function updateTrack(query:object, update:object) {
  // generic update function; basically just a wrapper for updateOne
  await connected();
  try {
    const tracks = db.collection(trackcol);
    await tracks.updateOne(query, update);
    log('database', [`Updating track ${chalk.blue(JSON.stringify(query, null, 2))} with data ${chalk.green(JSON.stringify(update, null, 2))}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

export async function removeTrack(query:string) { // acquire2
  // removes the track with the specified youtube id - USE WITH CAUTION
  // returns 1 if successful, 0 otherwise
  await connected();
  try {
    const tracks = db.collection(trackcol);
    const track = await tracks.deleteOne({ 'youtube.0.id':query });
    if (track.deletedCount === 1) {
      log('database', [`Removed track ${chalk.red(query)} from DB.`]);
    } else {
      log('database', [`Removing track ${chalk.red(query)} failed - was not in the DB or something else went wrong`]);
    }
    return track.deletedCount;
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}
// usage: await db.removeTrack('DjaE3w8j6vY');

export async function switchAlternate(query:string, alternate:number | TrackYoutubeSource):Promise<number> { // acquire2
  // returns the first track object that matches the query
  await connected();
  try {
    const tracks = db.collection(trackcol);
    const search = { 'youtube.0.id':query };
    const track:Track = await tracks.findOne(search);
    if (track) {
      const original = track.youtube[0].id;
      if (typeof alternate === 'number') {
        const newmain = track.youtube.splice(alternate, 1, track.youtube[0]);
        track.youtube.shift();
        track.youtube.unshift(newmain[0]);
      } else {
        track.youtube.unshift(alternate);
        track.youtube.pop();
      }
      const update = {
        $set: { 'youtube':track.youtube, 'goose.track.duration':track.youtube[0].duration },
      };
      const result = await tracks.updateOne(search, update);
      if (result.modifiedCount == 1) {
        log('database', [`Remapped track ${chalk.green(original)} to ${chalk.green(track.youtube[0].id)}`]);
      } else {log('database', [`Failed to remap ${chalk.red(original)} - is this a valid ID?`]);}
      return result.modifiedCount;
    } else {return 0;}
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
    return 0;
  }
}

export async function printCount():Promise<number | undefined> {
  // returns the number of tracks we have
  await connected();
  try {
    const tracks = db.collection(trackcol);
    const number = await tracks.count();
    log('database', [`We currently have ${chalk.green(number)} tracks in the ${dbname} database, collection ${trackcol}.`]);
    return number;
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

export async function listPlaylists():Promise<Set<string> | undefined> {
  // returns all the playlists we have as a set
  // this may take a long time to return and a lot of cpu once we've got more than a few playlists; consider revising
  await connected();
  try {
    const tracks = db.collection(trackcol);
    const list = await tracks.distinct('playlists');
    const result = new Set<string>();
    list.forEach((element:string) => {
      Object.keys(element).forEach((ohno) => {
        result.add(ohno);
      });
    });
    return result;
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

export async function logPlay(id:string, success = true):Promise<void> {
  await connected();
  try {
    const tracks = db.collection(trackcol);
    const update = success ? { $inc: { 'goose.plays': 1 } } : { $inc: { 'goose.errors': 1, 'goose.plays': 1 } };
    await tracks.updateOne({ 'goose.id': id }, update);
    log('database', [`Logging ${success ? chalk.green('successful play') : chalk.red('play error')} for track ${chalk.blue(id)}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

export async function updateOfficial(id:string, link:string) {// acquire2
  await connected();
  try {
    const tracks = db.collection(trackcol);
    await tracks.updateOne({ 'goose.id': id }, { $set: { 'goose.artist.official': link } });
    log('database', [`Updated artist link to ${link} for track ${chalk.blue(id)}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

// *****************
// userdb functions
// *****************
type DiscordUser = {
  id:string,
  username:string,
  nickname?:string,
  discriminator:string,
  guild?:string,
  locale?:string
}
export async function newUser(discord:DiscordUser):Promise<object | undefined> { // usage: await newUser({ id:'119678070222225408', username:'Ethazeriel', nickname:'Eth', discriminator:'4962', guild:'888246961097048065', locale:'en-US'});
  // inserts a new user object into the database
  // returns null if unsuccessful
  await connected();
  try {
    const userdb = db.collection(usercol);
    // check if we already have this user
    const test = await userdb.findOne({ 'discord.id': discord.id }, { projection: { _id: 0 } });
    if (test == null) {
      // we don't have this in our database yet, so
      const object = {
        discord: {
          id:discord.id,
          locale:discord.locale,
          nickname: (discord.guild) ? { [discord.guild]:{ current:discord?.nickname, old:[] } } : {},
          username:{ current:discord.username, old:[] },
          discriminator:{ current:discord.discriminator, old:[] },
        },
        stash: { playhead:0, tracks:[] },
      };
      const result = await userdb.insertOne(object);
      log('database', [`Adding user ${chalk.green(`${discord.username}#${discord.discriminator}`)} to database`]);
      return result;
    } else { throw new Error(`User ${chalk.red(discord.username)} already exists!`);}
  } catch (error:any) {
    log('error', ['database error:', error.message]);
  }
}

export async function getUser(discordid:string):Promise<User | undefined> { // usage: const result = await getUser('119678070222225408');
  // returns the user object with the matching id
  await connected();
  try {
    const userdb = db.collection(usercol);
    const result = await userdb.findOne({ 'discord.id': discordid }, { projection: { _id: 0 } });
    return result;
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

export async function updateUser(discordid:string, field:'nickname' | 'locale' | 'discriminator' | 'username', data:string, guild?:string) { // usage: const result = await database.updateUser(userid, 'username', member.user.username);
  // updates the given field for the given user
  // returns null if unsuccessful
  await connected();
  try {
    const userdb = db.collection(usercol);
    const user = await getUser(discordid);
    if (!user) {return;}
    const validfields = ['username', 'nickname', 'discriminator', 'locale'];
    if (!validfields.includes(field)) {
      return;
    }
    let why = `discord.${field}.current`;
    let why2 = `discord.${field}.old`;
    if (field === 'nickname') {
      if (!guild) {return;}
      why = `discord.${field}.${guild}.current`;
      why2 = `discord.${field}.${guild}.old`;
    }
    let update;
    if (field === 'nickname') {
      update = { $set: { [why]:data }, $addToSet:{ [why2]:user.discord.nickname[guild as string]?.current } };
    } else if (field === 'locale') {
      update = { $set: { 'discord.locale':data } };
    } else {
      update = { $set: { [why]:data }, $addToSet:{ [why2]:user.discord[field].current } };
    }
    update = (field === 'locale') ? { $set: { 'discord.locale':data } } : update;
    const result = await userdb.updateOne({ 'discord.id': discordid }, update);
    log('database', [`Updating info for ${chalk.blue(discordid)}: ${chalk.green(field)} is now ${chalk.green(data)}`]);
    return result;
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

export async function saveStash(discordid:string, playhead:number, queue:Track[]) {// acquire2
  // usage: const result = await saveStash('119678070222225408', player.getPlayhead(), player.getQueue());
  // updates the stash for the given user
  // returns null if unsuccessful
  await connected();
  const idarray = [];
  for (const track of queue) { (!track.status?.ephemeral && Player.notPending(track)) ? idarray.push(track.goose.id) : null; }
  const stash = { playhead: playhead, tracks: idarray };
  try {
    const userdb = db.collection(usercol);
    const result = await userdb.updateOne({ 'discord.id': discordid }, { $set:{ stash:stash } });
    log('database', [`Updating stash for ${chalk.blue(discordid)}: Playhead ${chalk.green(stash.playhead)}, ${chalk.green((stash.tracks.length - 1))} tracks`]);
    return result;
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

export async function getStash(discordid:string) { // usage: const result = await getStash('119678070222225408');
  // returns the stash (playhead and full track objects) for the given id
  await connected();
  try {
    const userdb = db.collection(usercol);
    const user = await userdb.findOne({ 'discord.id': discordid }, { projection: { _id: 0 } });
    const queue:Track[] = [];
    for (const id of user.stash.tracks) {
      const track = await getTrack({ 'goose.id':id });
      if (track) { queue.push(track); }
    }
    return { playhead:user.stash.playhead, tracks:queue };
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

export async function getUserWeb(webid:string):Promise<WebUser | undefined> {
  // functions like getUser, but takes a web client ID and only returns basic user info - not everything we have
  await connected();
  try {
    const userdb = db.collection(usercol);
    const result = await userdb.findOne({ webClientId: webid }, { projection: { _id: 0 } });
    if (result && Object.keys(result).length) {
      const basicuser:WebUser = {
        discord: {
          id: result.discord.id,
          username: result.discord.username.current,
          discriminator: result.discord.discriminator.current,
        },
        spotify: result.spotify,
        napster: result.napster,
        status: 'known',
      };
      return basicuser;
    } else { return undefined; }
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

// *****************
// generic functions
// *****************

export async function genericUpdate(query:object, changes:object, collection:string):Promise<void> {
  // generic update function; basically just a wrapper for updateOne
  await connected();
  try {
    const coll = db.collection(collection);
    await coll.updateOne(query, changes);
    log('database', [`Updating ${collection}: ${chalk.blue(JSON.stringify(query, null, 2))} with data ${chalk.green(JSON.stringify(changes, null, 2))}`]);
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

export async function genericGet(query:object, collection:string):Promise<Document|undefined> { // arc v1
  // returns the first item that matches the query
  await connected();
  try {
    const coll = db.collection(collection);
    const result = await coll.findOne(query, { projection: { _id: 0 } });
    return result;
  } catch (error:any) {
    log('error', ['database error:', error.stack]);
  }
}

