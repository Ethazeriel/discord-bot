const MongoClient = require('mongodb').MongoClient;
const { logLine } = require('./logger.js');
const chalk = require('chalk');
// Connection URL
const url = 'mongodb://bot:assWord@localhost:27017/assWord?authSource=admin';
const client = new MongoClient(url);
const dbname = 'test';
const collname = 'tracks2';

async function getTrack(query, keepAlive) {
  // returns the first track object that matches the query
  try {
    await client.connect();
    const database = client.db(dbname);
    const tracks = database.collection(collname);
    const track = await tracks.findOne(query);
    return track;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  } finally {
    if (keepAlive != true) {await client.close();}
  }
}
/*
Usage examples:
get track by youtubeURL: await getTrack({youtubeURL: 'mdh6upXZL6c'});
spotifyURI: await getTrack({ spotifyURI: 'spotify:track:76nqR8hb279mkQLNkQMzK1' });
key: await getTrack({ keys: { $in: ['haken%20celestial%20elixir'] } });
also key: await getTrack({ keys:'tng%20those%20arent%20muskets' });
should be fairly self explanatory overall - the $in operator lets you query for any exact match in the array.
some time later: having read further, apparently you don't need the $in operator and I'm not sure why you'd ever use it vs not given that the second also works? this documentation did a poor job explaining things
generally speaking we should let the client close after the query - but if there are issues with repeated queries, could try setting keepAlive to true;
*/

async function insertTrack(track, query) {
  // inserts a single track object into the database
  if (query == null) {query = 'youtubeURL';} // by default, check for duplicate youtube urls - if we want to lookout for eg. spotifyURIs instead, can specify
  try {
    await client.connect();
    const database = client.db(dbname);
    const tracks = database.collection(collname);
    // check if we already have this url
    const test = await tracks.findOne({ [query]: track[query] });
    if (test == null || test[query] != track[query]) {
      // we don't have this in our database yet, so
      const result = await tracks.insertOne(track);
      logLine('database', [`Adding track ${chalk.green(track.title)} by ${chalk.green(track.artist)} to database`]);
      return result;
    } else { throw new Error(`Track ${track.youtubeURL} already exists!`);}
    // console.log(track);
  } catch (error) {
    logLine('error', ['database error:', error.message]);
  } finally {
    await client.close();
  }
}

async function addKey(query, newkey) {
  // adds a new key to a track we already have
  // silently fails if we don't have the track in the DB already
  try {
    await client.connect();
    const database = client.db(dbname);
    const tracks = database.collection(collname);
    await tracks.updateOne(query, { $addToSet: { keys: newkey } });
    logLine('database', [`Adding key ${chalk.blue(newkey)} to${chalk.green(query)}`]);
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  } finally {
    await client.close();
  }
}
// addKey({ spotifyURI: 'spotify:track:7BnKqNjGrXPtVmPkMNcsln' }, 'celestial%20elixr');

async function addPlaylist(trackarray, listname) {
  // takes an ordered array of tracks and a playlist name, and adds the playlist name and track number to those tracks in the database
  // assumes tracks already exist - if they're not in the database yet, this does nothing - but that should never happen
  const test = await getPlaylist(listname);
  if (!test.length) {
    try {
      await client.connect();
      const database = client.db(dbname);
      const tracks = database.collection(collname);
      trackarray.forEach(async (element, index, array) => {
        const query = { 'youtubeURL': element.youtubeURL };
        await tracks.updateOne(query, { $addToSet: { playlists:{ [listname]:index } } });
        logLine('database', [`Adding playlist entry ${chalk.blue(listname + ':' + index)} to${chalk.green(element.title)} by ${chalk.green(element.artist)}`]);
        if (index == array.length - 1) {await client.close();}
      });
    } catch (error) {
      logLine('error', ['database error:', error.stack]);
    }
  } else { return `Playlist ${listname} already exists.`; }
}

async function getPlaylist(listname) {
  // returns a playlist as an array of tracks, ready for use
  try {
    await client.connect();
    const database = client.db(dbname);
    const tracks = database.collection(collname);
    const qustr = `playlists.${listname}`;
    const query = { [qustr]: { $exists: true } };
    const options = { sort: { 'playlists.trainsong':1 } };
    const cursor = await tracks.find(query, options);
    const everything = await cursor.toArray();
    return everything;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  } finally {
    await client.close();
  }
}

async function removePlaylist(listname) {
  try {
    await client.connect();
    const database = client.db(dbname);
    const tracks = database.collection(collname);
    const qustr = `playlists.${listname}`;
    const query = { [qustr]: { $exists: true } };
    const filt = { $pull:{ 'playlists': { [listname]: { $exists: true } } } };
    const result = await tracks.updateMany(query, filt);
    logLine('database', [`Removed playlist ${chalk.blue(listname)} from ${chalk.green(result.modifiedCount)} tracks.`]);
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  } finally {
    await client.close();
  }
}
/*
async function dootherthing() {
  const trackarray = await getPlaylist('trainsong');
  console.log(JSON.stringify(trackarray, null, '  '));
}
dootherthing();
*/
/*
const playlists = require('./playlists.js');
async function dothing() {
  const result = await addPlaylist(playlists.trainsong, 'trainsong');
  console.log(result);
  //  playlists.trainsong.forEach(async element => {
  //    await insertTrack(element);
  //  });
  // await removePlaylist('trainsong');
}
dothing();
/*
async function dothething() {
  const test = await getTrack({ spotifyURI: 'spotify:track:7BnKqNjGrXPtVmPkMNcsln' });
  console.log(test);
}

dothething();
*/

exports.getTrack = getTrack;
exports.insertTrack = insertTrack;
exports.addKey = addKey;
exports.addPlaylist = addPlaylist;
exports.getPlaylist = getPlaylist;
exports.removePlaylist = removePlaylist;