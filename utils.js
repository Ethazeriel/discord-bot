/* eslint-disable no-fallthrough */
import { MessageAttachment } from 'discord.js';
import { logLine } from './logger.js';
import Canvas from 'canvas';
import crypto from 'crypto';

export function progressBar(size, duration, playhead, { start, end, barbefore, barafter, head } = {}) {
  start ??= '[';
  end ??= ']';
  barbefore ??= '-';
  barafter ??= '-';
  head ??= '#';
  let result = '';
  const playperc = (playhead / duration > 1) ? 1 : (playhead / duration);
  let before = parseInt((size - 2) * playperc) || 0;
  let after = parseInt((size - 2) * (1 - playperc)) || 0;
  while ((before + after + 1) > (size - 2)) { (before < after) ? after-- : before--; }
  while ((before + after + 1) < (size - 2)) { (before < after) ? before++ : after++; }
  result = result.concat(start);
  for (let i = 0; i < before; i++) { result = result.concat(barbefore); }
  result = result.concat(head);
  for (let i = 0; i < after; i++) { result = result.concat(barafter); }
  result = result.concat(end);
  return result;
}

export function pickPride(type, detail) {
  const pridearray = ['agender', 'aromantic', 'asexual', 'bigender', 'bisexual', 'demisexual', 'gaymen', 'genderfluid', 'genderqueer', 'intersex', 'lesbian', 'nonbinary', 'pan', 'poly', 'pride', 'trans'];
  let ranpride = pridearray[Math.floor(Math.random() * pridearray.length)];
  if (ranpride == 'pride') {
    const pridearray2 = ['pride', 'progressive', 'poc'];
    ranpride = pridearray2[Math.floor(Math.random() * pridearray2.length)];
  }
  const prideStr = 'https://ethazeriel.net/pride/sprites/' + type + '_' + ranpride + '.png';
  if (detail === true) {
    return {
      url:prideStr,
      name:ranpride,
    };
  }
  return prideStr;
}

export async function prideSticker(interaction, type) {
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

export function timeDisplay(seconds) {
  let time = new Date(seconds * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '');
  switch (time.length) {
    case 0: time = `0${time}`;
    case 1: time = `0${time}`;
    case 2: time = `0:${time}`;
    default: return time;
  }
}

export function randomHexColor() {
  return Number(`0x${crypto.randomBytes(3).toString('hex')}`);
}

// =================================
//               EMBEDS
// =================================

export async function generateTrackEmbed(track, messagetitle) {
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
  try {
    return { embeds: [npEmbed], files: [albumart] };
  } catch (error) {
    logLine('error', [error.stack]);
  }
}