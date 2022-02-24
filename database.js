const MongoClient = require('mongodb').MongoClient;
const { logLine } = require('./logger.js');
const chalk = require('chalk');
const { mongo } = require('./config.json');
const { sanitizePlaylists } = require('./regexes.js');
// Connection URL
const url = mongo.url;
const dbname = mongo.database;
const trackcol = mongo.trackcollection;
const usercol = mongo.usercollection;
let db;
let con;
MongoClient.connect(url, function(err, client) {
  if (err) throw err;
  con = client;
  db = client.db(dbname);
  logLine('database', [`Connected to database: ${dbname}`]);
});

async function closeDB() {
  // we should really only be doing this when the program exits
  try {
    logLine('database', [`Closing connection: ${dbname}`]);
    await con.close();
  } catch (error) {
    logLine('error', ['database error:', error.message]);
    return error;
  }
}

async function getTrack(query) {
  // returns the first track object that matches the query
  try {
    const tracks = db.collection(trackcol);
    const track = await tracks.findOne(query, { projection: { _id: 0 } });
    return track;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}
/*
Usage examples:
get track by youtubeID: await getTrack({'youtube.id': 'mdh6upXZL6c'});
spotifyID: await getTrack({ 'spotify.id': '76nqR8hb279mkQLNkQMzK1' });
key: await getTrack({ keys:'tng%20those%20arent%20muskets' });
generally speaking we should let the client close after the query - but if there are issues with repeated queries, could try setting keepAlive to true;
*/

async function insertTrack(track) {
  // inserts a single track object into the database
  try {
    const tracks = db.collection(trackcol);
    // check if we already have this url
    if (!track.ephemeral) {
      const test = await tracks.findOne({ $or: [{ 'youtube.id': track.youtube.id }, { 'goose.id': track.goose.id }] }, { projection: { _id: 0 } });
      if (test == null || (test.youtube.id != track.youtube.id && test.goose.id != track.goose.id)) {
      // we don't have this in our database yet, so
        const result = await tracks.insertOne(track);
        logLine('database', [`Adding track ${chalk.green(track.spotify.name || track.youtube.name)} by ${chalk.green(track.artist.name)} to database`]);
        return result;
      } else { throw new Error(`Track ${track.goose.id} already exists! (youtube: ${track.youtube.id})`);}
    // console.log(track);
    } else { throw new Error('This track is ephemeral!');}
  } catch (error) {
    logLine('error', ['database error:', error.message]);
  }
}

async function addKey(query, newkey) {
  // adds a new key to a track we already have
  // silently fails if we don't have the track in the DB already
  try {
    const tracks = db.collection(trackcol);
    await tracks.updateOne(query, { $addToSet: { keys: newkey.toLowerCase() } });
    logLine('database', [`Adding key ${chalk.blue(newkey.toLowerCase())} to ${chalk.green(query)}`]);
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}
// addKey({ 'spotify.id': '7BnKqNjGrXPtVmPkMNcsln' }, 'celestial%20elixr');

async function addSpotifyId(query, newid) {
  // adds a new spotify id to a track we already have
  // silently fails if we don't have the track in the DB already
  try {
    const tracks = db.collection(trackcol);
    await tracks.updateOne(query, { $addToSet: { 'spotify.id': newid } });
    logLine('database', [`Adding spotify id ${chalk.blue(newid)} to ${chalk.green(query)}`]);
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}
// addSpotifyId({ 'youtube.id': 'WMZTxhEPRhA' }, '6i71OngJrJDr6hQIFmzYI0');

async function addPlaylist(trackarray, listname) {
  // takes an ordered array of tracks and a playlist name, and adds the playlist name and track number to those tracks in the database
  // assumes tracks already exist - if they're not in the database yet, this does nothing - but that should never happen
  const name = listname.replace(sanitizePlaylists, '');
  const test = await getPlaylist(name);
  if (!test.length) {
    try {
      const tracks = db.collection(trackcol);
      trackarray.forEach(async (element, index) => {
        const query = { 'goose.id': element.goose.id };
        const field = `playlists.${name}`;
        await tracks.updateOne(query, { $set: { [field]:index } });
        logLine('database', [`Adding playlist entry ${chalk.blue(name + ':' + index)} to ${chalk.green(element.spotify.name || element.youtube.name)} by ${chalk.green(element.artist.name)}`]);
      });
    } catch (error) {
      logLine('error', ['database error:', error.stack]);
    }
  } else {
    logLine('database', [`User attempted to add new playlist ${chalk.blue(listname)}, which already exists.`]);
    return `Playlist ${listname} already exists.`;
  }
}

async function getPlaylist(listname) {
  // returns a playlist as an array of tracks, ready for use
  try {
    const name = listname.replace(sanitizePlaylists, '');
    const tracks = db.collection(trackcol);
    const qustr = `playlists.${name}`;
    const query = { [qustr]: { $exists: true } };
    const options = { sort: { [qustr]:1 }, projection: { _id: 0 } };
    const cursor = await tracks.find(query, options);
    const everything = await cursor.toArray();
    return everything;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function removePlaylist(listname) {
  try {
    const name = listname.replace(sanitizePlaylists, '');
    const tracks = db.collection(trackcol);
    const qustr = `playlists.${name}`;
    const query = { [qustr]: { $exists: true } };
    const filt = { $unset:{ [qustr]: '' } };
    const result = await tracks.updateMany(query, filt);
    logLine('database', [`Removed playlist ${chalk.blue(name)} from ${chalk.green(result.modifiedCount)} tracks.`]);
    return result.modifiedCount;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function updateTrack(query, update) {
  // generic update function; basically just a wrapper for updateOne
  try {
    const tracks = db.collection(trackcol);
    await tracks.updateOne(query, update);
    logLine('database', [`Updating track ${chalk.blue(JSON.stringify(query, '', 2))} with data ${chalk.green(JSON.stringify(update, '', 2))}`]);
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function removeTrack(query) {
  // removes the track with the specified youtube id - USE WITH CAUTION
  // returns 1 if successful, 0 otherwise
  try {
    const tracks = db.collection(trackcol);
    const track = await tracks.deleteOne({ 'youtube.id':query });
    if (track.deletedCount === 1) {
      logLine('database', [`Removed track ${chalk.red(query)} from DB.`]);
    } else {
      logLine('database', [`Removing track ${chalk.red(query)} failed - was not in the DB or something else went wrong`]);
    }
    return track.deletedCount;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}
// usage: await db.removeTrack('DjaE3w8j6vY');

async function switchAlternate(query, alternate) {
  // returns the first track object that matches the query
  try {
    const tracks = db.collection(trackcol);
    const search = { 'youtube.id':query };
    const track = await tracks.findOne(search);
    if (track) {
      const newmain = track.alternates.splice(alternate, 1, track.youtube);
      const update = {
        $set: { 'youtube':newmain[0], 'alternates':track.alternates },
      };
      const result = await tracks.updateOne(search, update);
      if (result.modifiedCount == 1) {
        logLine('database', [`Remapped track ${chalk.green(track.youtube.id)} to alternate ${chalk.green(alternate)}`]);
      } else {logLine('database', [`Failed to remap ${chalk.red(track.youtube.id)} - is this a valid ID?`]);}
      return result.modifiedCount;
    } else {return 0;}
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function getAlbum(request, type) {
  // returns an album as an array of tracks, ready for use
  // type can be id or name
  const pattern = /^(?:id|name){1}$/g;
  if (!pattern.test(type)) {return null;}
  try {
    const tracks = db.collection(trackcol);
    const qustr = `album.${type}`;
    const query = { [qustr]: request };
    const options = { sort: { 'album.trackNumber':1 }, projection: { _id: 0 } };
    const cursor = await tracks.find(query, options);
    const everything = await cursor.toArray();
    return everything;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function printCount() {
  // returns the number of tracks we have
  try {
    const tracks = db.collection(trackcol);
    const number = await tracks.count();
    logLine('database', [`We currently have ${chalk.green(number)} tracks in the ${dbname} database, collection ${trackcol}.`]);
    return number;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function listPlaylists() {
  // returns all the playlists we have as a set
  // this may take a long time to return and a lot of cpu once we've got more than a few playlists; consider revising
  try {
    const tracks = db.collection(trackcol);
    const list = await tracks.distinct('playlists');
    const result = new Set();
    list.forEach((element) => {
      Object.keys(element).forEach((ohno) => {
        result.add(ohno);
      });
    });
    return result;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

// *****************
// userdb functions
// *****************

async function newUser(discord) { // usage: await newUser({ id:'119678070222225408', username:'Ethazeriel', nickname:'Eth', discriminator:'4962', guild:'888246961097048065', locale:'en-US'});
  // inserts a new user object into the database
  // returns null if unsuccessful
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
      logLine('database', [`Adding user ${chalk.green(`${discord.username}#${discord.discriminator}`)} to database`]);
      return result;
    } else { throw new Error(`User ${chalk.red(discord.username)} already exists!`);}
  } catch (error) {
    logLine('error', ['database error:', error.message]);
  }
}

async function getUser(discordid) { // usage: const result = await getUser('119678070222225408');
  // returns the user object with the matching id
  try {
    const userdb = db.collection(usercol);
    const result = await userdb.findOne({ 'discord.id': discordid }, { projection: { _id: 0 } });
    return result;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function updateUser(discordid, field, data, guild) { // usage: const result = await database.updateUser(userid, 'username', member.user.username);
  // updates the given field for the given user
  // returns null if unsuccessful
  try {
    const userdb = db.collection(usercol);
    const user = await getUser(discordid);
    if (!user) {return;}
    const validfields = ['username', 'nickname', 'discriminator'];
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
    let update = (field === 'nickname') ? { $set: { [why]:data }, $addToSet:{ [why2]:user.discord[field][guild]?.current } } : { $set: { [why]:data }, $addToSet:{ [why2]:user.discord[field].current } };
    update = (field === 'locale') ? { $set: { 'discord.locale':data } } : update;
    const result = await userdb.updateOne({ 'discord.id': discordid }, update);
    logLine('database', [`Updating info for ${chalk.blue(discordid)}: ${chalk.green(field)} is now ${chalk.green(data)}`]);
    return result;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function saveStash(discordid, playhead, queue) { // usage: const result = await saveStash('119678070222225408', player.getPlayhead(), player.getQueue());
  // updates the stash for the given user
  // returns null if unsuccessful
  const idarray = [];
  for (const track of queue) { !track.ephemeral ? idarray.push(track.goose.id) : null; }
  const stash = { playhead: playhead, tracks: idarray };
  try {
    const userdb = db.collection(usercol);
    const result = await userdb.updateOne({ 'discord.id': discordid }, { $set:{ stash:stash } });
    logLine('database', [`Updating stash for ${chalk.blue(discordid)}: Playhead ${chalk.green(stash.index)}, ${chalk.green(stash.tracks.length)} tracks`]);
    return result;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function getStash(discordid) { // usage: const result = await getStash('119678070222225408');
  // returns the stash (playhead and full track objects) for the given id
  try {
    const userdb = db.collection(usercol);
    const user = await userdb.findOne({ 'discord.id': discordid }, { projection: { _id: 0 } });
    const queue = [];
    for (const id of user.stash.tracks) {
      const track = await getTrack({ 'goose.id':id });
      queue.push(track);
    }
    return { playhead:user.stash.playhead, tracks:queue };
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

// *****************
// generic functions
// *****************

async function genericUpdate(query, changes, collection) {
  // generic update function; basically just a wrapper for updateOne
  try {
    const coll = db.collection(collection);
    await coll.updateOne(query, changes);
    logLine('database', [`Updating ${collection}: ${chalk.blue(JSON.stringify(query, '', 2))} with data ${chalk.green(JSON.stringify(changes, '', 2))}`]);
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function genericGet(query, collection) { // arc v1
  // returns the first item that matches the query
  try {
    const coll = db.collection(collection);
    const result = await coll.findOne(query, { projection: { _id: 0 } });
    return result;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

module.exports = {
  // trackdb
  getTrack,
  insertTrack,
  addKey,
  addPlaylist,
  getPlaylist,
  removePlaylist,
  getAlbum,
  printCount,
  closeDB,
  listPlaylists,
  removeTrack,
  switchAlternate,
  updateTrack,
  addSpotifyId,
  // generic
  genericUpdate,
  genericGet,
  // userdb
  newUser,
  getUser,
  saveStash,
  getStash,
  updateUser,
};