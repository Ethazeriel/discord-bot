const MongoClient = require('mongodb').MongoClient;

// Connection URL
const url = 'mongodb://bot:assWord@localhost:27017/assWord?authSource=admin';
const client = new MongoClient(url);

async function getTrack(query, keepAlive) {
  // returns the first track object that matches the query
  try {
    await client.connect();
    const database = client.db('test');
    const tracks = database.collection('tracks');
    const track = await tracks.findOne(query);
    // console.log(track);
    return track;
  } catch (error) {
    console.log('error with database: \n' + error.stack);
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
    const database = client.db('test');
    const tracks = database.collection('tracks');
    // check if we already have this url
    const test = await tracks.findOne({ [query]: track[query] });
    if (test == null || test[query] != track[query]) {
      // we don't have this in our database yet, so
      await tracks.insertOne(track);
    } else { throw new Error(`Track ${track.youtubeURL} already exists!`);}
    // console.log(track);
  } catch (error) {
    console.log('error with database: \n' + error.stack);
  } finally {
    await client.close();
  }
}

async function addKey(query, newkey) {
  // adds a new key to a track we already have
  // silently fails if we don't have the track in the DB already
  try {
    await client.connect();
    const database = client.db('test');
    const tracks = database.collection('tracks');
    await tracks.updateOne(query, { $addToSet: { keys: newkey } });
  } catch (error) {
    console.log('error with database: \n' + error.stack);
  } finally {
    await client.close();
  }
}
// addKey({ spotifyURI: 'spotify:track:7BnKqNjGrXPtVmPkMNcsln' }, 'celestial%20elixr');
/*
async function dothething() {
  const test = await getTrack({ spotifyURI: 'spotify:track:7BnKqNjGrXPtVmPkMNcsln' });
  console.log(test);
}

dothething();
/*
insertTrack({
  "keys": [
    "tng%20those%20arent%20muskets", "those%20arent%20muskets", "star%20trek%20rap"
  ],
  "playlists": [],
  "title": "Star Trek Rap (feat. Prime Directive and Galaxy Class)",
  "duration": 300,
  "youtubeURL": "ClP8n6asn3w",
  "youtubeArt": "https://i.ytimg.com/vi/ClP8n6asn3w/hqdefault.jpg",
  "alternatives": [
    {
      "youtubeTitle": "Mike and Rich&#39;s Top 5 Star Trek TNG Episodes! - re:View (part 1)",
      "youtubeURL": "m-hGLHOzvgs",
      "youtubeArt": "https://i.ytimg.com/vi/m-hGLHOzvgs/hqdefault.jpg"
    },
    {
      "youtubeTitle": "25 great commander riker quotes",
      "youtubeURL": "sNhU-T7wSUE",
      "youtubeArt": "https://i.ytimg.com/vi/sNhU-T7wSUE/hqdefault.jpg"
    },
    {
      "youtubeTitle": "10 Creepiest Things Seen By Astronauts In Space.",
      "youtubeURL": "YhsS0yLISuo",
      "youtubeArt": "https://i.ytimg.com/vi/YhsS0yLISuo/hqdefault.jpg"
    },
    {
      "youtubeTitle": "Let&#39;s Play! - SLUDGE by Metal King Studio",
      "youtubeURL": "MWysgXfhIg0",
      "youtubeArt": "https://i.ytimg.com/vi/MWysgXfhIg0/hqdefault.jpg"
    }
  ]
}, 'youtubeURL');


/*
const track = [
  {
    keys: [],
    playlists: [ { playlistName: name, playlistPosition: number } ],
    title: 'The Path',
    artist: 'Haken',
    album: 'The Mountain',
    trackNumber: 1,
    duration: 240,
    spotifyURI: 'totes real uri',
    youtubeURL: 'https://www.youtube.com/watch?v=lBZ3gfaMQVI',
    spotifyArt: 'uri:albumart/TheMountain.jpg',
    youtubeArt: 'uri:youtube thumbnail here',
    alternatives: [
      // [n]: { youtubeURL, youtubeThumbnail, youtubeTitle }, ...
    ],
  },
]
*/
exports.getTrack = getTrack;
exports.insertTrack = insertTrack;
exports.addKey = addKey;