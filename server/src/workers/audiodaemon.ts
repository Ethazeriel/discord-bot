import { Client, GatewayIntentBits } from 'discord.js';
import { log, logDebug } from '../logger.js';
import chalk from 'chalk';
import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import * as db from '../database.js';
const { discord, youtube } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../config.json', import.meta.url).toString()), 'utf-8'));
const token = discord.token;
import youtubedl from 'youtube-dl-exec';
import { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayer, DiscordGatewayAdapterCreator } from '@discordjs/voice';
import crypto from 'crypto';
const useragent = youtube.useragent;
import { stream as seekable } from 'play-dl';
import { parentPort, workerData } from 'worker_threads';

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

// type definitions
let queue:PlayerStatus;
const guildID:string = workerData.guildID;
const channelID:string = workerData.channelID;
let audioPlayer:AudioPlayer;


// When the client is ready, run this code (only once)
client.once('ready', async () => {
  logDebug(chalk.red.bold('daemon thread live'));
  log('info', ['Ready!', `Node version: ${process.version}`]);
  db.printCount();

  queue = {
    tracks: [],
    playhead: 0,
    loop: false,
    paused: false,
  };
  audioPlayer = createAudioPlayer();
  audioPlayer.on('error', error => { log('error', [error.stack! ]); });
  audioPlayer.on('stateChange', async (oldState, newState) => {
    logDebug(`Player transitioned from ${oldState.status} to ${newState.status}`);

    if (newState.status == 'playing') {
      const diff = (queue.tracks[queue.playhead].status.pause) ? (queue.tracks[queue.playhead].status.pause! - queue.tracks[queue.playhead].status.start!) : 0;
      queue.tracks[queue.playhead].status.start = ((Date.now() / 1000) - (queue.tracks[queue.playhead].status.seek || 0)) - diff;
      if (queue.tracks[queue.playhead].status.seek) { queue.tracks[queue.playhead].status.seek = 0; }
    } else if (newState.status == 'idle') {
      const track = queue.tracks[queue.playhead];
      if (track) {
        const elapsed = (Date.now() / 1000) - track.status.start!;
        const duration = track.goose.track.duration;
        const difference = Math.abs(duration - elapsed);
        const percentage = (100 * ((elapsed < duration) ? (elapsed / duration) : (duration / elapsed)));
        if (difference > 10 || percentage < 95) {
          logDebug(`track: ${track.goose.track.name}—goose: ${track.goose.id} duration discrepancy. start ${track.status.start}, elapsed ${elapsed}, duration ${duration}, difference ${difference}, percentage ${percentage}`.replace(/(?<=\d*\.\d{3})\d+/g, ''));
          db.logPlay(track.goose.id, false);
        } else { db.logPlay(track.goose.id); }
        delete queue.tracks[queue.playhead].status.start;
      }
      next();
    } else if (newState.status == 'paused') {
      queue.tracks[queue.playhead].status.pause = (Date.now() / 1000);
    }
  });

  const connection = joinVoiceChannel({
    channelId: channelID,
    guildId: guildID,
    adapterCreator: client.guilds.cache.get(guildID)?.voiceAdapterCreator as DiscordGatewayAdapterCreator,
  });
  connection.on('stateChange', async (oldState, newState) => {
    logDebug(`Connection transitioned from ${oldState.status} to ${newState.status}`);
    if (newState.status == 'destroyed') {
      logDebug(`Removing player with id ${channelID}`);
      leave();
    }
  });
  connection.subscribe(audioPlayer);
});

client.login(token);

type playerdata = {
  action:string,
  args:any[],
  id:string,
}
const sleep = (delay:number) => new Promise((resolve) => setTimeout(resolve, delay));
parentPort!.on('message', async (data:playerdata) => {
  await sleep(1000);
  switch (data.action) {
    case 'leave': { // return
      logDebug('player worker exiting');
      leave();
      process.exit();
      break;
    }

    case 'play': {
      play();
      break;
    }

    case 'prev': {
      prev(data.args[0]);
      break;
    }

    case 'next': {
      next(data.args[0]);
      break;
    }

    case 'jump': {
      jump(data.args[0]);
      break;
    }

    case 'seek': {
      seek(data.args[0]);
      break;
    }

    case 'togglePause': { // return
      togglePause(data.args[0]);
      break;
    }

    case 'toggleLoop': { // return
      toggleLoop(data.args[0]);
      break;
    }

    case 'queueNow': {
      queueNow(data.args[0]);
      break;
    }

    case 'queueNext': {
      queueNext(data.args[0]);
      break;
    }

    case 'queueIndex': {
      queueIndex(data.args[0], data.args[1]);
      break;
    }

    case 'queueLast': { // return
      queueLast(data.args[0]);
      break;
    }

    case 'move': { // return
      move(data.args[0], data.args[1], data.args[2]);
      break;
    }

    case 'remove': { // return
      remove(data.args[0]);
      break;
    }

    case 'removeById': {
      removeById(data.args[0]);
      break;
    }

    case 'empty': {
      empty();
      break;
    }

    case 'shuffle': { // return
      shuffle(data.args[0], data.args[1]);
      break;
    }

    case 'getPrev': { // return
      getPrev();
      break;
    }

    case 'getCurrent': { // return
      getCurrent();
      break;
    }

    case 'getNext': { // return
      getNext();
      break;
    }

    case 'getQueue': { // return
      getQueue();
      break;
    }

    case 'getPause': { // return
      getPause();
      break;
    }

    case 'getLoop': { // return
      getLoop();
      break;
    }

    case 'getPlayhead': { // return
      getPlayhead();
      break;
    }

    case 'getStatus': { // return
      getStatus();
      break;
    }

    default:
      break;
  }
  // if (data.action === 'search') {
  //   const tracks = await fetchTracks(data.search);
  //   parentPort!.postMessage({ tracks:tracks, id:data.id });
  // } else if (data.action === 'exit') {
  //   log('info', ['Worker exiting']);
  //   await db.closeDB();
  //   process.exit();
  // }
});


// acquisition

function leave() {
  const connection = getVoiceConnection(guildID);
  if (connection) {
    const success = connection.disconnect();
    // eslint-disable-next-line no-console
    (!success) ? console.log(`failed to disconnect connection: ${connection}`) : connection.destroy();
    return ({ content: (success) ? 'Left voice.' : 'Failed to leave voice.' });
  } else { return ({ content:'Bot is not in a voice channel.' }); }
}

// playback
async function play():Promise<void> {
  let ephemeral;
  let UUID;
  let track = queue.tracks[queue.playhead];
  if (track) { UUID = track.goose.UUID, ephemeral = track.status.ephemeral; }
  track &&= await db.getTrack({ 'goose.id': track.goose.id }) as Track;
  if (track) { track.goose.UUID = UUID, track.status.ephemeral = ephemeral; }
  queue.tracks[queue.playhead] &&= track;
  if (getPause()) { togglePause({ force: false }); }
  if (track) {
    try {
      const resource = createAudioResource(youtubedl.exec(`https://www.youtube.com/watch?v=${track.youtube[0].id}`, {
        output: '-',
        quiet: true,
        forceIpv4: true,
        format: 'bestaudio[ext=webm]+bestaudio[acodec=opus]+bestaudio[asr=48000]/bestaudio',
        limitRate: '100K',
        cookies: fileURLToPath(new URL('../../../cookies.txt', import.meta.url).toString()),
        userAgent: useragent,
      }, { stdio: ['ignore', 'pipe', 'ignore'] }).stdout!);
      audioPlayer.play(resource);
      log('track', ['Playing track:', (track.goose.artist.name), ':', (track.goose.track.name)]);
    } catch (error:any) {
      log('error', [error.stack]);
    }
  } else if (audioPlayer.state.status == 'playing') { audioPlayer.stop(); }
}

async function prev(doPlay = true):Promise<void> { // prior, loop or restart current
  const priorPlayhead = queue.playhead;
  queue.playhead = ((playhead = queue.playhead, length = queue.tracks.length) => (playhead > 0) ? --playhead : (queue.loop) ? (length &&= length - 1) : 0)();
  if (doPlay) {await play();}
  if (queue.tracks[priorPlayhead]?.status?.ephemeral) { remove(priorPlayhead); }
}

async function next(doPlay = true):Promise<void> { // next, loop or end
  const priorPlayhead = queue.playhead;
  queue.playhead = ((playhead = queue.playhead, length = queue.tracks.length) => (playhead < length - 1) ? ++playhead : (queue.loop) ? 0 : length)();
  if (doPlay) {await play();}
  if (queue.tracks[priorPlayhead]?.status?.ephemeral) { remove(priorPlayhead); }
}

async function jump(position:number):Promise<void> {
  const priorPlayhead = queue.playhead;
  queue.playhead = ((value = Math.abs(position), length = queue.tracks.length) => (value < length) ? value : (length &&= length - 1))();
  await play();
  if (queue.tracks[priorPlayhead]?.status?.ephemeral) { remove(priorPlayhead); }
}

async function seek(time:number):Promise<void> {
  let ephemeral;
  let track = queue.tracks[queue.playhead];
  if (track) { ephemeral = track.status.ephemeral; }
  track &&= await db.getTrack({ 'goose.id': track.goose.id }) as Track;
  if (track) { track.status.ephemeral = ephemeral; }
  queue.tracks[queue.playhead] &&= track;
  if (getPause()) { togglePause({ force: false }); }
  if (track) {
    try {
      const source = await seekable(`https://www.youtube.com/watch?v=${track.youtube[0].id}`, { seek:time });
      const resource = createAudioResource(source.stream, { inputType: source.type });
      audioPlayer.play(resource);
      log('track', [`Seeking to time ${time} in `, (track.goose.artist.name), ':', (track.goose.track.name)]);
    } catch (error:any) {
      log('error', [error.stack]);
    }
    track.status.seek = time;
    track.status.start = (Date.now() / 1000) - (time || 0);
  } else if (audioPlayer.state.status == 'playing') { audioPlayer.stop(); }
}

function togglePause({ force }:{ force?:boolean } = {}) {
  force = (typeof force == 'boolean') ? force : undefined;
  const condition = (force == undefined) ? queue.paused : !force;
  const result = (condition) ? !audioPlayer.unpause() : audioPlayer.pause();
  (condition != result) ? queue.paused = result : logDebug('togglePause failed');
  return ((condition != result) ? ({ content: (result) ? 'Paused.' : 'Unpaused.' }) : ({ content:'OH NO SOMETHING\'S FUCKED' }));
}

async function toggleLoop({ force }:{ force?:boolean } = {}) {
  force = (typeof force == 'boolean') ? force : undefined;
  queue.loop = (force == undefined) ? !queue.loop : force;
  if (queue.loop && queue.tracks.length && (queue.tracks.length == queue.playhead)) { await next(); }
  return (queue.loop);
}

// modification

async function assignUUID(tracks:Track[]) {
  tracks.map(track => track.goose.UUID = crypto.randomUUID());
}
async function queueNow(tracks:Track[]):Promise<void> {
  // not constrained to length because splice does that automatically
  await assignUUID(tracks);
  queue.tracks.splice(queue.playhead + 1, 0, ...tracks);
  (audioPlayer.state.status == 'idle') ? await play() : await next();
}

async function queueNext(tracks:Track[]):Promise<void> {
  // not constrained to length because splice does that automatically
  await assignUUID(tracks);
  queue.tracks.splice(queue.playhead + 1, 0, ...tracks);
  if (audioPlayer.state.status == 'idle') { await play(); }
}

async function queueIndex(tracks:Track[], index:number):Promise<void> {
  await assignUUID(tracks);
  // eslint-disable-next-line max-statements-per-line
  tracks.map((track) => { if (!track.goose.UUID) { logDebug(`queueIndex-UUID null ${!track.goose.UUID}`); } });
  if (index <= queue.playhead) {
    queue.playhead = queue.playhead + tracks.length;
  } else if (queue.tracks.length == queue.playhead) {
    queue.playhead = index;
  }
  queue.tracks.splice(index, 0, ...tracks);
  if (audioPlayer.state.status == 'idle') { await play(); }
}

async function queueLast(tracks:Track[]):Promise<number> {
  await assignUUID(tracks);
  queue.tracks.push(...tracks);
  if (audioPlayer.state.status == 'idle') { await play(); }
  return (queue.tracks.length);
}

// browser client will always supply UUID; is optional to support commands.
// is here in attempt to improve UX of concurrent modification while dragging
function move(from:number, to:number, UUID?:string) {
  const length = queue.tracks.length;
  logDebug(`move—initial from: ${from}, to: ${to}, length: ${length}`);

  // seems to work well, but moved because it has to be the first check; for wrong values of from
  // there's a chance from == to would fail, when checking by UUID and getting the correct from
  // would work and should be made to. for the same reason, since from might be wrong and changed
  // it has to go before the (from < to) check, else to may not change when it should—redundantly
  // checking length to safely handle checking UUID, while accommodating commands/tampered clients
  if (UUID && from < length && queue.tracks[from].goose.UUID !== UUID) {
    logDebug(`move—UUID mismatch; attempting find for UUID [${UUID}]`);
    from = queue.tracks.findIndex(track => track.goose.UUID === UUID);
    if (from == -1) {
      logDebug(`move—could not find UUID [${UUID}]`);
      return ({ success: false, message: 'either someone else removed that track while you were moving it or we\'ve fucked up' });
    }
    logDebug(`move—UUID [${UUID}] matched to queue[${from}]`);
  }
  if (from < to) { to--; } // splice-removing [from] decrements all indexes > from

  if (from < length && to < length && from !== to) {
    let playhead = queue.playhead;
    logDebug(`move—playhead is ${playhead}, track is ${(playhead < length) ? queue.tracks[playhead].goose.track.name : 'undefined because playhead == length'}`);

    const removed = queue.tracks.splice(from, 1);
    queue.tracks.splice(to, 0, removed[0]);

    if ((from < playhead) && (playhead <= to)) { // handle negative crossing
      playhead--;
    } else if ((to <= playhead) && (playhead < from)) { // handle positive crossing; also to
      playhead++;
    } else if (from === playhead) { // handle from
      playhead = to;
    } else { /* do nothing */ }
    queue.playhead = playhead;
    logDebug(`move—playhead is ${playhead}, track is ${(playhead < length) ? queue.tracks[playhead].goose.track.name : 'undefined because playhead == length'}`);

    return ({ success: true, message: `moved ${removed[0].goose.track.name} from position ${from + 1} to position ${to + 1}` });
  } else { return ({ success: false, message: `could not move track from position ${from} to position ${to}. ${(from >= length) ? '\tfrom > length' : ''} ${(to > length) ? '\tto > length' : ''} ${(from == to) ? '\tfrom == to' : ''}` }); }
}

async function remove(position = queue.playhead) { // will make this take a range later
  position = ((value = Math.abs(position), length = queue.tracks.length) => (value > length) ? length : value)();
  const removed = queue.tracks.splice(position, 1); // constrained 0 to length, not length - 1, and unworried about overshooting due to how splice is implemented
  if (position < queue.playhead) {
    queue.playhead--;
  } else if (position == queue.playhead) {
    await play();
  }
  return (removed);
}

function removeById(id:string):void {
  const idTest = (element:Track) => element.goose.id === id;
  while (queue.tracks.findIndex(idTest) > 0) {
    const index = queue.tracks.findIndex(idTest);
    remove(index);
    logDebug(`Removed item ${index} with matching id`);
  }
}

function empty():void {
  queue.playhead = 0;
  queue.tracks.length = 0;
  audioPlayer.stop();
}

// verbatim Fisher—Yates shuffle, but of the order elements will be visited rather than of the actual elements
// to enable visiting all elements in random order, without randomly ordering them. retain positioning control
function randomizer(length:number):number[] {
  const random:number[] = [];
  for (let i = 0; i < length; i++) { random[i] = i; }
  for (let i = 0; i < (length - 2); i++) {
    const j:number = crypto.randomInt(i, length);
    const temp:number = random[j];
    random[j] = random[i];
    random[i] = temp;
  }
  return (random);
}

// an implementation of the goals described here: https://engineering.atspotify.com/2014/02/how-to-shuffle-songs
function shuffle({ albumAware = false } = {}, alternate:Track[] | undefined = undefined) { // if alternate, shuffle and return that instead of the queue
  const loop = getLoop() || !getNext(); // we're treating shuffling a queue that's over as a 1-action request to restart it, shuffled
  const internalQueue = (alternate) ? null : getQueue();
  const current = (alternate) ? null : getCurrent();
  const playhead = (alternate) ? null : (loop || !current) ? 0 : getPlayhead(); // shuffle everything or just the remaining, unheard queue
  const tracks = alternate || internalQueue!.slice(playhead!);
  if (!alternate) { internalQueue!.length = playhead as number, queue.playhead = playhead as number; }
  // logDebug(`current: ${(current) ? current.spotify.name || current.youtube.name : 'none'} \n`);

  if (albumAware) {
    tracks.sort((a, b) => (a.goose.album.trackNumber < b.goose.album.trackNumber) ? -1 : 1);
    tracks.sort((a, b) => (a.goose.album.name === b.goose.album.name) ? 0 : (a.goose.album.name < b.goose.album.name) ? -1 : 1);
  }
  tracks.sort((a, b) => (a.goose.artist.name === b.goose.artist.name) ? 0 : (a.goose.artist.name < b.goose.artist.name) ? -1 : 1);

  const groups:Track[][] = [];
  for (let grouping = 0, index = 0; index < tracks.length; index++) {
    if (groups[grouping]) {
      if (albumAware) {
        if (tracks[index].goose.album.name === 'Unknown Album' || groups[grouping][0].goose.album.name !== tracks[index].goose.album.name) { grouping++; }
      } else if (groups[grouping][0].goose.artist.name !== tracks[index].goose.artist.name) { grouping++; }
    }
    if (!groups[grouping]) { groups[grouping] = []; }
    groups[grouping].push(tracks[index]);
  }

  // for (const grouping of groups) { // visual testing
  //   const color = utils.randomHexColor();
  //   for (const track of grouping) { track.color = color; }
  // }

  const offsets = [];
  for (let i = 0; i < groups.length; i++) { offsets.push(crypto.randomInt(tracks.length * 100)); }
  const sparse = new Array(tracks.length * 100);
  for (const [index, grouping] of groups.entries()) {
    let position;
    const offset = offsets[index];
    if (albumAware) {
      position = offset;
      while (sparse[position]) { position++; }
      sparse.splice(position, 0, ...grouping);
    } else {
      const random = randomizer(grouping.length);
      for (let i = 0; i < grouping.length; i++) {
        (!position) ? (position = offset) : (position = position + (sparse.length / grouping.length));
        if (position > sparse.length) { position = position - sparse.length; }
        sparse.splice(position, 0, grouping[random[i]]);
      }
    }
  }
  let result:Track[] = sparse.filter((element) => element);

  if (alternate) {
    return (result);
  } else {
    if (current) {
      let start = 0;
      while (result[start].status.start != current.status.start) {
        start++;
      }
      let end = start + 1;
      if (albumAware) {
        while (end < result.length && result[start].goose.album.name == result[end].goose.album.name) { end++; }
      }
      const rearranged:Track[] = [];
      rearranged.push(...result.slice(start, end));
      rearranged.push(...result.slice(end));
      rearranged.push(...result.slice(0, start));
      result = rearranged;
    }
      internalQueue!.push(...result);
      if (!current) { play(); }
  }

  // // visual testing code from elsewhere, included here so as to not need to recreate it should it be needed in future
  // console.log(((current = this.getCurrent()) => chalk.hex(current.color || 0xFFFFFF)(`Current: #${(current) ? current.album.trackNumber : 0}: ${(current) ? current.spotify.name || current.youtube.name : 'none'}\n`))());
  // for (const [index, track] of this.queue.tracks.entries()) {
  //   console.log(chalk.hex(track.color || 0xFFFFFF)(`[${index}]: #${track.album.trackNumber || 0}: ${track.spotify.name || track.youtube.name}`));
}

// information
function getPrev():Track { // prior, loop around or current
  const position = ((playhead = queue.playhead, length = queue.tracks.length) => (playhead > 0) ? --playhead : (queue.loop) ? (length &&= length - 1) : 0)();
  return (queue.tracks[position]);
}

function getCurrent():Track | undefined {
  return (queue.tracks[queue.playhead]);
}

function getNext():Track { // next, loop around or end
  const position = ((playhead = queue.playhead, length = queue.tracks.length) => (playhead < length - 1) ? ++playhead : (queue.loop) ? 0 : length)();
  return (queue.tracks[position]);
}

function getQueue():Track[] {
  return (queue.tracks);
}

function getPause():boolean {
  return (queue.paused);
}

function getLoop():boolean {
  return (queue.loop);
}

function getPlayhead():number {
  return (queue.playhead);
}

function getStatus():PlayerStatus {
  if (!queue) { logDebug('player—getStatus and queue nullish'); }
  return queue;
}