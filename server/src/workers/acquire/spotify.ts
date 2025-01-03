import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import { logDebug, log } from '../../logger.js';
import axios, { AxiosResponse } from 'axios';
const { spotify }:GooseConfig = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));

async function getCreds():Promise<ClientCredentialsResponse> {
  logDebug('getting spotify token');
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

async function fromTrack(auth:ClientCredentialsResponse, id:string):Promise<TrackSource> {
  log('fetch', [`spotifyFromTrack: ${id}`]);
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
  const spotifyResult = spotifyResultAxios.data;
  // at this point we should have a result, now construct the TrackSource
  const source:TrackSource = {
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

async function fromText(auth:ClientCredentialsResponse, search:string):Promise<TrackSource | null> {
  log('fetch', [`spotifyFromText: ${search}`]);
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
  const spotifyResult = spotifyResultAxios.data;
  if (!spotifyResult.tracks.items[0]) { return null; }
  // at this point we should have a result, now construct the TrackSource
  const source:TrackSource = {
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

async function fromAlbum(auth:ClientCredentialsResponse, id:string):Promise<Array<TrackSource>> {
  log('fetch', [`spotifyFromAlbum: ${id}`]);
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
  const spotifyResult = spotifyResultAxios.data;
  const sources:Array<TrackSource> = [];
  for (const track of spotifyResult.tracks.items) {
    sources.push({
      id: Array(track.id),
      name: track.name,
      art: spotifyResult.images[0].url,
      duration: track.duration_ms / 1000,
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

async function fromPlaylist(auth:ClientCredentialsResponse, id:string):Promise<Array<TrackSource>> {
  log('fetch', [`spotifyFromPlaylist: ${id}`]);
  const spotifyTracks = [];
  const limit = 100;
  let offset = 0;
  let total = 0;
  do {
    const spotifyResultAxios:AxiosResponse<SpotifyApi.PlaylistTrackResponse> = await axios({
      url: `https://api.spotify.com/v1/playlists/${id}/tracks?fields=items(track(album(id,name,images),artists(id,name),track_number,id,name,href,duration_ms)),total,limit,offset&offset=${offset}&limit=${limit}`,
      method: 'get',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer ' + auth.access_token,
      },
      timeout: 10000,
    });
    const spotifyResult = spotifyResultAxios!.data;
    total = spotifyResult.total;
    spotifyTracks.push(...spotifyResult.items);
    offset = offset + limit;
  } while (offset < total);
  const sources:Array<TrackSource> = [];
  for (const track of spotifyTracks) {
    if (track.track) {
      sources.push({
        id: Array(track.track.id),
        name: track.track.name,
        art: track.track.album.images[0].url,
        duration: track.track.duration_ms / 1000,
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

export default { getCreds, fromTrack, fromText, fromAlbum, fromPlaylist };