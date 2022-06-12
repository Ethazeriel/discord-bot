import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import * as db from '../database.js';
import { logDebug, log } from '../logger.js';
import { youtubePattern, spotifyPattern, sanitize } from '../regexes.js';
import { parentPort } from 'worker_threads';
import axios, { AxiosResponse } from 'axios';
const { spotify, youtube } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../config.json', import.meta.url).toString()), 'utf-8'));

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

async function fetchTracks(search:string):Promise<Array<Track2>> {
  // Expectations:
  // takes a search string - can be a link to a track, playlist, album for any of the services we support; or a text search
  // go through a decision tree to decide what the search is, search the db to see if we already have it, if we have it from a different service add the relevant info and return
  // if we don't have it, construct a new Track2 object, insert into the db, then return
  // if playlist/album, do the above for each track
  // return array of Track2 objects

  search = search.replace(sanitize, '').trim();

  let sourceArray:Array<Track2 | Track2YoutubeSource | Track2Source> | undefined = undefined;
  let sourceType:'youtube' | 'spotify' | 'text' | undefined = undefined;

  if (youtubePattern.test(search)) {
    sourceArray = await youtubeSource(search);
    sourceType = 'youtube';
  } else if (spotifyPattern.test(search)) {
    sourceArray = await spotifySource(search);
    sourceType = 'spotify';
  } else {
    sourceArray = await textSource(search);
    sourceType = 'text';
  }
  if (typeof sourceArray === 'undefined') { throw new Error('no sources found!'); }
  const finishedArray:Array<Track2 | null> = [];
  function isTrack(track:Track2 | Track2YoutubeSource | Track2Source):track is Track2 { return (track as Track2).goose !== undefined; }
  for (const track of sourceArray) {
    if (!isTrack(track)) {
      finishedArray.push(null);
      // goose does not exist, this is a new track source
      // at this point we should have already checked if we have this track from a different source
      // let's construct a new track
    } else { finishedArray.push(track); }
  }

  const lengthCheck = finishedArray.filter((track) => track);
  if (lengthCheck.length === sourceArray.length) {
    return finishedArray as Array<Track2>;
  } else { throw new Error('final result does not pass length check'); }
}

async function getSpotifyCreds():Promise<ClientCredentialsResponse> {
  const spotifyCredentialsAxios:AxiosResponse<ClientCredentialsResponse> = await axios({
    url: 'https://accounts.spotify.com/api/token',
    method: 'post',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + (Buffer.from(spotify.client_id + ':' + spotify.client_secret).toString('base64')),
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

async function youtubeSource(search:string):Promise<Array<Track2YoutubeSource | Track2> | undefined> {
  // search is a youtube url
}

async function spotifySource(search:string):Promise<Array<Track2Source | Track2> | undefined> {
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
      const newTrack = await spotifyFromTrack(auth, match![2]);
      const dbTrack = await checkTrack(newTrack, 'spotify');
      if (dbTrack) {return Array(dbTrack);}
      return Array(newTrack);
    }

    case 'album':{
      const auth = await getSpotifyCreds();
      const newTracks = await spotifyFromAlbum(auth, match![2]);
      const readyTracks:Array<Track2 | Track2Source> = [];
      for (const [i, source] of newTracks.entries()) {
        const track = await db.getTrack({ 'spotify.id':source.id[0] });
        if (track) {
          log('fetch', [`[${i}] have '${ track.goose.track.name }'`]);
          readyTracks.push(track);
        } else {
          const dbTrack = await checkTrack(source, 'spotify');
          if (dbTrack) {
            readyTracks.push(dbTrack);
            log('fetch', [`[${i}] have '${ dbTrack.goose.track.name }'`]);
          } else {
            readyTracks.push(source);
            log('fetch', [`[${i}] lack '${ source.name }'`]);
          }
        }
      }
      return readyTracks;
    }

    case 'playlist':{
      const auth = await getSpotifyCreds();
      const newTracks = await spotifyFromPlaylist(auth, match![2]);
      const readyTracks:Array<Track2 | Track2Source> = [];
      for (const [i, source] of newTracks.entries()) {
        const track = await db.getTrack({ 'spotify.id':source.id[0] });
        if (track) {
          log('fetch', [`[${i}] have '${ track.goose.track.name }'`]);
          readyTracks.push(track);
        } else {
          const dbTrack = await checkTrack(source, 'spotify');
          if (dbTrack) {
            readyTracks.push(dbTrack);
            log('fetch', [`[${i}] have '${ dbTrack.goose.track.name }'`]);
          } else {
            readyTracks.push(source);
            log('fetch', [`[${i}] lack '${ source.name }'`]);
          }
        }
      }
      return readyTracks;
    }
  }
}

async function checkTrack(track:Track2Source, type:'spotify'):Promise<Track2 | null> {
// takes a track source, and checks if we already have it by other method
// if we do, updates the existing track and returns it
// if not, returns null
// assumes you've already checked for an exact id match
  // check the db to see if we have this by name/artist match
  const dbTrack = await db.getTrack({ $and: [{ 'goose.track.name': track.name }, { 'goose.artist.name': track.artist.name }] });
  if (dbTrack) {
    // we have this track by name/artist, but didn't have this exact id (if here from track link)
    if (dbTrack[type]) {
      // this track already has a source of this type, so we just need to add the id
      db.addSourceId({ 'goose.id':dbTrack.goose.id }, type, track.id[0]);
      dbTrack[type]!.id.push(track.id[0]);
    } else {
      // track doesn't have a source of this type yet, so create one
      db.addTrackSource({ 'goose.id':dbTrack.goose.id }, type, track);
      dbTrack.spotify = track;
    }
    return dbTrack;
  } else {return null;}
}

async function spotifyFromTrack(auth:ClientCredentialsResponse, id:string):Promise<Track2Source> {
  const spotifyResultAxios:AxiosResponse<SpotifyApi.SingleTrackResponse> = await axios({
    url: `https://api.spotify.com/v1/tracks/${id}`,
    method: 'get',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Bearer ' + auth.access_token,
    },
    timeout: 10000,
  });
  const spotifyResult = spotifyResultAxios!.data;
  // at this point we should have a result, now construct the Track2Source
  const source:Track2Source = {
    id: Array(spotifyResult.id),
    name: spotifyResult.name,
    art: spotifyResult.album.images[0].url,
    duration: spotifyResult.duration_ms / 1000,
    url: spotifyResult.href,
    album: {
      id: spotifyResult.album.id,
      name: spotifyResult.album.name,
      trackNumber: spotifyResult.track_number, // TODO: compensate for multiple discs
    },
    artist: {
      id: spotifyResult.artists[0].id,
      name: spotifyResult.artists[0].name,
    },
  };
  return source;
}

async function spotifyFromText(auth:ClientCredentialsResponse, search:string):Promise<Track2Source> {
  const spotifyResultAxios:AxiosResponse<SpotifyApi.TrackSearchResponse> = await axios({
    url: `https://api.spotify.com/v1/search?type=track&limit=1&q=${search}`,
    method: 'get',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Bearer ' + auth.access_token,
    },
    timeout: 10000,
  });
  const spotifyResult = spotifyResultAxios!.data;
  if (!spotifyResult.tracks.items[0]) { throw new Error('Search returned no results!'); }
  // at this point we should have a result, now construct the Track2Source
  const source:Track2Source = {
    id: Array(spotifyResult.tracks.items[0].id),
    name: spotifyResult.tracks.items[0].name,
    art: spotifyResult.tracks.items[0].album.images[0].url,
    duration: spotifyResult.tracks.items[0].duration_ms / 1000,
    url: spotifyResult.tracks.items[0].href,
    album: {
      id: spotifyResult.tracks.items[0].album.id,
      name: spotifyResult.tracks.items[0].album.name,
      trackNumber: spotifyResult.tracks.items[0].track_number,
    },
    artist: {
      id: spotifyResult.tracks.items[0].artists[0].id,
      name: spotifyResult.tracks.items[0].artists[0].name,
    },
  };
  return source;
}

async function spotifyFromAlbum(auth:ClientCredentialsResponse, id:string):Promise<Array<Track2Source>> {
  const spotifyResultAxios:AxiosResponse<SpotifyApi.SingleAlbumResponse> = await axios({
    url: `https://api.spotify.com/v1/albums/${id}`,
    method: 'get',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Bearer ' + auth.access_token,
    },
    timeout: 10000,
  });
  const spotifyResult = spotifyResultAxios!.data;
  const sources:Array<Track2Source> = [];
  for (const track of spotifyResult.tracks.items) {
    sources.push({
      id: Array(track.id),
      name: track.name,
      art: spotifyResult.images[0].url,
      duration: track.duration_ms,
      url: track.href,
      album: {
        id: spotifyResult.id,
        name: spotifyResult.name,
        trackNumber: track.track_number,
      },
      artist: {
        id: spotifyResult.artists[0].id,
        name: spotifyResult.artists[0].name,
      },
    });
  }
  return sources;
}

async function spotifyFromPlaylist(auth:ClientCredentialsResponse, id:string):Promise<Array<Track2Source>> {
  const spotifyResultAxios:AxiosResponse<SpotifyApi.SinglePlaylistResponse> = await axios({
    url: `https://api.spotify.com/v1/playlists/${id}?fields=tracks.items(track(album(id,name,images),artists(id,name),track_number,id,name,href,duration_ms))`,
    method: 'get',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Bearer ' + auth.access_token,
    },
    timeout: 10000,
  });
  const spotifyResult = spotifyResultAxios!.data;
  const sources:Array<Track2Source> = [];
  for (const track of spotifyResult.tracks.items) {
    if (track.track) {
      sources.push({
        id: Array(track.track.id),
        name: track.track.name,
        art: track.track.album.images[0].url,
        duration: track.track.duration_ms,
        url: track.track.href,
        album: {
          id: track.track.album.id,
          name: track.track.album.name,
          trackNumber: track.track.track_number,
        },
        artist: {
          id: track.track.artists[0].id,
          name: track.track.artists[0].name,
        },
      });
    }
  }
  return sources;
}

async function textSource(search:string):Promise<Array<Track2Source | Track2> | undefined> {
  // search is not any of the url types we recognize, treat as text
  search = search.toLowerCase();
  const track = await db.getTrack({ keys: search });
  if (track) {
    log('fetch', [`[0] have '${ track.goose.track.name }'`]);
    return (Array(track));
  }
  // this is a new search
  const auth = await getSpotifyCreds();
  const newTrack = await spotifyFromText(auth, search);
  // check if we have that id
  const track2 = await db.getTrack({ 'spotify.id': newTrack.id[0] });
  if (track2) {
    log('fetch', [`[0] have '${ track2.goose.track.name }'`]);
    // we have the id, this is a new key
    db.addKey({ 'goose.id':track2.goose.id }, search);
    return (Array(track2));
  }
  const dbTrack = await checkTrack(newTrack, 'spotify');
  if (dbTrack) {
    log('fetch', [`[0] have '${ dbTrack.goose.track.name }'`]);
    // we didn't have the id or key, but had the track by name/artist match
    db.addKey({ 'goose.id':dbTrack.goose.id }, search);
    return Array(dbTrack);
  }
  log('fetch', [`[0] lack '${ newTrack.name }'`]);
  return Array(newTrack);
}