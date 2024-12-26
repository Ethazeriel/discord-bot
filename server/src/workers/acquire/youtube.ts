import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import { logDebug, log } from '../../logger.js';
import ytdl from 'ytdl-core';
import axios, { AxiosResponse } from 'axios';
const { youtube }:GooseConfig = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));

async function fromId(id:string):Promise<TrackYoutubeSource> {
  log('fetch', [`youtubeFromId: ${id}`]);
  const ytdlResult = await ytdl.getBasicInfo(id, { requestOptions: { family:4 } });
  const source:TrackYoutubeSource = {
    id: id,
    name: ytdlResult.videoDetails.title,
    art: ytdlResult.videoDetails.thumbnails[0].url,
    duration: Number(ytdlResult.videoDetails.lengthSeconds),
    url: `https://youtu.be/${id}`,
    contentID: (ytdlResult.videoDetails.media?.song) ? {
      name: ytdlResult.videoDetails.media.song,
      artist: ytdlResult.videoDetails.media.artist!,
    } : undefined,
  };
  return source;
}

async function fromSearch(search:string):Promise<Array<TrackYoutubeSource>> {
  log('fetch', [`youtubeFromSearch: ${search}`]);
  const youtubeResultAxios:AxiosResponse<YoutubeSearchResponse> = await axios({
    url: 'https://youtube.googleapis.com/youtube/v3/search?q=' + search + '&type=video&part=id%2Csnippet&fields%3Ditems%28id%2FvideoId%2Csnippet%28title%2Cthumbnails%29%29&maxResults=5&safeSearch=none&key=' + youtube.apiKey,
    method: 'get',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: 10000,
  });
  const youtubeResults = youtubeResultAxios.data.items;
  const ytPromiseArray:Array<Promise<TrackYoutubeSource>> = [];
  for (const item of youtubeResults) {
    const ytSource = fromId(item.id.videoId);
    ytPromiseArray.push(ytSource);
  }
  const ytArray:Array<TrackYoutubeSource> = [];
  await Promise.allSettled(ytPromiseArray).then(promises => {
    for (const promise of promises) {
      if (promise.status === 'fulfilled') { ytArray.push(promise.value); }
      if (promise.status === 'rejected') { log('error', ['youtube promise rejected', JSON.stringify(promise, null, 2)]);}
    }
  });
  return ytArray;
}

async function fromPlaylist(id:string):Promise<Array<TrackYoutubeSource>> {
  log('fetch', [`youtubeFromSearch: ${id}`]);
  let pageToken = undefined;
  const youtubeResults:Array<YoutubePlaylistItem> = [];
  do {
    const youtubeResultAxios:AxiosResponse<YoutubePlaylistResponse> = await axios({
      url: `https://youtube.googleapis.com/youtube/v3/playlistItems?playlistId=${id}&part=snippet%2CcontentDetails&maxResults=50&key=${youtube.apiKey}${pageToken ? '&pageToken=' + pageToken : ''}`,
      method: 'get',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });
    pageToken = youtubeResultAxios.data.nextPageToken;
    youtubeResults.push(...youtubeResultAxios.data.items);
  } while (pageToken);
  logDebug(`Retrieved ${youtubeResults.length} tracks. Running ytdl...`);
  const ytPromiseArray:Array<Promise<TrackYoutubeSource>> = [];
  for (const item of youtubeResults) {
    const ytSource = fromId(item.contentDetails.videoId);
    ytPromiseArray.push(ytSource);
  }
  const ytArray:Array<TrackYoutubeSource> = [];
  await Promise.allSettled(ytPromiseArray).then(promises => {
    for (const promise of promises) {
      if (promise.status === 'fulfilled') { ytArray.push(promise.value); }
      if (promise.status === 'rejected') { log('error', [JSON.stringify(promise, null, 2)]);}
    }
  });
  return ytArray;
}


export default { fromId, fromSearch, fromPlaylist };