/* eslint-disable no-fallthrough */
import { MessageAttachment, CommandInteraction, InteractionReplyOptions, MessageEmbedOptions } from 'discord.js';
import { log } from './logger.js';
import Canvas from 'canvas';
import crypto from 'crypto';
import axios, { AxiosResponse } from 'axios';
import * as db from './database.js';
import type { IArtist, IArtistList } from 'musicbrainz-api';

export function progressBar(size:number, duration:number, playhead:number, { start, end, barbefore, barafter, head }:ProgressBarOptions = {}):string {
  start ??= '[';
  end ??= ']';
  barbefore ??= '-';
  barafter ??= '-';
  head ??= '#';
  let result = '';
  const playperc = (playhead / duration > 1) ? 1 : (playhead / duration);
  let before = Math.round((size - 2) * playperc) || 0;
  let after = Math.round((size - 2) * (1 - playperc)) || 0;
  while ((before + after + 1) > (size - 2)) { (before < after) ? after-- : before--; }
  while ((before + after + 1) < (size - 2)) { (before < after) ? before++ : after++; }
  result = result.concat(start);
  for (let i = 0; i < before; i++) { result = result.concat(barbefore); }
  result = result.concat(head);
  for (let i = 0; i < after; i++) { result = result.concat(barafter); }
  result = result.concat(end);
  return result;
}

type PrideResponse<T extends boolean> = T extends true ? { url:string, name:string} : string;
export function pickPride<T extends boolean>(type:'heart' | 'dab' | 'fish', detail?:T): PrideResponse<T> {
  const pridearray = ['agender', 'aromantic', 'asexual', 'bigender', 'bisexual', 'demisexual', 'gaymen', 'genderfluid', 'genderqueer', 'intersex', 'lesbian', 'nonbinary', 'pan', 'poly', 'pride', 'trans'];
  let ranpride = pridearray[Math.floor(Math.random() * pridearray.length)];
  if (ranpride == 'pride') {
    const pridearray2 = ['pride', 'progressive', 'poc'];
    ranpride = pridearray2[Math.floor(Math.random() * pridearray2.length)];
  }
  const prideStr = 'https://ethazeriel.net/pride/sprites/' + type + '_' + ranpride + '.png';
  if (detail === true) {
    return <PrideResponse<T>>{
      url:prideStr,
      name:ranpride,
    };
  }
  return <PrideResponse<T>>prideStr;
}

export async function prideSticker(interaction:CommandInteraction, type:'heart' | 'dab' | 'fish'):Promise<void> {
  const size = {
    heart:{ width:160, height:160 },
    dab:{ width:160, height:100 },
    fish:{ width:160, height:160 },
  };
  const prideChoice = interaction.options.getString('type');
  const canvas = Canvas.createCanvas(size[type].width, size[type].height);
  const context = canvas.getContext('2d');
  let result;
  if (prideChoice == 'random') {
    result = pickPride(type, true);
  } else {
    result = {
      url:`https://ethazeriel.net/pride/sprites/${type}_${prideChoice}.png`,
      name:prideChoice,
    };
  }
  const prideimg = await Canvas.loadImage(result.url);
  context.drawImage(prideimg, 0, 0, canvas.width, canvas.height);
  const attachment = new MessageAttachment(canvas.toBuffer(), `${type}_${result.name}.png`).setDescription(`${result.name} ${type}`);
  // console.log(attachment.description);
  await interaction.reply({ files: [attachment] });

}

export function timeDisplay(seconds:number):string {
  let time = new Date(seconds * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '');
  switch (time.length) {
    case 0: time = `0${time}`;
    case 1: time = `0${time}`;
    case 2: time = `0:${time}`;
    default: return time;
  }
}

export function randomHexColor():number {
  return Number(`0x${crypto.randomBytes(3).toString('hex')}`);
}

// =================================
//               EMBEDS
// =================================

export async function generateTrackEmbed(track:Track, messagetitle:string):Promise<InteractionReplyOptions> {
  const albumart = new MessageAttachment((track.spotify.art || track.youtube.art), 'art.jpg');
  const npEmbed = {
    color: 0x580087,
    author: {
      name: '\u200b',
      icon_url: pickPride('fish'),
    },
    fields: [
      { name: messagetitle, value: `${(track.artist.name || ' ')} - [${(track.spotify.name || track.youtube.name)}](https://youtube.com/watch?v=${track.youtube.id})\nAlbum - ${track.album.name || '\u200b'}` },
    ],
    thumbnail: {
      url: 'attachment://art.jpg',
    },
  };
  return { embeds: [npEmbed as MessageEmbedOptions], files: [albumart] };
}

export async function mbArtistLookup(artist:string):Promise<string | undefined> {
  // check for Artist.official in db before sending lookup
  const track = await db.getTrack({ $and:[{ 'artist.official':{ $type:'string' } }, { 'artist.name':artist }] });
  if (track) { return track.artist.official; } else {
    const axData1:null | AxiosResponse<IArtistList> = await axios(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(artist)}&limit=1&offset=0&fmt=json`).catch(error => {
      log('error', ['MB artist search fail', `headers: ${JSON.stringify(error.response?.headers, null, 2)}`, error.stack]);
      return (null);
    });
    if (axData1) {
      const firstdata = axData1.data;
      if (firstdata?.artists?.length) {
        const mbid = firstdata.artists[0].id;
        const axData2:null | AxiosResponse<IArtist> = await axios(`https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels`).catch(error => {
          log('error', ['MB artist lookup fail', `headers: ${JSON.stringify(error.response?.headers, null, 2)}`, error.stack]);
          return (null);
        });
        if (axData2) {
          const data = axData2.data;
          if (data?.relations?.length) {
            let result = null;
            for (const link of data.relations) { // return the official site first
              if (link.type === 'official homepage') {
                result = link.url?.resource;
                return result;
              }
            }
            for (const link of data.relations) { // if no official site, return bandcamp
              if (link.type === 'bandcamp') {
                result = link.url?.resource;
                return result;
              }
            }
            for (const link of data.relations) { // if no bandcamp, return last.fm and hope they have better links
              if (link.type === 'last.fm') {
                result = link.url?.resource;
                return result;
              }
            }
          }
        }
      }
    }
  }
}