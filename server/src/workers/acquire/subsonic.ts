import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import crypto from 'crypto';
import { log } from '../../logger.js';
import axios, { AxiosResponse } from 'axios';
import stream from 'node:stream';
const { subsonic, root_url }:GooseConfig = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));

// context: I want to be able to stream media from subsonic rather than youtube if the media is present
// this will save on quota (not requesting youtube at all if subsonic present)
// should also allow for higher-fidelity streams (on supported platforms, if I ever get to a multiplatform refactor)
// also a target for federation with additional details like listenbrainz

async function fromTrack(id:string):Promise<TrackSource> {
  log('fetch', [`subsonicFromTrack: ${id}`]);
  const salt = crypto.randomBytes(10).toString('hex');
  const hash = crypto.createHash('md5').update(`${subsonic.password}${salt}`).digest('hex');
  const subsonicResultAxios:AxiosResponse<SubsonicSongResponse> = await axios({
    url: `${subsonic.endpoint_uri}/rest/getSong?id=${id}&u=${subsonic.username}&s=${salt}&t=${hash}&c=${subsonic.client_id}&f=json&v=1.16.1`,
    method: 'get',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  });
  const subsonicResult = subsonicResultAxios.data['subsonic-response'];
  // TODO: consult the result field to confirm we got an ok, not an error
  const source:TrackSource = {
    id: Array(subsonicResult.song.id),
    name: subsonicResult.song.title,
    art: `${root_url}/subsonic-art/${subsonicResult.song.id}`,
    duration: subsonicResult.song.duration,
    url: 'http://localhost', // TODO: needs auth too, probably just won't include for subsonic
    album: {
      id: subsonicResult.song.albumId,
      name: subsonicResult.song.album,
      trackNumber: subsonicResult.song.track, // TODO: compensate for multiple discs
    },
    artist: {
      id: subsonicResult.song.artistId,
      name: subsonicResult.song.artist,
    },
  };
  return source;
}

async function fromAlbum(id:string):Promise<Array<TrackSource>> {
  log('fetch', [`subsonicFromAlbum: ${id}`]);
  const salt = crypto.randomBytes(10).toString('hex');
  const hash = crypto.createHash('md5').update(`${subsonic.password}${salt}`).digest('hex');
  const subsonicResultAxios:AxiosResponse<SubsonicAlbumResponse> = await axios({
    url: `${subsonic.endpoint_uri}/rest/getAlbum?id=${id}&u=${subsonic.username}&s=${salt}&t=${hash}&c=${subsonic.client_id}&f=json&v=1.16.1`,
    method: 'get',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  });
  const subsonicResult = subsonicResultAxios.data['subsonic-response'];
  const sources:Array<TrackSource> = [];
  for (const song of subsonicResult.album.song) {
    sources.push({
      id: Array(song.id),
      name: song.title,
      art: `${root_url}/subsonic-art/${song.id}`,
      duration: song.duration,
      url: 'http://localhost', // TODO: needs auth too, probably just won't include for subsonic
      album: {
        id: song.albumId,
        name: song.album,
        trackNumber: song.track, // TODO: compensate for multiple discs
      },
      artist: {
        id: song.artistId,
        name: song.artist,
      },
    });
  }
  return sources;
}

async function fromPlaylist(id:string):Promise<Array<TrackSource>> {
  log('fetch', [`subsonicFromPlaylist: ${id}`]);
  const salt = crypto.randomBytes(10).toString('hex');
  const hash = crypto.createHash('md5').update(`${subsonic.password}${salt}`).digest('hex');
  const subsonicResultAxios:AxiosResponse<SubsonicPlaylistResponse> = await axios({
    url: `${subsonic.endpoint_uri}/rest/getPlaylist?id=${id}&u=${subsonic.username}&s=${salt}&t=${hash}&c=${subsonic.client_id}&f=json&v=1.16.1`,
    method: 'get',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  });
  const subsonicResult = subsonicResultAxios.data['subsonic-response'];
  const sources:Array<TrackSource> = [];
  for (const song of subsonicResult.playlist.entry) {
    sources.push({
      id: Array(song.id),
      name: song.title,
      art: `${root_url}/subsonic-art/${song.id}`,
      duration: song.duration,
      url: 'http://localhost', // TODO: needs auth too, probably just won't include for subsonic
      album: {
        id: song.albumId,
        name: song.album,
        trackNumber: song.track, // TODO: compensate for multiple discs
      },
      artist: {
        id: song.artistId,
        name: song.artist,
      },
    });
  }
  return sources;
}

async function fromText(search:string):Promise<TrackSource | null> {
  log('fetch', [`subsonicFromText: ${search}`]);
  const salt = crypto.randomBytes(10).toString('hex');
  const hash = crypto.createHash('md5').update(`${subsonic.password}${salt}`).digest('hex');
  const subsonicResultAxios:AxiosResponse<SubsonicSearchResponse> = await axios({
    url: `${subsonic.endpoint_uri}/rest/search2?query=${search}&artistCount=0&albumCount=0&songCount=5&u=${subsonic.username}&s=${salt}&t=${hash}&c=${subsonic.client_id}&f=json&v=1.16.1`,
    method: 'get',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  });
  const subsonicResult = subsonicResultAxios.data['subsonic-response'];
  if (Object.keys(subsonicResult.searchResult2).length === 0) { return null; }
  const source:TrackSource = {
    id: Array(subsonicResult.searchResult2.song[0].id),
    name: subsonicResult.searchResult2.song[0].title,
    art: `${root_url}/subsonic-art/${subsonicResult.searchResult2.song[0].id}`,
    duration: subsonicResult.searchResult2.song[0].duration,
    url: 'http://localhost',
    album: {
      id: subsonicResult.searchResult2.song[0].albumId,
      name: subsonicResult.searchResult2.song[0].album,
      trackNumber: subsonicResult.searchResult2.song[0].track,
    },
    artist: {
      id: subsonicResult.searchResult2.song[0].artistId,
      name: subsonicResult.searchResult2.song[0].artist,
    },
  };
  return source;
}

const searchRegex = new RegExp(subsonic.regex);
// (?:subsonic\.example\.com:4533|192\.168\.0\.1:4533)(?:\/app\/#?\/)((?:track|playlist|album){1})(?:\/)([a-f0-9-]{32,36})(?:\/show)
// match[1] is search type, match[2] is id
// TODO: include setup instructions to generate your own regex, which can be pulled from config
// basically, take the above and feed it to https://www.freeformatter.com/json-escape.html#ad-output
// for docker, do like mongo and include an env var to pull from set hostname?

async function getStream(id:string, offset:number = 0):Promise<stream.Readable | undefined> {
  const salt = crypto.randomBytes(10).toString('hex');
  const hash = crypto.createHash('md5').update(`${subsonic.password}${salt}`).digest('hex');
  // timeOffset may or may not be supported as the base subsonic api only supports this for video
  // navidrome implements the transcodeOffset opensubsonic extension, which means this works - but only if we're transcoding
  // not for raw audio streams - may or may not be reliable, in other words
  const streamresult = await fetch(`${subsonic.endpoint_uri}/rest/stream?id=${id}&timeOffset=${offset}&format=opus&u=${subsonic.username}&s=${salt}&t=${hash}&c=${subsonic.client_id}&v=1.16.1`);
  if (streamresult.body) {
    return stream.Readable.fromWeb(streamresult.body);
  }
}

async function getArtPath(id:string) {
  const salt = crypto.randomBytes(10).toString('hex');
  const hash = crypto.createHash('md5').update(`${subsonic.password}${salt}`).digest('hex');
  const path = `/rest/getCoverArt?id=${id}&size=300&u=${subsonic.username}&s=${salt}&t=${hash}&c=${subsonic.client_id}&v=1.16.1`;
  return path;
}

const endpoint_uri = subsonic.endpoint_uri;

export default { fromTrack, fromAlbum, fromPlaylist, fromText, searchRegex, getStream, getArtPath, endpoint_uri };