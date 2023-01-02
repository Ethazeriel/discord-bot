import { log } from '../../logger.js';
import axios, { AxiosResponse } from 'axios';
import spotifyAcquire from '../acquire/spotify.js';


export async function userPlaylists(token:string, id:string):Promise<Array<SpotifyPlaylist>> {
  log('fetch', [`spotifyUserPlaylists: ${id}`]);
  const playlistList = [];
  const limit = 50;
  let offset = 0;
  let total = 0;
  do {
    const spotifyResultAxios:void | AxiosResponse<SpotifyApi.ListOfCurrentUsersPlaylistsResponse> = await axios({
      url: `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`,
      method: 'get',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${token}`,
      },
    }).catch(error => {
      log('error', ['Spotify: ', error.stack, error?.data]);
      return;
    });
    const spotifyResult = spotifyResultAxios!.data;
    total = spotifyResult.total;
    offset = offset + limit;
    playlistList.push(...spotifyResult.items);
  } while (offset < total);
  // at this point we should have a result, now construct the TrackSource
  const result:SpotifyPlaylist[] = [];
  for (const playlist of playlistList) {
    result.push({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || '',
      owner: playlist.owner.display_name || playlist.owner.id,
    });
  }
  return result;
}

export async function getPlaylist(id:string):Promise<Array<TrackSource>> {
  const auth = await spotifyAcquire.getCreds();
  const tracks = await spotifyAcquire.fromPlaylist(auth, id);
  return tracks;
}