const { logLine } = require('./logger.js');
const db = require('./database.js');
const { youtubePattern, spotifyPattern, sanitize } = require('./regexes.js');
const ytdl = require('ytdl-core');

const request = require('request');

const auth = require('./config.json');
auth.spotify.authOptions = {
  'url': 'https://accounts.spotify.com/api/token',
  'headers': {
    'Authorization': 'Basic ' + (Buffer.from(auth.spotify.client_id + ':' + auth.spotify.client_secret).toString('base64')),
  },
  'form': {
    'grant_type': 'client_credentials',
  },
  'json': true,
};

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

function youtubeGet(options) {
  return (new Promise((resolve, reject) => request.get(options, (error, response, body) => {
    if (!error) {
      // console.log('youtubeget, no error');
      if (response.statusCode === 200) {
        // console.log('youtubeget, status good, return body');
        resolve(body);
      } else if (response.statusCode === 403) {
        if (response.headers['quotaExceeded']) {
          // do things about the quota being exceeded
        }
        reject(new Error('youtubeGet failing', { cause: { options: options, error: error, response: response, body:body } }));
      }
    } else {
      reject(new Error('youtubeGet failing', { cause: { options: options, error: error, response: response, body:body } }));
    }
  })));
}

function spotifyGet(options) {
  return (new Promise((resolve, reject) => request.get(options, (error, response, body) => {
    if (!error) {
      if (response.statusCode === 200) {
        resolve(body);
      } else {
        reject(new Error('spotifyGet failing', { cause: { options: options, error: error, response: response, body:body } }));
      }
    } else {
      reject(new Error('spotifyGet failing', { cause: { options: options, error: error, response: response, body:body } }));
    }
  })));
}

function spotifyPost(options) {
  return (new Promise((resolve, reject) => request.post(options, async (error, response, body) => {
    if (!error) {
      if (response.statusCode === 200) {
        resolve(body);
      } else if (response.statusCode === 429) {
        const delayInSeconds = response.headers['Retry-After'];
        if (delayInSeconds) {
          await sleep((delayInSeconds * 1000));
          resolve(spotifyPost(options));
        } else {
          reject(new Error('spotifyPost failing', { cause: { options: options, error: error, response: response, body:body } }));
        }
      }
    } else {
      reject(new Error('spotifyPost failing', { cause: { options: options, error: error, response: response, body:body } }));
    }
  })));
}

/* this whole thing is fairly horrid. will fix later
*/
async function fetch(search) {
  search = search.replace(sanitize, ''); // destructive removal of invalid symbols
  search = search.trim(); // remove leading and trailing spaces

  if (youtubePattern.test(search)) {
    const track = await fromYoutube(search);
    return ((track) ? Array(track) : null);
  } else if (spotifyPattern.test(search)) {
    const match = search.match(spotifyPattern);
    if (match[1] == 'playlist') { // crude, temporary bandaid for playlist of entirely songs we don't have, where youtube 100% fails to return retults
      const tracks = await spotifyPlaylist(search);
      return ((tracks.length > 0) ? tracks : null);
    } else { // crude, temporary bandaid
      logLine('error', [`search: ${search} failing, because you still haven't fixed spotify stack/album searches`]);
      return (null);
    }
  } else {
    search = search.toLowerCase();
    const track = await fromText(search);
    return ((track) ? Array(track) : null);
  }
}

/*
currently if spotify requests fail, this fails. longer term intending to change this to use track.ephemeral and go ahead with the search */
async function fromText(search) {
  logLine('info', [`fromText search= '${search}'`]);

  let track = await db.getTrack({ keys: search });
  if (track) {
    logLine('track', [`have track '${track.spotify.name}' by key: '${search}'`]);
    return (track);
  } else {
    const spotifyCredentials = await spotifyPost(auth.spotify.authOptions).catch(error => {
      logLine('error', ['spotifyPost failing:', JSON.stringify(error.cause)]);
    });
    if (!spotifyCredentials) { return null; } // is return; the same as return null? do check

    const spotifyOptions = {
      url: `https://api.spotify.com/v1/search?type=track&limit=1&q=${search}`,
      headers: {
        'Authorization': 'Bearer ' + spotifyCredentials.access_token,
      },
      json: true,
    };

    const spotifyResult = await spotifyGet(spotifyOptions).catch(error => {
      logLine('error', ['spotifyGet failing:', JSON.stringify(error.cause, '', 2)]);
    });
    if (!spotifyResult) { return; }

    if (spotifyResult.tracks.items?.[0]) {
      track = await db.getTrack({ 'spotify.id': spotifyResult.tracks.items[0].id });
    }
    if (track) {
      logLine('track', [`have track '${track.spotify.name}' by spotify id, adding key: '${search}'`]); // rewrite to not be name null when no spotify
      await db.addKey({ 'spotify.id' : track.spotify.id }, search);
      return (track);
    } else {
      let query = (spotifyResult.tracks.items?.[0]) ? `${spotifyResult.tracks.items[0].artists[0].name} ${spotifyResult.tracks.items[0].name}` : search;
      query = await query.replace(sanitize, '');
      const youtubeOptions = {
        url: 'https://youtube.googleapis.com/youtube/v3/search?q=' + query + '&type=video&part=id%2Csnippet&fields%3Ditems%28id%2FvideoId%2Csnippet%28title%2Cthumbnails%29%29&maxResults=5&safeSearch=none&key=' + auth.youtube.apiKey,
        json: true,
      };
      logLine('info', [` youtube query: ${query}`]);
      const youtubeResult = await youtubeGet(youtubeOptions).catch(error => {
        logLine('error', ['youtubeGet failing:', JSON.stringify(error.cause, '', 2)]);
      });

      track = await db.getTrack({ 'youtube.id': youtubeResult?.items?.[0]?.id?.videoId });
      if (track) {
        if (spotifyResult.tracks.items?.[0]) {
          logLine('error', [`have track '${track.spotify.name}' by youtube.id: '${youtubeResult.items[0].id.videoId}' for track lacking spotify details. manually update:`, `${JSON.stringify(spotifyResult.tracks.items[0], '', 2)}`]);
        }
        await db.addKey({ 'youtube.id' : track.youtube.id }, search);
        return (track);
      } else {
        track = {
          'keys' : [search],
          'playlists': [
            {
            },
          ],
          'album' : {
            'id' : spotifyResult.tracks.items?.[0]?.album?.id || null,
            'name' : spotifyResult.tracks.items?.[0]?.album?.name,
            'trackNumber' : spotifyResult.tracks.items?.[0]?.track_number,
          },
          'artist' : {
            'id' : spotifyResult.tracks.items?.[0]?.artists?.[0]?.id,
            'name' : spotifyResult.tracks.items?.[0]?.artists?.[0]?.name,
          },
          'spotify' : {
            'id' : spotifyResult.tracks.items?.[0]?.id,
            'name' : spotifyResult.tracks.items?.[0]?.name,
            'art' : spotifyResult.tracks.items?.[0]?.album?.images?.[0]?.url,
            'duration' : (Number.isNaN(spotifyResult.tracks.items?.[0]?.duration_ms)) ? null : spotifyResult.tracks.items?.[0]?.duration_ms / 1000,
          },
          'youtube' : {
            'id' : youtubeResult.items[0].id.videoId,
            'name' : youtubeResult.items[0].snippet.title,
            'art' : youtubeResult.items[0].snippet.thumbnails.high.url,
            'duration' : null,
          },
          'alternates': [],
        };

        for (let i = 1; i < youtubeResult.items.length; i++) {
          track.alternates.push({
            'id': youtubeResult.items[i].id.videoId,
            'name': youtubeResult.items[i].snippet.title,
            'art': youtubeResult.items[i].snippet.thumbnails.high.url,
            'duration': null,
          });
        }

        const promises = [];
        for (let j = 0; j < youtubeResult.items.length; j++) {
          promises.push(ytdl.getBasicInfo(youtubeResult.items[j].id.videoId));
        }
        await Promise.allSettled(promises).then(values => {
          for (let k = 0; k < promises.length; k++) {
            if (values[k].status == 'fulfilled') {
              if (k == 0) {
                track.youtube.duration = Number(values[k].value.player_response.videoDetails.lengthSeconds);
                if (values[k].value.videoDetails.media?.song) {
                  track.youtube.name = values[k].value.videoDetails.media.song;
                }
              } else {
                track.alternates[k - 1].duration = Number(values[k].value.player_response.videoDetails.lengthSeconds);
                if (values[k].value.videoDetails.media?.song) {
                  track.alternates[k - 1].name = values[k].value.videoDetails.media.song;
                }
              }
            }
          }
        });

        await db.insertTrack(track, 'youtube');

        return (track);
      }
    }
  }
}

/*
this will fail badly in some cases, like if all youtube result sets are empty, null, or all throw errors.
my intended rewrite of this to better use promises should fix this
*/
async function spotifyPlaylist(search) { // assume already passed spotifyPattern.test
  const match = search.match(spotifyPattern);

  const spotifyCredentials = await spotifyPost(auth.spotify.authOptions).catch(error => {
    logLine('error', ['spotifyPost failing:', JSON.stringify(error.cause)]);
  });
  if (!spotifyCredentials) { return null; }

  const fields = {
    playlist : '?fields=tracks.items(track(album(id,name,images),artists(id,name),track_number,id,name,duration_ms))',
    album : '', // is ignored, but should be '?fields=id,name,artists(id,name),images,tracks.items(track_number,id,name,duration_ms)',
    track : '', // is ignored, but should be '?fields=track_number,id,name,duration_ms,album(id,name,images),artists(id,name)',
  };
  const spotifyOptions = {
    url: `https://api.spotify.com/v1/${match[1]}s/${match[2]}${fields[match[1]]}`,
    headers: {
      'Authorization': 'Bearer ' + spotifyCredentials.access_token,
    },
    json: true,
  };
  logLine('info', [`spotifyPlaylist search= '${search}''`]);

  const spotifyResult = await spotifyGet(spotifyOptions).catch(error => {
    logLine('error', ['spotifyGet failing:', JSON.stringify(error.cause, '', 2)]);
  });
  if (!(spotifyResult?.tracks?.items?.[0])) { return null; }

  let promises = [];
  for (let i = 0; i < spotifyResult.tracks.items.length; i++) {
    promises[i] = db.getTrack({ 'spotify.id': spotifyResult.tracks.items[i].track.id });
  }

  console.log();
  const tracks = [];
  await Promise.allSettled(promises).then(values => {
    for (let i = 0; i < spotifyResult.tracks.items.length; i++) {
      if (values[i].status == 'fulfilled') {
        if (values[i].value) {
          logLine('track', [`[${i}] have '${spotifyResult.tracks.items[i].track.name}'`]);
          tracks[i] = values[i].value;
        } else {
          logLine('info', [` [${i}] lack '${spotifyResult.tracks.items[i].track.name}'`]);
        }
      } else {
        logLine('error', ['db.getTrack by spotify.id promise reject,', `from search: ${search}`, `for element ${JSON.stringify(spotifyResult.tracks.items[i], '', 2)}`]);
      }
    }
  }).catch(err => {
    const error = new Error('get track by spotify.id exception', { cause: err });
    logLine('error', ['db.getTrack exception and full abort: ', JSON.stringify(error.cause, '', 2)]);
    throw (error);
  });

  console.log();
  promises = [];
  for (let i = 0; i < spotifyResult.tracks.items.length; i++) {
    if (!tracks[i]) {
      const query = `${spotifyResult.tracks.items[i].track.artists[0].name} ${spotifyResult.tracks.items[i].track.name}`;
      const youtubeOptions = {
        url: 'https://youtube.googleapis.com/youtube/v3/search?q=' + query + '&type=video&part=id%2Csnippet&fields%3Ditems%28id%2FvideoId%2Csnippet%28title%2Cthumbnails%29%29&maxResults=5&safeSearch=none&key=' + auth.youtube.apiKey,
        json: true,
      };
      logLine('info', [` [${i}] youtube query: ${query}`]);
      promises[i] = youtubeGet(youtubeOptions).catch(error => {
        logLine('error', ['youtubeGet failing:', JSON.stringify(error.cause, '', 2)]);
      });
    } else {
      logLine('track', [`[${i}] youtube skip`]);
    }
  }

  console.log();
  const youtubeResults = [];
  await Promise.allSettled(promises).then(values => {
    // console.log(`youtube settled, values.length= ${values.length}`); //
    for (let i = 0; i < promises.length; i++) {
      if (values[i]) {
        if (values[i].status == 'fulfilled') {
          if (values[i].value) {
            logLine('info', [`[${i}] ${spotifyResult.tracks.items[i].track.name} retrieved, id= '${values[i].value?.items?.[0]?.id?.videoId}'`]);
            youtubeResults[i] = values[i].value;
          }
        } else {
          logLine('error', [`[${i}] youtube promise rejected`, `query was presumably '${spotifyResult.tracks.items[i].track.artists[0].name} ${spotifyResult.tracks.items[i].track.name}'`]);
        }
      }
    }
  });

  promises = [];
  for (let i = 0; i < youtubeResults.length; i++) {
    if (youtubeResults[i]) {
      promises[i] = db.getTrack({ 'youtube.id': youtubeResults[i]?.items?.[0]?.id?.videoId });
    }
  }

  console.log();
  await Promise.allSettled(promises).then(values => {
    for (let i = 0; i < promises.length; i++) {
      if (values[i]) {
        if (values[i].status == 'fulfilled') {
          if (values[i].value) {
            logLine('error', [`[${i}] have track '${spotifyResult.tracks.items[i].track.name}' by youtube.id for track lacking spotify details. manually update:`, `${JSON.stringify(spotifyResult.tracks.items[i], '', 2)}`]);
            tracks[i] = values[i].value;
          }
        } else {
          logLine('error', ['db.getTrack by youtube.id promise rejected,', `youtubeResult: ${JSON.stringify(youtubeResults[i], '', 2)}`, `spotifyResult: ${JSON.stringify(spotifyResult.tracks.items[i], '', 2)}`]);
        }
      }
    }
  });

  promises = [];
  for (let i = 0; i < spotifyResult.tracks.items.length; i++) {
    if (!tracks[i]) {
      try {
        const track = {
          'keys' : [],
          'playlists': [
            {
            },
          ],
          'album' : {
            'id' : spotifyResult.tracks.items[i].track.album.id,
            'name' : spotifyResult.tracks.items[i].track.album.name,
            'trackNumber' : spotifyResult.tracks.items[i].track.track_number,
          },
          'artist' : {
            'id' : spotifyResult.tracks.items[i].track.artists[0].id,
            'name' : spotifyResult.tracks.items[i].track.artists[0].name,
          },
          'spotify' : {
            'id' : spotifyResult.tracks.items[i].track.id,
            'name' : spotifyResult.tracks.items[i].track.name,
            'art' : spotifyResult.tracks.items[i].track.album.images[0].url,
            'duration' : spotifyResult.tracks.items[i].track.duration_ms / 1000,
          },
          'youtube' : {
            'id' : youtubeResults[i].items[0].id.videoId,
            'name' : youtubeResults[i].items[0].snippet.title,
            'art' : youtubeResults[i].items[0].snippet.thumbnails.high.url,
            'duration' : null,
          },
          'alternates': [],
        };

        for (let k = 1; k < youtubeResults[i].items.length; k++) {
          track.alternates.push({
            'id': youtubeResults[i].items[k].id.videoId,
            'name': youtubeResults[i].items[k].snippet.title,
            'art': youtubeResults[i].items[k].snippet.thumbnails.high.url,
            'duration': null,
          });
        }

        const internalPromises = [];
        for (let j = 0; j < youtubeResults[i].items.length; j++) {
          internalPromises.push(ytdl.getBasicInfo(youtubeResults[i].items[j].id.videoId));
        }
        await Promise.allSettled(internalPromises).then(values => {
          for (let q = 0; q < internalPromises.length; q++) {
            if (values[q].status == 'fulfilled') {
              if (q == 0) {
                track.youtube.duration = Number(values[q].value.videoDetails.lengthSeconds);
                if (values[q].value.videoDetails.media?.song) {
                  track.youtube.name = values[q].value.videoDetails.media.song;
                }
              } else {
                track.alternates[q - 1].duration = Number(values[q].value.videoDetails.lengthSeconds);
                if (values[q].value.videoDetails.media?.song) {
                  track.alternates[q - 1].name = values[q].value.videoDetails.media.song;
                }
              }
            }
          }
        });

        tracks[i] = track;
        promises[i] = db.insertTrack(track, 'youtube');
      } catch (error) {
        console.log(`[${i}] failing assignment; ${youtubeResults[i]}`);
      }
    } else {
      // logLine('track', [`[${i}] already exists`]);
    }
  }

  await Promise.allSettled(promises).catch(error => {
    logLine('error', [error.stack]);
  });
  console.log('exiting');
  return (tracks);
}

/* if ytdl returns nothing or an empty set, like on a private video? potential for this to fail and be handled poorly */
async function fromYoutube(search) { // assume already passed youtubePattern.test
  logLine('info', [`fromYoutube search= '${search}'`]);

  const match = search.match(youtubePattern);
  let track = await db.getTrack({ 'youtube.id': match[2] });
  if (track) {
    logLine('track', [`have track '${track.youtube.name}' by youtube id`]);
    return (track);
  } else {
    const ytdlResult = await ytdl.getBasicInfo(match[2]);
    if (!ytdlResult) { // test private/unlisted video, see if failure returns null or an empty set we have to check
      logLine('error', [`ytdlResult nullish: ${ytdlResult}`]);
      return (null);
    }
    let query = (ytdlResult.videoDetails.media?.song && ytdlResult.videoDetails.media?.artist) ? `${ytdlResult.videoDetails.media.song} ${ytdlResult.videoDetails.media?.artist}` : ytdlResult.videoDetails.title;
    query = query.replace(sanitize, '');
    const spotifyCredentials = await spotifyPost(auth.spotify.authOptions).catch(error => {
      logLine('error', ['spotifyPost failing:', JSON.stringify(error.cause)]);
    });
    if (!spotifyCredentials) { // don't think I like this failure path, so leaving this to remind me
      logLine('error', [`spotifyCredentials nullish: ${JSON.stringify(spotifyCredentials, '', 2)} for query: ${query} and search: ${search}`]);
      return (null);
    }
    const spotifyOptions = {
      url: `https://api.spotify.com/v1/search?type=track&limit=1&q=${query}`,
      headers: {
        'Authorization': 'Bearer ' + spotifyCredentials.access_token,
      },
      json: true,
    };

    logLine('info', [` spotify query: ${query}`]);
    const spotifyResult = await spotifyGet(spotifyOptions).catch(error => {
      logLine('error', ['spotifyGet failing:', JSON.stringify(error.cause, '', 2)]);
    });

    if (spotifyResult.tracks.items?.[0]) {
      track = await db.getTrack({ 'spotify.id': spotifyResult.tracks.items[0].id });
    }
    if (track) {
      logLine('track', [`track '${track.spotify.name}' is tied to '${track.youtube.id}', not '${match[2]}'. will be ephemeral`]);
      track.ephemeral = `track '${track.spotify.name}' is tied to '${track.youtube.id}', not '${match[2]}'. manual overwrite necessary if preferred`;
    } else {
      track = {};
    }

    track.keys = track.keys || [],
    track.playlists = track.playlists || [],
    track.album = {
      'id' : spotifyResult.tracks.items?.[0]?.album?.id || null,
      'name' : spotifyResult.tracks.items?.[0]?.album?.name || null,
      'trackNumber' : spotifyResult.tracks.items?.[0]?.track_number || null,
    },
    track.artist = {
      'id' : spotifyResult.tracks.items?.[0]?.artists?.[0]?.id || null,
      'name' : spotifyResult.tracks.items?.[0]?.artists?.[0]?.name || (ytdlResult.videoDetails.media?.artist?.replace(sanitize, '')) || null,
    },
    track.spotify = {
      'id' : spotifyResult.tracks.items?.[0]?.id || null,
      'name' : spotifyResult.tracks.items?.[0]?.name || null,
      'art' : spotifyResult.tracks.items?.[0]?.album?.images?.[0]?.url || null,
      'duration' : (spotifyResult.tracks.items?.[0]?.duration_ms / 1000) || null,
    },
    track.youtube = {
      'id' : ytdlResult.videoDetails.videoId.replace(sanitize, ''),
      'name' : (ytdlResult.videoDetails.media?.song || ytdlResult.videoDetails.title).replace(sanitize, ''),
      'art' : (ytdlResult.player_response.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url).replace(sanitize, ''),
      'duration' : ytdlResult.videoDetails.lengthSeconds,
    },
    track.alternates = track.alternates || [];

    if (!track.ephemeral) {
      await db.insertTrack(track, 'youtube');
    }

    return (track);
  }
}

/* (async () => {
  await sleep(2000);
  const prompt = require('prompt-sync')({ sigint: true });
  let exit = false;

  while (!exit) {
    const input = prompt('add, clear, quit: ');

    if (input == 'add') {
      const search = prompt('search for: ');
      await fetch(search);
    } else if (input == 'clear') {
      console.clear();
    } else if (input == 'quit') {
      db.closeDB();
      exit = true;
    } else {
      console.log('\ninvalid input');
    }
  }
})(); */

exports.fetch = fetch;