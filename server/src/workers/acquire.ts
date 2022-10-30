import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import crypto from 'crypto';
import * as db from '../database.js';
import { logDebug, log } from '../logger.js';
import { youtubePattern, spotifyPattern, sanitize, youtubePlaylistPattern, napsterPattern } from '../regexes.js';
import { parentPort } from 'worker_threads';
import axios, { AxiosResponse } from 'axios';
import youtube from './acquire/youtube.js';
import spotify from './acquire/spotify.js';
import napster from './acquire/napster.js';
const { spotifyconf } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../config.json', import.meta.url).toString()), 'utf-8'));

parentPort!.on('message', async data => {
  if (data.action === 'search') {
    const tracks = await fetchTracks(data.search);
    parentPort!.postMessage({ tracks:tracks, id:data.id });
  } else if (data.action === 'exit') {
    log('info', ['Worker exiting']);
    await db.closeDB();
    process.exit();
  }
});
logDebug('Acquire2 worker spawned.');

async function fetchTracks(search:string):Promise<Array<Track>> {
  // Expectations:
  // takes a search string - can be a link to a track, playlist, album for any of the services we support; or a text search
  // go through a decision tree to decide what the search is, search the db to see if we already have it, if we have it from a different service add the relevant info and return
  // if we don't have it, construct a new Track object, insert into the db, then return
  // if playlist/album, do the above for each track
  // return array of Track objects

  search = search.replace(sanitize, '').trim();

  let sourceArray:Array<Track | TrackYoutubeSource | TrackSource | {youtube:TrackYoutubeSource, spotify:TrackSource} | TrackYoutubeSource[]> | undefined = undefined;
  let sourceType:'youtube' | 'spotify' | 'napster' | 'text' | undefined = undefined;

  if (youtubePattern.test(search)) {
    sourceArray = await youtubeSource(search);
    sourceType = 'youtube';
  } else if (youtubePlaylistPattern.test(search)) {
    sourceArray = await youtubePlaylistSource(search);
    sourceType = 'youtube';
  } else if (spotifyPattern.test(search)) {
    sourceArray = await spotifySource(search);
    sourceType = 'spotify';
  } else if (napsterPattern.test(search)) {
    sourceArray = await napsterSource(search);
    sourceType = 'napster';
  } else {
    sourceArray = await textSource(search);
    sourceType = 'text';
  }

  if (typeof sourceArray === 'undefined') { throw new Error('no sources found!'); }

  const promiseArray:Array<Promise<Track>> = [];
  function isTrack(track:Track | TrackYoutubeSource | TrackSource | {youtube:TrackYoutubeSource, spotify:TrackSource} | TrackYoutubeSource[]):track is Track { return (track as Track).goose !== undefined; }
  function isCombinedSources(track:TrackYoutubeSource | TrackSource | {youtube:TrackYoutubeSource, spotify:TrackSource} | TrackYoutubeSource[]):track is {youtube:TrackYoutubeSource, spotify:TrackSource} { return (track as {youtube:TrackYoutubeSource, spotify:TrackSource}).youtube !== undefined; }
  function isYoutubeSource(source:TrackSource | TrackYoutubeSource | TrackYoutubeSource[]):source is TrackYoutubeSource { return !Array.isArray(source) && !Array.isArray((source as TrackYoutubeSource).id);}
  function isYoutubeArray(source:TrackSource | TrackYoutubeSource[]):source is TrackYoutubeSource[] { return Array.isArray(source);}
  for (const track of sourceArray) {
    // build an array of promises so we can return them all at once
    promiseArray.push((async () => {
      if (!isTrack(track)) {
      // finishedArray.push(null);
      // goose does not exist, this is a new track source
      // at this point we should have already checked if we have this track from a different source
      // let's construct a new track
        if (sourceType === 'youtube') {
          if (isCombinedSources(track)) {
          // this is from a youtube link, and we have info for both spotify and youtube
            const actualTrack:Track = {
              goose: {
                id: await genNewGooseId(),
                plays: 0,
                errors: 0,
                album: {
                  name: track.spotify.album.name,
                  trackNumber: track.spotify.album.trackNumber,
                },
                artist: {
                  name: track.spotify.artist.name,
                  official: undefined,
                },
                track: {
                  name: track.spotify.name,
                  duration: track.youtube.duration,
                  art: track.spotify.art,
                },
              },
              keys: [],
              playlists: {},
              youtube: [track.youtube],
              spotify: track.spotify,
              status: {},
            };
            await db.insertTrack(actualTrack);
            return actualTrack;
          } else {
          // this is from a youtube link, and we only have that info
            if (!isYoutubeSource(track)) {throw new Error('source isn\'t what it should be!'); }
            const youtubeTrack:Track = {
              goose: {
                id: await genNewGooseId(),
                plays: 0,
                errors: 0,
                album: {
                  name: 'Unknown Album',
                  trackNumber: 0,
                },
                artist: {
                  name: track.contentID?.artist || 'Unknown Artist',
                  official: undefined,
                },
                track: {
                  name: track.contentID?.name || track.name,
                  duration: track.duration,
                  art: track.art,
                },
              },
              keys: [],
              playlists: {},
              youtube: [track],
              status: {},
            };
            await db.insertTrack(youtubeTrack);
            return youtubeTrack;
          }
        } else {
        // this track came from a non-youtube source (spotify, napster, youtubeplaylist or text)
          if (isCombinedSources(track) || isYoutubeSource(track)) { throw new Error('source isn\'t what it should be!'); }
          if (isYoutubeArray(track)) {
            const youtubeTrack:Track = {
              goose: {
                id: await genNewGooseId(),
                plays: 0,
                errors: 0,
                album: {
                  name: 'Unknown Album',
                  trackNumber: 0,
                },
                artist: {
                  name: track[0].contentID?.artist || 'Unknown Artist',
                  official: undefined,
                },
                track: {
                  name: track[0].contentID?.name || track[0].name,
                  duration: track[0].duration,
                  art: track[0].art,
                },
              },
              keys: [],
              playlists: {},
              youtube: track,
              status: {},
            };
            await db.insertTrack(youtubeTrack);
            return youtubeTrack;
          } else {
            let query = `${track.name} ${track.artist.name}`;
            // sanitize this query so youtube doesn't get mad about invalid characters
            query = query.replace(sanitize, '');
            query = query.replace(/(-)+/g, ' ');
            const ytArray = await youtube.fromSearch(query);
            const finishedTrack:Track = {
              goose: {
                id: await genNewGooseId(),
                plays: 0,
                errors: 0,
                album: {
                  name: track.album.name,
                  trackNumber: track.album.trackNumber,
                },
                artist: {
                  name: track.artist.name,
                  official: undefined,
                },
                track: {
                  name: track.name,
                  duration: ytArray[0].duration,
                  art: track.art,
                },
              },
              keys: (sourceType === 'text') ? [search] : [],
              playlists: {},
              youtube: ytArray,
              status: {},
            };
            if (sourceType === 'spotify' || sourceType === 'text') {finishedTrack.spotify = track;}
            if (sourceType === 'napster') {finishedTrack.napster = track;}
            await db.insertTrack(finishedTrack);
            return finishedTrack;
          }
        }
      } else { return track; }
    })());
  }

  const finishedArray:Array<Track> = [];
  await Promise.allSettled(promiseArray).then(promises => {
    for (const promise of promises) {
      if (promise.status === 'fulfilled') { finishedArray.push(promise.value); }
      if (promise.status === 'rejected') { log('error', ['track assembly promise rejected', JSON.stringify(promise, null, 2)]);}
    }
  });

  const lengthCheck = finishedArray.filter((track) => track);
  if (lengthCheck.length === sourceArray.length) {
    return finishedArray;
  } else { throw new Error('final result does not pass length check'); }
}

async function checkTrack(track:TrackSource, type:'spotify' | 'napster'):Promise<Track | null> {
  logDebug('checking track ', track.name);
  // takes a track source, and checks if we already have it
  // if we do, updates the existing track and returns it
  // if not, returns null
  // check the db to see if we have this by exact id match
  const target = `${type}.id`;
  const track1 = await db.getTrack({ [target]: track.id });
  if (track1) { return track1; }
  // check the db to see if we have this by name/artist match
  const dbTrack = await db.getTrack({ $and: [{ 'goose.track.name': track.name }, { 'goose.artist.name': track.artist.name }] });
  if (dbTrack) {
    // we have this track by name/artist, but didn't have this exact id
    if (dbTrack[type]) {
      // this track already has a source of this type, so we just need to add the id
      db.addSourceId({ 'goose.id':dbTrack.goose.id }, type, track.id[0]);
      dbTrack[type]!.id.push(track.id[0]);
    } else {
      // track doesn't have a source of this type yet, so create one
      db.addTrackSource({ 'goose.id':dbTrack.goose.id }, type, track);
      dbTrack[type] = track;
    }
    return dbTrack;
  } else {return null;}
}

async function getSpotifyCreds():Promise<ClientCredentialsResponse> {
  logDebug('getting spotify token');
  const spotifyCredentialsAxios:AxiosResponse<ClientCredentialsResponse> = await axios({
    url: 'https://accounts.spotify.com/api/token',
    method: 'post',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + (Buffer.from(spotifyconf.client_id + ':' + spotifyconf.client_secret).toString('base64')),
    },
    data: 'grant_type=client_credentials',
    timeout: 10000,
  });
  return spotifyCredentialsAxios.data;
}

async function genNewGooseId():Promise<string> {
  let id = crypto.randomBytes(5).toString('hex');
  while (await db.getTrack({ 'goose.id': id })) {
    id = crypto.randomBytes(5).toString('hex');
  }
  return id;
}

async function youtubeSource(search:string):Promise<Array<TrackYoutubeSource | Track | {youtube:TrackYoutubeSource, spotify:TrackSource}> | undefined> {
  // search is a youtube url
  const match = search.match(youtubePattern);
  const track = await db.getTrack({ 'youtube.id.0': match![2] });
  if (track) {
    log('fetch', [`[0] have '${ track.goose.track.name }'`]);
    return (Array(track));
  }
  // we don't have this yet - go talk to youtube
  log('fetch', [`[0] lack '${ match![2] }'`]);
  const source = await youtube.fromId(match![2]);
  // let's see if spotify knows anything about this track
  // use ContentID info as search parameter, don't perform search if no ContentID match
  const find = source.contentID ? `${source.contentID.name} ${source.contentID.artist}` : null;
  const auth = find ? await getSpotifyCreds() : null;
  const newTrack = find ? await spotify.fromText(auth!, find).catch(err => {logDebug(err.message);}) : null;
  if (newTrack) {
    const dbTrack = await checkTrack(newTrack, 'spotify');
    if (dbTrack) {
    // we found a track that matches spotify info, but has a different youtube id
    // save a new track to the db, copy over useful info
      const finalTrack:Track = {
        goose: {
          id: await genNewGooseId(),
          plays: 0,
          errors: 0,
          album: dbTrack.goose.album,
          artist: {
            name: source.contentID?.name || dbTrack.goose.artist.name,
            official: dbTrack.goose.artist.official || undefined,
          },
          track: {
            name: source.contentID?.name || dbTrack.goose.track.name,
            duration: source.duration,
            art: source.art,
          },
        },
        keys: [],
        playlists: {},
        youtube: [source],
        status: {},
      };
      await db.insertTrack(finalTrack);
      return Array(finalTrack);
    }
    // found spotify info, but no matching track - return both
    return Array({ youtube:source, spotify:newTrack });
  }
  // no matching info found - return the youtube source so we can construct a fresh track from it
  return Array(source);
}

async function youtubePlaylistSource(search:string):Promise<Array<TrackYoutubeSource | Track | {youtube:TrackYoutubeSource, spotify:TrackSource}> | undefined> {
  // this works but doesn't behave well if contentid doesn't get a match. consider revising behaviour
  const match = search.match(youtubePlaylistPattern);
  const sources = await youtube.fromPlaylist(match![2]);
  const ytPromiseArray:Array<Promise<TrackYoutubeSource | Track | {youtube:TrackYoutubeSource, spotify:TrackSource}>> = [];
  const auth = await getSpotifyCreds();
  for (const source of sources) {
    ytPromiseArray.push((async () => {
      const track = await db.getTrack({ 'youtube.id': source.id });
      if (track) {
        log('fetch', [`[0] have '${ track.goose.track.name }'`]);
        return (track);
      }
      // we don't have this yet - go talk to youtube
      log('fetch', [`[0] lack '${ source.id }'`]);
      // let's see if spotify knows anything about this track
      // use ContentID info as search parameter, don't perform search if no ContentID match
      const find = source.contentID ? `${source.contentID.name} ${source.contentID.artist}` : null;
      const newTrack = find ? await spotify.fromText(auth, find).catch(err => {logDebug(err.message);}) : null;
      if (newTrack) {
        const dbTrack = await checkTrack(newTrack, 'spotify');
        if (dbTrack) {
        // we found a track that matches spotify info, but has a different youtube id
        // save a new track to the db, copy over useful info
          const finalTrack:Track = {
            goose: {
              id: await genNewGooseId(),
              plays: 0,
              errors: 0,
              album: dbTrack.goose.album,
              artist: {
                name: source.contentID?.name || dbTrack.goose.artist.name,
                official: dbTrack.goose.artist.official || undefined,
              },
              track: {
                name: source.contentID?.name || dbTrack.goose.track.name,
                duration: source.duration,
                art: source.art,
              },
            },
            keys: [],
            playlists: {},
            youtube: [source],
            status: {},
          };
          await db.insertTrack(finalTrack);
          return finalTrack;
        }
        // found spotify info, but no matching track - return both
        return { youtube:source, spotify:newTrack };
      }
      // no matching info found - return the youtube source so we can construct a fresh track from it
      return source;
    })());
  }
  const ytArray:Array<TrackYoutubeSource | Track | {youtube:TrackYoutubeSource, spotify:TrackSource}> = [];
  await Promise.allSettled(ytPromiseArray).then(promises => {
    for (const promise of promises) {
      if (promise.status === 'fulfilled') { ytArray.push(promise.value); }
      if (promise.status === 'rejected') { log('error', ['promise rejected in youtubePlaylistSource', JSON.stringify(promise, null, 2)]);}
    }
  });
  return ytArray;
}

async function spotifySource(search:string):Promise<Array<TrackSource | Track> | undefined> {
  // search is a spotify url
  const match = search.match(spotifyPattern);
  switch (match![1]) {
    case 'track':{
      const track = await db.getTrack({ 'spotify.id': match![2] });
      if (track) {
        log('fetch', [`[0] have '${ track.goose.track.name }'`]);
        return (Array(track));
      }
      // this is a new id, so we need to go talk to spotify
      const auth = await getSpotifyCreds();
      const newTrack = await spotify.fromTrack(auth, match![2]);
      const dbTrack = await checkTrack(newTrack, 'spotify');
      if (dbTrack) {return Array(dbTrack);}
      return Array(newTrack);
    }

    case 'album':{
      const auth = await getSpotifyCreds();
      const newTracks = await spotify.fromAlbum(auth, match![2]);
      const readyTracks:Array<Track | TrackSource> = [];
      for (const [i, source] of newTracks.entries()) {
        const dbTrack = await checkTrack(source, 'spotify');
        if (dbTrack) {
          readyTracks.push(dbTrack);
          log('fetch', [`[${i}] have '${ dbTrack.goose.track.name }'`]);
        } else {
          readyTracks.push(source);
          log('fetch', [`[${i}] lack '${ source.name }'`]);
        }
      }
      return readyTracks;
    }

    case 'playlist':{
      const auth = await getSpotifyCreds();
      const newTracks = await spotify.fromPlaylist(auth, match![2]);
      const readyTracks:Array<Track | TrackSource> = [];
      for (const [i, source] of newTracks.entries()) {
        const dbTrack = await checkTrack(source, 'spotify');
        if (dbTrack) {
          readyTracks.push(dbTrack);
          log('fetch', [`[${i}] have '${ dbTrack.goose.track.name }'`]);
        } else {
          readyTracks.push(source);
          log('fetch', [`[${i}] lack '${ source.name }'`]);
        }
      }
      return readyTracks;
    }
  }
}

async function textSource(search:string):Promise<Array<TrackSource | Track | TrackYoutubeSource[]> | undefined> {
  // search is not any of the url types we recognize, treat as text
  search = search.toLowerCase();
  const track = await db.getTrack({ keys: search });
  if (track) {
    log('fetch', [`[0] have '${ track.goose.track.name }'`]);
    return (Array(track));
  }
  // this is a new search
  const auth = await getSpotifyCreds();
  const newTrack = await spotify.fromText(auth, search);
  if (newTrack) {
    const dbTrack = await checkTrack(newTrack, 'spotify');
    if (dbTrack) {
      log('fetch', [`[0] have '${ dbTrack.goose.track.name }'`]);
      // we didn't have the key, but had the track by name/artist or id match
      db.addKey({ 'goose.id':dbTrack.goose.id }, search);
      return Array(dbTrack);
    }
    log('fetch', [`[0] lack '${ newTrack.name }'`]);
    return Array(newTrack);
  } else {
    const youtubeTrack = await youtube.fromSearch(search);
    const dbTrack = await db.getTrack({ 'youtube.id': youtubeTrack[0].id });
    if (dbTrack) {
      log('fetch', [`[0] have '${ dbTrack.goose.track.name }'`]);
      // we didn't have the key, but had the track by name/artist or id match
      db.addKey({ 'goose.id':dbTrack.goose.id }, search);
      return Array(dbTrack);
    }
    log('fetch', [`[0] lack '${ youtubeTrack[0].name }'`]);
    return Array(youtubeTrack);
  }
}

async function napsterSource(search:string):Promise<Array<TrackSource | Track> | undefined> {
  // search is a napster url
  const match = search.match(napsterPattern);
  switch (match![2]) {
    case 'track':{
      const track = await db.getTrack({ 'napster.id': match![3] });
      if (track) {
        log('fetch', [`[0] have '${ track.goose.track.name }'`]);
        return (Array(track));
      }
      // this is a new id, so we need to go talk to napster
      const newTrack = await napster.fromTrack(match![3]);
      const dbTrack = await checkTrack(newTrack, 'napster');
      if (dbTrack) {return Array(dbTrack);}
      return Array(newTrack);
    }

    case 'album':{
      const newTracks = await napster.fromAlbum(match![1]);
      const readyTracks:Array<Track | TrackSource> = [];
      for (const [i, source] of newTracks.entries()) {
        const dbTrack = await checkTrack(source, 'napster');
        if (dbTrack) {
          readyTracks.push(dbTrack);
          log('fetch', [`[${i}] have '${ dbTrack.goose.track.name }'`]);
        } else {
          readyTracks.push(source);
          log('fetch', [`[${i}] lack '${ source.name }'`]);
        }
      }
      return readyTracks;
    }

    case 'playlist':{
      const newTracks = await napster.fromPlaylist(match![1]);
      const readyTracks:Array<Track | TrackSource> = [];
      for (const [i, source] of newTracks.entries()) {
        const dbTrack = await checkTrack(source, 'napster');
        if (dbTrack) {
          readyTracks.push(dbTrack);
          log('fetch', [`[${i}] have '${ dbTrack.goose.track.name }'`]);
        } else {
          readyTracks.push(source);
          log('fetch', [`[${i}] lack '${ source.name }'`]);
        }
      }
      return readyTracks;
    }
  }
}