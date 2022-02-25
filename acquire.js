import fs from 'fs';
import axios from 'axios';
import ytdl from 'ytdl-core';
import crypto from 'crypto';
import * as db from './database.js';
import { logLine, logSpace, logDebug } from './logger.js';
const { spotify, youtube } = JSON.parse(fs.readFileSync('./config.json'));
import { youtubePattern, spotifyPattern, sanitize } from './regexes.js';

spotify.auth = {
  url: 'https://accounts.spotify.com/api/token',
  method: 'post',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': 'Basic ' + (Buffer.from(spotify.client_id + ':' + spotify.client_secret).toString('base64')),
  },
  data: 'grant_type=client_credentials',
  timeout: 1000,
};

export default async function fetch(search) {
  search = search.replace(sanitize, ''); // destructive removal of invalid symbols
  search = search.trim(); // remove leading and trailing spaces

  if (youtubePattern.test(search)) {
    return (await fromYoutube(search));
  } else {
    return (await fromSpotify(search));
  }
}

// search will be sanitized
async function fromSpotify(search, partial = false) {
  logLine('info', [`fromSpotify search= '${search}'`]);

  const is = {
    playlist : undefined,
    album : undefined,
    track : undefined,
  };
  let match;
  if (spotifyPattern.test(search)) {
    match = search.match(spotifyPattern);
    is[match[1]] = true;
  }

  {
    let track;
    if (!match) {
      search = String(search).toLowerCase();
      track = await db.getTrack({ keys: search });
    } else if (is.track) {
      track = await db.getTrack({ 'spotify.id': match[2] });
    }

    if (track) {
      logLine('fetch', [`[0] have '${ track.spotify.name || track.youtube.name }'`]);
      return (Array(track));
    }
  }

  const { data : spotifyCredentials } = await axios(spotify.auth).catch(error => {
    logLine('error', ['spotifyAuth: ', `headers: ${error.response.headers}`, error.stack]);
    return (null);
  });

  const fields = {
    playlist : '?fields=tracks.items(track(album(id,name,images),artists(id,name),track_number,id,name,duration_ms))',
    album : '', // is ignored, but should be '?fields=id,name,artists(id,name),images,tracks.items(track_number,id,name,duration_ms)',
    track : '', // is ignored, but should be '?fields=track_number,id,name,duration_ms,album(id,name,images),artists(id,name)',
    query : '', // is ignored, but should be '?fields=tracks.items(album(id,name,images),artists(id,name),track_number,id,name,duration_ms)',
  };

  const spotifyQuery = {
    url: `${(match) ? `https://api.spotify.com/v1/${match[1]}s/${match[2]}${fields[match[1]]}` : `https://api.spotify.com/v1/search?type=track&limit=1&q=${search}`}`,
    method: 'get',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Bearer ' + spotifyCredentials.access_token,
    },
    timeout: 1000,
  };

  const { data : spotifyResult } = await axios(spotifyQuery).catch(error => {
    logLine('error', ['spotifyQuery: ', error.stack]);
    return (null);
  });

  logSpace();

  let i = 0;
  let promises = [];
  const tracksInfo = [];
  do {
    let id;
    tracksInfo[i] = {};
    if (is.track) {
      id = match[2];
      // and we know we don't have it, cause we'd have returned it at the beginning
    } else {
      //   playlist                                 || album, text                       || track. spotifyResult.id collides on album and track, so goes last
      id = spotifyResult.tracks.items[i]?.track?.id || spotifyResult.tracks.items[i]?.id || spotifyResult.id;
      if (id) { promises[i] = db.getTrack({ 'spotify.id': id }); }
      if (!promises[i]) {
        const resultName = spotifyResult.tracks?.items?.[i]?.track?.name || spotifyResult.tracks?.items?.[i]?.name || spotifyResult.name;
        const resultArtist = spotifyResult.tracks?.items?.[i]?.track?.artists?.[0]?.name || spotifyResult.tracks?.items?.[i]?.artists?.[0]?.name || spotifyResult.artists?.[0]?.name;
        promises[i] = db.getTrack({ $and: [{ 'spotify.name': resultName }, { 'artist.name': resultArtist }] });
      }
    }
    tracksInfo[i] = {
      id: id,
    };
    i++;
  } while (i < spotifyResult?.tracks?.items?.length);

  i = 0;
  const tracks = [];
  await Promise.allSettled(promises).then(values => {
    do {
      const title =
        (is.playlist) ? `${spotifyResult.tracks?.items?.[i]?.track?.name}` :
          (is.album) ? `${spotifyResult.tracks?.items?.[i]?.name}` :
            (is.track) ? `${spotifyResult.name}` :
              (spotifyResult.tracks?.items?.[0]) ? spotifyResult.tracks?.items?.[0]?.name : search;
      tracksInfo[i].title = title;

      if (values[i]?.status == 'rejected') {
        logLine('error', ['spotify.id db.getTrack promise rejected,', `from search: ${search}`, `for [${i}]= ${title}`]);
      } else if (values[i]?.value) {
        // here either by id or exact title & artist match, need to know which
        const resultId = spotifyResult.tracks.items[i]?.track?.id || spotifyResult.tracks.items[i]?.id || spotifyResult.id;
        if (values[i].value.spotify.id.includes(resultId)) {
          // if it is a key and we had it, we'd have returned it at the beginning. so add key. doing nothing otherwise is intentional
          if (!match && !partial) { db.addKey({ 'spotify.id': values[i].value.spotify.id }, search); }
        } else {
          // found by exact title & artist match, but different id. so merge ids and accept existing track
          db.addSpotifyId({ 'spotify.id': values[i].value.spotify.id }, resultId);
        }
        logLine('fetch', [`[${i}] have '${title}'`]);
        tracks[i] = values[i].value;
      } else {
        logLine('info', [` [${i}] lack '${title}'`]);
      }
      i++;
    } while (i < spotifyResult?.tracks?.items?.length);
  });

  logSpace();

  i = 0;
  promises = [];
  do {
    if (tracks[i]) {
      logLine('fetch', [`[${i}] youtube skip`]);
    } else if (!partial) { // else, with exception
      let query =
        (is.playlist) ? `${spotifyResult.tracks?.items?.[i]?.track?.artists?.[0]?.name} ${spotifyResult.tracks?.items?.[i]?.track?.name}` :
          (is.album) ? `${spotifyResult.artists?.[0]?.name} ${spotifyResult.tracks?.items?.[i]?.name}` :
            (is.track) ? `${spotifyResult.artists?.[0]?.name} ${spotifyResult.name}` :
              (spotifyResult.tracks?.items?.[0]) ? `${spotifyResult.tracks?.items?.[0]?.artists?.[0]?.name} ${spotifyResult.tracks?.items?.[0]?.name}` : search;
      query = query.replace(sanitize, '');
      query = query.replace(/(-)+/, ' ');
      tracksInfo[i].query = query;
      logLine('info', [` [${i}] youtube query: ${query}`]);

      const youtubeQuery = {
        url: 'https://youtube.googleapis.com/youtube/v3/search?q=' + query + '&type=video&part=id%2Csnippet&fields%3Ditems%28id%2FvideoId%2Csnippet%28title%2Cthumbnails%29%29&maxResults=5&safeSearch=none&key=' + youtube.apiKey,
        method: 'get',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 1000,
      };

      promises[i] = axios(youtubeQuery).catch(error => {
        logLine('error', [`[${i}] youtube query: ${query}`, error.stack]);
      });
    }
    i++;
  } while (i < spotifyResult?.tracks?.items?.length);

  logSpace();

  const youtubeResults = [];
  await Promise.allSettled(promises).then(values => {
    for (i = 0; i < values.length; i++) {
      if (values[i].value) {
        if (values[i].status == 'fulfilled') {
          logLine('info', [` [${i}] ${tracksInfo[i].title} retrieved, id= '${values[i].value?.data?.items?.[0]?.id?.videoId}'`]);
          youtubeResults[i] = values[i].value.data;
        } else {
          logLine('error', [`[${i}] youtube promise rejected`, `for query '${tracksInfo[i].query}'`]);
        }
      }
    }
  });

  logSpace();

  promises = [];
  for (i = 0; i < youtubeResults.length; i++) {
    if (youtubeResults[i]) {
      promises[i] = db.getTrack({ 'youtube.id': youtubeResults[i]?.items?.[0]?.id?.videoId });
    }
  }

  await Promise.allSettled(promises).then(values => {
    for (i = 0; i < values.length; i++) {
      if (values[i]) {
        if (values[i].status == 'fulfilled') {
          if (values[i].value) {
            if (tracksInfo[i].id) { db.addSpotifyId({ 'youtube.id': values[i].value.youtube.id }, tracksInfo[i].id); }
            if (!match) { db.addKey({ 'youtube.id': values[i].value.youtube.id }, search); }
            tracks[i] = values[i].value;
          }
        } else {
          logLine('error', ['db.getTrack by youtube.id promise rejected,', `***\nyoutubeResult: ${JSON.stringify(youtubeResults[i], '', 2)}`, `spotifyResult: ${JSON.stringify(spotifyResult.tracks.items[i], '', 2)}\n***`]);
        }
      }
    }
  });

  i = 0;
  promises = [];
  do {
    if (!tracks[i]) {
      const track = {
        'keys' : (match || partial) ? [] : [search],
        'playlists': {},
        'album' : {
          'id' : (is.playlist) ? spotifyResult.tracks?.items?.[i]?.track?.album?.id : (is.album) ? spotifyResult.id : (is.track) ? spotifyResult.album?.id : spotifyResult.tracks?.items?.[0]?.album?.id || null,
          'name' : (is.playlist) ? spotifyResult.tracks?.items?.[i]?.track?.album?.name : (is.album) ? spotifyResult.name : (is.track) ? spotifyResult.album?.name : spotifyResult.tracks?.items?.[0]?.album?.name || null,
          'trackNumber' : (is.playlist) ? spotifyResult.tracks?.items?.[i]?.track?.track_number : (is.album) ? spotifyResult.tracks?.items?.[i]?.track_number : (is.track) ? spotifyResult.track_number : spotifyResult.tracks?.items?.[0]?.track_number || null,
        },
        'artist' : {
          'id' : (is.playlist) ? spotifyResult.tracks?.items?.[i]?.track?.artists?.[0]?.id : (is.album) ? spotifyResult.artists?.[0]?.id : (is.track) ? spotifyResult.artists?.[0]?.id : spotifyResult.tracks?.items?.[0]?.artists?.[0]?.id || null,
          'name' : (is.playlist) ? spotifyResult.tracks?.items?.[i]?.track?.artists?.[0]?.name : (is.album) ? spotifyResult.artists?.[0]?.name : (is.track) ? spotifyResult.artists?.[0]?.name : spotifyResult.tracks?.items?.[0]?.artists?.[0]?.name || null,
        },
        'spotify' : {
          'id' : (tracksInfo[i].id) ? [tracksInfo[i].id] : [],
          'name' : (is.playlist) ? spotifyResult.tracks?.items?.[i]?.track?.name : (is.album) ? spotifyResult.tracks?.items?.[i]?.name : (is.track) ? spotifyResult.name : spotifyResult.tracks?.items?.[0]?.name || null,
          'art' : (is.playlist) ? spotifyResult.tracks?.items?.[i]?.track?.album?.images?.[0]?.url : (is.album) ? spotifyResult.images?.[0]?.url : (is.track) ? spotifyResult.album?.images?.[0]?.url : spotifyResult.tracks?.items?.[0]?.album?.images?.[0]?.url || null,
          'duration' : undefined, // defined just below
        },
        'youtube' : {
          'id' : youtubeResults[i]?.items?.[0]?.id?.videoId,
          'name' : youtubeResults[i]?.items?.[0]?.snippet?.title,
          'art' : youtubeResults[i]?.items?.[0]?.snippet?.thumbnails?.high?.url,
          'duration' : undefined, // defined below
        },
        'alternates': [],
      };
      const duration_ms = (is.playlist) ? spotifyResult.tracks?.items?.[i]?.track?.duration_ms : (is.album) ? spotifyResult.tracks?.items?.[i]?.duration_ms : (is.track) ? spotifyResult.duration_ms : spotifyResult.tracks?.items?.[0]?.duration_ms || null;
      track.spotify.duration = (duration_ms) ? duration_ms / 1000 : null;

      if (partial) { return Array(track); }

      for (let k = 1; k < youtubeResults[i].items.length; k++) {
        track.alternates.push({
          'id': youtubeResults[i].items[k].id.videoId,
          'name': youtubeResults[i].items[k].snippet.title,
          'art': youtubeResults[i].items[k].snippet.thumbnails.high.url,
          'duration': null,
        });
      }
      const internalPromises = [];
      try {
        promises.push((async () => {
          if (!track.youtube?.id) { return; } // from arrow function expression, not overall function
          const l = i;
          for (let j = 0; j < youtubeResults[i].items.length; j++) {
            internalPromises.push((async () => {
              const ytdlResult = await ytdl.getBasicInfo(youtubeResults[l].items[j].id.videoId, { requestOptions: { family:4 } });
              if (j == 0) {
                track.youtube.duration = Number(ytdlResult.videoDetails.lengthSeconds);
              } else {
                track.alternates[j - 1].duration = Number(ytdlResult.videoDetails.lengthSeconds);
              }
            })());
          }
          await Promise.allSettled(internalPromises);
          let id = crypto.randomBytes(5).toString('hex');
          while (await db.getTrack({ 'goose.id': id })) {
            id = crypto.randomBytes(5).toString('hex');
          }
          track.goose = {
            id: id,
          };
          logDebug(`[${l}] assigned id: ${id}`);
          tracks[l] = track;
          await db.insertTrack(track);
        })());
      } catch (error) {
        logLine('error', ['ytdl, likely track not inserted', `***\n[${i}] ${tracksInfo[i].title}:\n${JSON.stringify(youtubeResults, '', 2)}\n***`]);
      }
    }
    i++;
  } while (i < spotifyResult?.tracks?.items?.length);

  await Promise.allSettled(promises);

  return (tracks);
}

// search will be sanitized, and have passed youtubePattern.test();
async function fromYoutube(search) {
  logLine('info', [`fromYoutube search= '${search}'`]);

  const match = search.match(youtubePattern);
  let track = await db.getTrack({ 'youtube.id': match[2] });

  if (track) {
    logLine('fetch', [`[0] have '${ track.spotify.name || track.youtube.name }'`]);
    return (Array(track));
  } else {
    const ytdlResult = await ytdl.getBasicInfo(match[2], { requestOptions: { family:4 } }).catch(err => {
      // const error = new Error('message to user', { cause: err });
      logLine('error', ['fromYoutube, ytdl', err.stack]);
      throw err;
    });

    let query = (Object.keys(ytdlResult.videoDetails.media).length) ? `${ytdlResult.videoDetails.media.song} ${ytdlResult.videoDetails.media.artist}` : ytdlResult.videoDetails.title;
    query = query.replace(sanitize, '');

    [track] = await fromSpotify(query, true);

    if (track.youtube.id) {
      // complete track, different id. null keys, playlists and spotify album, artist and track ids

      track.keys.length = 0;
      track.playlists = {};
      track.album.id = null;
      track.artist.id = null;
      track.spotify.id.length = 0;
    }

    let id = crypto.randomBytes(5).toString('hex');
    while (await db.getTrack({ 'goose.id': id })) {
      id = crypto.randomBytes(5).toString('hex');
    }

    track.goose = {
      id: id,
    };
    logDebug(`[0] assigned id: ${id}`);

    track.youtube = {
      id: match[2],
      name: ytdlResult.videoDetails.title,
      art: ytdlResult.player_response.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url,
      duration: Number(ytdlResult.videoDetails.lengthSeconds),
    };

    await db.insertTrack(track);

    return (Array(track));
  }
}