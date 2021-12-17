const MongoClient = require('mongodb').MongoClient;
const { logLine } = require('./logger.js');
const chalk = require('chalk');
const { mongo } = require('./config.json');
// Connection URL
const url = mongo.url;
const dbname = mongo.database;
const collname = mongo.collection;
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
    const tracks = db.collection(collname);
    const track = await tracks.findOne(query);
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

async function insertTrack(track, query) {
  // inserts a single track object into the database
  if (query == null) {query = 'youtube';} // by default, check for duplicate youtube urls - if we want to lookout for eg. spotifyURIs instead, can specify
  const id = 'id';
  const search = query + '.id';
  try {
    const tracks = db.collection(collname);
    // check if we already have this url
    if (!track.ephemeral) {
      const test = await tracks.findOne({ [search]: track[query][id] });
      if (test == null || test[query][id] != track[query][id]) {
      // we don't have this in our database yet, so
        const result = await tracks.insertOne(track);
        logLine('database', [`Adding track ${chalk.green(track.spotify.name || track.youtube.name)} by ${chalk.green(track.artist.name)} to database`]);
        return result;
      } else { throw new Error(`Track ${track.youtube.id} already exists!`);}
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
    const tracks = db.collection(collname);
    await tracks.updateOne(query, { $addToSet: { keys: newkey } });
    logLine('database', [`Adding key ${chalk.blue(newkey)} to ${chalk.green(query)}`]);
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}
// addKey({ 'spotify.id': '7BnKqNjGrXPtVmPkMNcsln' }, 'celestial%20elixr');

async function addPlaylist(trackarray, listname) {
  // takes an ordered array of tracks and a playlist name, and adds the playlist name and track number to those tracks in the database
  // assumes tracks already exist - if they're not in the database yet, this does nothing - but that should never happen
  const test = await getPlaylist(listname);
  if (!test.length) {
    try {
      const tracks = db.collection(collname);
      trackarray.forEach(async (element, index) => {
        const query = { 'youtube.id': element.youtube.id };
        const field = `playlists.${listname}`;
        await tracks.updateOne(query, { $set: { [field]:index } });
        logLine('database', [`Adding playlist entry ${chalk.blue(listname + ':' + index)} to ${chalk.green(element.spotify.name || element.youtube.name)} by ${chalk.green(element.artist.name)}`]);
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
    const tracks = db.collection(collname);
    const qustr = `playlists.${listname}`;
    const query = { [qustr]: { $exists: true } };
    const options = { sort: { [qustr]:1 } };
    const cursor = await tracks.find(query, options);
    const everything = await cursor.toArray();
    return everything;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function removePlaylist(listname) {
  try {
    const tracks = db.collection(collname);
    const qustr = `playlists.${listname}`;
    const query = { [qustr]: { $exists: true } };
    const filt = { $unset:{ [qustr]: '' } };
    const result = await tracks.updateMany(query, filt);
    logLine('database', [`Removed playlist ${chalk.blue(listname)} from ${chalk.green(result.modifiedCount)} tracks.`]);
    return result.modifiedCount;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function updateTrack(query, update) {
  // generic update function; basically just a wrapper for updateOne
  try {
    const tracks = db.collection(collname);
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
    const tracks = db.collection(collname);
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
    const tracks = db.collection(collname);
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
    const tracks = db.collection(collname);
    const qustr = `album.${type}`;
    const query = { [qustr]: request };
    const options = { sort: { 'album.trackNumber':1 } };
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
    const tracks = db.collection(collname);
    const number = await tracks.count();
    logLine('database', [`We currently have ${chalk.green(number)} tracks in the ${dbname} database, collection ${collname}.`]);
    return number;
  } catch (error) {
    logLine('error', ['database error:', error.stack]);
  }
}

async function listPlaylists() {
  // returns all the playlists we have as a set
  // this may take a long time to return and a lot of cpu once we've got more than a few playlists; consider revising
  try {
    const tracks = db.collection(collname);
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


exports.getTrack = getTrack;
exports.insertTrack = insertTrack;
exports.addKey = addKey;
exports.addPlaylist = addPlaylist;
exports.getPlaylist = getPlaylist;
exports.removePlaylist = removePlaylist;
exports.getAlbum = getAlbum;
exports.printCount = printCount;
exports.closeDB = closeDB;
exports.listPlaylists = listPlaylists;
exports.removeTrack = removeTrack;
exports.switchAlternate = switchAlternate;
exports.updateTrack = updateTrack;