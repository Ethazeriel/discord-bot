import fs from 'fs';
import youtubedl from 'youtube-dl-exec';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayer, AudioPlayerStatus, AudioPlayerState, DiscordGatewayAdapterCreator, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import crypto from 'crypto';
import { ButtonInteraction, CommandInteraction, BaseInteraction, GuildMember, AttachmentBuilder, VoiceChannel, Client, VoiceState, InteractionUpdateOptions, InteractionReplyOptions, Message, APIEmbed } from 'discord.js';
import * as db from './database.js';
import { log, logDebug } from './logger.js';
import { fileURLToPath, URL } from 'url';
const { youtube, functions } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../config.json', import.meta.url).toString()), 'utf-8'));
const useragent = youtube.useragent;
import * as utils from './utils.js';
import { embedPage } from './regexes.js';
import * as seekable from 'play-dl';

// type GetPlayer = Promise<{ player?: Player; message?: string; }>;
type JoinableVoiceUser = VoiceUser & { adapterCreator:DiscordGatewayAdapterCreator; };

export default class Player {
  // type definitions
  static #players:Record<string, Player> = {};

  readonly guildID:string;
  readonly channelID:string;

  #audioPlayer:AudioPlayer;
  #connection:VoiceConnection;

  #queue:PlayerStatus;
  #listeners:Set<string>;
  #embeds:Record<string, {
    queue?: {
      userPage:number
      followPlayhead:boolean
      refreshCount:number
      interaction?:CommandInteraction & { message?: Message<boolean> } | ButtonInteraction
      idleTimer:NodeJS.Timeout
      refreshTimer:NodeJS.Timeout
      getPage:() => number
      update:(userId:string, description:string, content?:InteractionUpdateOptions | InteractionReplyOptions) => void
    }
    media?: {
      interaction?:CommandInteraction & { message?: Message<boolean> } | ButtonInteraction
      idleTimer:NodeJS.Timeout
      refreshTimer:NodeJS.Timeout
      update:(userId:string, description:string, content?:InteractionUpdateOptions | InteractionReplyOptions) => void
    }
  }>;

  constructor({ channelId, guildId, adapterCreator }:{channelId:string, guildId:string, adapterCreator:DiscordGatewayAdapterCreator}) {
    this.#queue = {
      tracks: [],
      playhead: 0,
      loop: false,
      paused: false,
    };
    this.guildID = guildId;
    this.channelID = channelId;
    this.#embeds = {};
    this.#listeners = new Set();

    this.#audioPlayer = createAudioPlayer();
    this.#audioPlayer.on('error', error => { log('error', [error.stack! ]); });
    const audioStateChange = async (oldState:AudioPlayerState, newState:AudioPlayerState) => {
      logDebug(`Player transitioned from ${oldState.status} to ${newState.status}`);

      if (newState.status == AudioPlayerStatus.Playing) {
        const diff = (this.#queue.tracks[this.#queue.playhead].status.pause) ? (this.#queue.tracks[this.#queue.playhead].status.pause! - this.#queue.tracks[this.#queue.playhead].status.start!) : 0;
        this.#queue.tracks[this.#queue.playhead].status.start = ((Date.now() / 1000) - (this.#queue.tracks[this.#queue.playhead].status.seek || 0)) - diff;
        if (this.#queue.tracks[this.#queue.playhead].status.seek) { this.#queue.tracks[this.#queue.playhead].status.seek = 0; }
        if (functions.web) { (await import('./webserver.js')).sendWebUpdate('player', this.getStatus()); }
      } else if (newState.status == AudioPlayerStatus.Idle) { // && this.#connection.state.status != VoiceConnectionStatus.Destroyed
        const track = this.#queue.tracks[this.#queue.playhead];
        if (track) {
          const elapsed = (Date.now() / 1000) - track.status.start!;
          const duration = track.goose.track.duration;
          const difference = Math.abs(duration - elapsed);
          const percentage = (100 * ((elapsed < duration) ? (elapsed / duration) : (duration / elapsed)));
          if (difference > 10 || percentage < 95) {
            logDebug(`track: ${track.goose.track.name}—goose: ${track.goose.id} duration discrepancy. start ${track.status.start}, elapsed ${elapsed}, duration ${duration}, difference ${difference}, percentage ${percentage}`.replace(/(?<=\d*\.\d{3})\d+/g, ''));
            db.logPlay(track.goose.id, false);
          } else { db.logPlay(track.goose.id); }
          delete this.#queue.tracks[this.#queue.playhead].status.start;
        }
        this.next();
      } else if (newState.status == AudioPlayerStatus.Paused || newState.status == AudioPlayerStatus.AutoPaused) {
        this.#queue.tracks[this.#queue.playhead].status.pause = (Date.now() / 1000);
      }
    };
    this.#audioPlayer.on('stateChange', audioStateChange);

    this.#connection = joinVoiceChannel({
      channelId: channelId,
      guildId: guildId,
      adapterCreator: adapterCreator,
    });
    this.#connection.on('stateChange', async (oldState, newState) => {
      logDebug(`Connection transitioned from ${oldState.status} to ${newState.status}`);
      if (newState.status == VoiceConnectionStatus.Destroyed) {
        const listenerIDs:string[] = [];
        this.#listeners.forEach(listenerId => listenerIDs.push(listenerId));
        db.saveStash(listenerIDs, this.getPlayhead(), this.getQueue());

        if (Object.keys(this.#embeds).length) {
          const mediaEmbed = await this.mediaEmbed(false);
          const queueEmbed = await this.queueEmbed(undefined, undefined, false);
          Object.keys(this.#embeds).forEach(async (id) => {
            const { media, queue } = this.#embeds[id];
            if (media) {
              clearTimeout(this.#embeds[id].media!.idleTimer);
              clearInterval(this.#embeds[id].media!.refreshTimer);
              this.decommission(this.#embeds[id].media!.interaction!, 'media', mediaEmbed, 'Bot left');
            }
            if (queue) {
              clearTimeout(this.#embeds[id].queue!.idleTimer);
              clearInterval(this.#embeds[id].queue!.refreshTimer);
              this.decommission(this.#embeds[id].queue!.interaction!, 'queue', queueEmbed, 'Bot left');
            }
          });
        }
        logDebug(`Removing player for channel ${this.channelID} in guild ${this.guildID}`);
        this.#audioPlayer.removeListener('stateChange', audioStateChange);
        delete Player.#players[this.guildID];
      }
    });
    this.#connection.subscribe(this.#audioPlayer);
  }

  // presence
  static async getPlayer(overload:string|BaseInteraction|JoinableVoiceUser, join = true) {
    let voiceUser:JoinableVoiceUser | undefined;
    if (typeof overload === 'string') {
      voiceUser = (await import ('./index.js')).getVoiceUser(overload);
    } else if (overload instanceof BaseInteraction) {
      const interaction = overload;
      if (!interaction.guild || !interaction.member || !(interaction.member instanceof GuildMember)) { // none of these should be possible
        log('error', [`getPlayer cursed—interaction ${interaction.id} from user ${interaction.user.username}#${interaction.user.discriminator}`,
          `id ${interaction.user.id}—somehow interacting despite member/ guild not existing, or member not being a GuildMember. somehow`]);
        return { message: 'uhoh' };
      }
      const channel = interaction.member.voice.channel;
      if (channel) { voiceUser = { channelId: channel.id, guildId: interaction.guild.id, adapterCreator: channel.guild.voiceAdapterCreator }; }
    } else { voiceUser = overload; }
    if (!voiceUser) { return { message: (join) ? 'You must join a voice channel first.' : '' }; }

    let player = Player.#players[voiceUser.guildId];
    if (player) { // if it exists and you qualify
      if (player.channelID === voiceUser.channelId) {
        return { player };
      } // else nope
      return { message: 'Bot is busy in another channel.' };
    }

    if (!join) { return {}; } // doesn't exist; shouldn't exist. used to request only existing players

    // else should exist
    player = (Player.#players[voiceUser.guildId] = new Player(voiceUser));
    return { player };
  }

  static leave(interaction:CommandInteraction | ButtonInteraction) {
    if (!interaction.guild || !interaction.member || !(interaction.member instanceof GuildMember)) { // none of these should be possible
      log('error', [`Player.leave cursed—interaction ${interaction.id} from user ${interaction.user.username}#${interaction.user.discriminator}`,
        `id ${interaction.user.id}—somehow interacting despite member/ guild not existing, or member not being a GuildMember. somehow`]);
      return { content: 'uhoh' };
    }

    const player = Player.#players[interaction.guild.id];
    if (!player) { return { content: 'Bot is not in a channel.' }; }

    const channel = interaction.member.voice.channel; // !channel is a typeguard for channel.id; it's not that the user not being in a channel means the bot is busy
    if (!channel || player.channelID !== channel.id) { return { content:'Bot is busy in another channel.' }; } // but that we'd have returned already if it weren't

    player.#connection.destroy();

    return ({ content: 'Left voice.' });
  }

  // events
  voiceJoin(oldState:VoiceState, newState:VoiceState, client:Client<true>) {
    if (!newState.member) { // shouldn't be possible
      log('error', [`voiceJoin cursed—null member with user id ${newState.id} has somehow joined channel ${this.channelID} in guild ${this.guildID},`,
        `${(oldState.member) ? `member was previously ${oldState.member.user.username}#${oldState.member.user.discriminator}` : ''}`]);
      return;
    }
    const userId = newState.id;
    if (!newState.member.user.bot) {
      this.#listeners.add(userId);
    } else if (client.user.id === userId) {
      const botChannel = client.channels.cache.get(newState.channelId!); // eslint-disable-next-line max-statements-per-line
      if (!botChannel || !(botChannel instanceof VoiceChannel)) { log('error', [`voiceJoin cursed—bot channel ${newState.channelId}`]); return; } // not possible
      botChannel.members.forEach(member => {
        if (!member.user.bot) { this.#listeners.add(member.user.id); }
      });
    }
  }

  async voiceLeave(oldState:VoiceState, newState:VoiceState, client:Client<true>) {
    const userId = newState.id;
    const self = client.user.id == userId;
    const listener = this.#listeners.has(userId);
    if (!self && !listener) { return; }

    if (self) {
      if (!newState.member) { // I assume this happens if you kick/ ban the bot
        log('error', [`bot ${client.user.username}#${client.user.discriminator} id ${userId} is no longer a guild member`]);
      }
      this.#connection.destroy();
      return;
    } // per early return, !self means listener

    this.#listeners.delete(userId);
    if (newState.member) { db.saveStash([userId], this.getPlayhead(), this.getQueue()); }
    if (this.#embeds[userId]?.queue) {
      clearTimeout(this.#embeds[userId].queue!.idleTimer);
      clearInterval(this.#embeds[userId].queue!.refreshTimer);
      if (newState.member) {
        const queueEmbed = await this.queueEmbed('Current Queue:', this.#embeds[userId].queue!.getPage(), false);
        this.decommission(this.#embeds[userId].queue!.interaction!, 'queue', queueEmbed, 'You left the channel');
      }
    }
    if (this.#embeds[userId]?.media) {
      clearTimeout(this.#embeds[userId].media!.idleTimer);
      clearInterval(this.#embeds[userId].media!.refreshTimer);
      if (newState.member) {
        const mediaEmbed = await this.mediaEmbed(false);
        this.decommission(this.#embeds[userId].media!.interaction!, 'media', mediaEmbed, 'You left the channel');
      }
    }
    delete this.#embeds[userId]; // eslint-disable-next-line max-statements-per-line
    if (!this.#listeners.size) {
      logDebug(`Client ${client.user.username} id ${client.user.id} alone in channel; leaving voice`);
      this.#connection.destroy();
    }
  }

  // playback
  async play() {
    let track = this.getCurrent();
    if (track && !Player.pending(track)) {
      let ephemeral; // TO DO remove db stuff
      let UUID;
      if (track) { UUID = track.goose.UUID, ephemeral = track.status.ephemeral; }
      track &&= await db.getTrack({ 'goose.id': track.goose.id }) as Track;
      if (track) { track.goose.UUID = UUID, track.status.ephemeral = ephemeral; }
      this.#queue.tracks[this.#queue.playhead] &&= track;
      if (this.getPause()) { this.togglePause({ force: false }); }
      if (track) {
        try {
          const resource = createAudioResource(youtubedl.exec(`https://www.youtube.com/watch?v=${track.youtube[0].id}`, {
            output: '-',
            quiet: true,
            forceIpv4: true,
            format: 'bestaudio[ext=webm]+bestaudio[acodec=opus]+bestaudio[asr=48000]/bestaudio',
            limitRate: '100K',
            cookies: fileURLToPath(new URL('../../cookies.txt', import.meta.url).toString()),
            userAgent: useragent,
          }, { stdio: ['ignore', 'pipe', 'ignore'] }).stdout!);
          this.#audioPlayer.play(resource);
          log('track', ['Playing track:', (track.goose.artist.name), ':', (track.goose.track.name)]);
        } catch (error:any) {
          log('error', [error.stack]);
        }
      } else if (this.#audioPlayer.state.status == 'playing') { this.#audioPlayer.stop(); } // include this line in db cleanup, outer handles it
    } else if (this.#audioPlayer.state.status == 'playing') { this.#audioPlayer.stop(); }
  }

  prev(play = true) { // prior, loop or restart current
    const priorPlayhead = this.#queue.playhead;
    this.#queue.playhead = ((playhead = this.#queue.playhead, length = this.#queue.tracks.length) => (playhead > 0) ? --playhead : (this.#queue.loop) ? (length &&= length - 1) : 0)();
    if (play) {this.play();}
    if (this.#queue.tracks[priorPlayhead]?.status?.ephemeral) { this.remove(priorPlayhead); }
  }

  next(play = true) { // next, loop or end
    const priorPlayhead = this.#queue.playhead;
    this.#queue.playhead = ((playhead = this.#queue.playhead, length = this.#queue.tracks.length) => (playhead < length - 1) ? ++playhead : (this.#queue.loop) ? 0 : length)();
    if (play) {this.play();}
    if (this.#queue.tracks[priorPlayhead]?.status?.ephemeral) { this.remove(priorPlayhead); }
  }

  jump(position:number) {
    const priorPlayhead = this.#queue.playhead;
    this.#queue.playhead = ((value = Math.abs(position), length = this.#queue.tracks.length) => (value < length) ? value : (length &&= length - 1))();
    this.play();
    if (this.#queue.tracks[priorPlayhead]?.status?.ephemeral) { this.remove(priorPlayhead); }
  }

  async seek(time:number) {
    let ephemeral;
    let UUID;
    let track = this.#queue.tracks[this.#queue.playhead];
    if (track) { UUID = track.goose.UUID, ephemeral = track.status.ephemeral; }
    track &&= await db.getTrack({ 'goose.id': track.goose.id }) as Track;
    if (track) { track.goose.UUID = UUID, track.status.ephemeral = ephemeral; }
    this.#queue.tracks[this.#queue.playhead] &&= track;
    if (this.getPause()) { this.togglePause({ force: false }); }
    if (track) {
      try {
        seekable.setToken({
          useragent : [useragent],
        }); // can send a cookie string also, but seems unnecessary https://play-dl.github.io/modules.html#setToken
        const source = await seekable.stream(`https://www.youtube.com/watch?v=${track.youtube[0].id}`, { seek:time });
        const resource = createAudioResource(source.stream, { inputType: source.type });
        this.#audioPlayer.play(resource);
        log('track', [`Seeking to time ${time} in `, (track.goose.artist.name), ':', (track.goose.track.name)]);
      } catch (error:any) {
        log('error', [error.stack]);
      }
      track.status.seek = time;
      track.status.start = (Date.now() / 1000) - (time || 0);
    } else if (this.#audioPlayer.state.status == 'playing') { this.#audioPlayer.stop(); }
  }

  togglePause({ force }:{ force?:boolean } = {}) {
    force = (typeof force == 'boolean') ? force : undefined;
    const condition = (force == undefined) ? this.#queue.paused : !force;
    const result = (condition) ? !this.#audioPlayer.unpause() : this.#audioPlayer.pause();
    (condition != result) ? this.#queue.paused = result : logDebug('togglePause failed');
    return ((condition != result) ? ({ content: (result) ? 'Paused.' : 'Unpaused.' }) : ({ content:'OH NO SOMETHING\'S FUCKED' }));
  }

  toggleLoop({ force }:{ force?:boolean } = {}) {
    force = (typeof force == 'boolean') ? force : undefined;
    this.#queue.loop = (force == undefined) ? !this.#queue.loop : force;
    if (this.#queue.loop && this.#queue.tracks.length && (this.#queue.tracks.length == this.#queue.playhead)) { this.next(); }
    return (this.#queue.loop);
  }

  // modification
  static assignUUID(tracks:Track[]) {
    tracks.map(track => track.goose.UUID ||= crypto.randomUUID());
  }

  // intended for non-pending tracks
  queueNow(tracks:Track[]) {
    Player.assignUUID(tracks);
    this.#queue.tracks.splice(this.#queue.playhead + 1, 0, ...tracks);
    (this.#audioPlayer.state.status == 'idle') ? this.play() : this.next();
  }

  // intended for non-pending tracks
  queueNext(tracks:Track[]) {
    Player.assignUUID(tracks);
    this.#queue.tracks.splice(this.#queue.playhead + 1, 0, ...tracks);
    if (this.#audioPlayer.state.status == 'idle') { this.play(); }
  }

  // intended for non-pending tracks
  queueLast(tracks:Track[]) {
    Player.assignUUID(tracks);
    const length = this.#queue.tracks.push(...tracks);
    if (this.#audioPlayer.state.status == 'idle') { this.play(); }
    return (length);
  }

  // intended for non-pending tracks
  queueIndex(tracks:Track[], index:number) {
    Player.assignUUID(tracks);
    const length = this.#queue.tracks.length; // eslint-disable-next-line max-statements-per-line
    if (index < 0) { index = 0; } else if (index > length) { index = length; }
    if (this.#queue.playhead === length) { // on empty or ended queue, see addition as intent to play addition
      this.#queue.playhead = index;
    } else if (index <= this.#queue.playhead) { // if splice moves current, move the playhead by displacement
      this.#queue.playhead = this.#queue.playhead + tracks.length;
    }
    this.#queue.tracks.splice(index, 0, ...tracks);
    if (this.#audioPlayer.state.status == 'idle') { this.play(); }
  }

  // insert, return UUID needed to replace; caller is expected to do follow/clean-up for now
  pendingNext(username:string):{ UUID:string } {
    const pending = Player.pendingTrack(username);
    this.#queue.tracks.splice(this.#queue.playhead + 1, 0, pending);
    return ({ UUID: pending.goose.UUID });
  }

  pendingLast(username:string):{ UUID:string, length:number } {
    const pending = Player.pendingTrack(username);
    const length = this.#queue.tracks.push(pending);
    return ({ UUID: pending.goose.UUID, length: length });
  }

  pendingIndex(username:string, index:number):{ UUID:string } {
    const pending = Player.pendingTrack(username);
    const length = this.#queue.tracks.length; // eslint-disable-next-line max-statements-per-line
    if (index < 0) { index = 0; } else if (index > length) { index = length; }
    logDebug(`pendingIndex—playhead is ${this.#queue.playhead}, track is ${(this.#queue.tracks[this.#queue.playhead]) ? this.#queue.tracks[this.#queue.playhead].goose.track.name : 'undefined because playhead == length'}`);
    if (this.#queue.playhead === length) { // on empty or ended queue, see addition as intent to play addition
      this.#queue.playhead = index;
    } else if (index <= this.#queue.playhead) { // if splice moves current, move the playhead
      this.#queue.playhead = this.#queue.playhead + 1;
    } // because pendingNext does playhead + 1 and splice constrains to length, you get playhead == pending and resume from idle. where on empty/ended this works, but keeps playhead at length instead of on the pending track
    this.#queue.tracks.splice(index, 0, pending);
    logDebug(`pendingIndex—playhead is ${this.#queue.playhead}, track is ${(this.#queue.tracks[this.#queue.playhead]) ? this.#queue.tracks[this.#queue.playhead].goose.track.name : 'undefined for reasons?'}`);
    return ({ UUID: pending.goose.UUID });
  }

  replacePending(tracks:Track[], targetUUID:string):boolean {
    const start = this.getIndex(targetUUID);
    if (start !== -1) {
      logDebug(`replace—playhead is ${this.#queue.playhead}, track is ${(this.#queue.playhead < this.#queue.tracks.length) ? this.#queue.tracks[this.#queue.playhead].goose.track.name : 'undefined because playhead == length'}`);
      tracks[0].goose.UUID = this.#queue.tracks[start].goose.UUID; // niche handling of replacement while dragging
      Player.assignUUID(tracks);
      if (this.#queue.playhead == this.#queue.tracks.length) { // on empty or ended queue, see addition as intent to play addition
        this.#queue.playhead = start;
      } else if (start < this.#queue.playhead) { // pending adds 1, delete count in splice removes 1. so length 1 is an in-place swap
        this.#queue.playhead = this.#queue.playhead + tracks.length - 1; // length > 1 moves current, so move playhead by displacement
      }
      this.#queue.tracks.splice(start, 1, ...tracks);
      if (this.#audioPlayer.state.status == 'idle') { this.play(); }
      logDebug(`replace—playhead is ${this.#queue.playhead}, track is ${(this.#queue.playhead < this.#queue.tracks.length) ? this.#queue.tracks[this.#queue.playhead].goose.track.name : 'undefined because playhead == length'}`);
    }
    return (start !== -1);
  }

  // a track has to exist to be pending; undefined is not a transient state
  static pending(track:Track|undefined) {
    return (track !== undefined && track.goose.id === '');
  }

  static pendingTrack(queuedBy:string):Track & { goose:{ UUID:string }} {
    return ({
      'goose': {
        'id': '', // currently no id means pending
        'plays': 0,
        'errors': 0,
        'album': {
          'name': '',
          'trackNumber': 0,
        },
        'artist': {
          'name': `Queued by ${queuedBy}`,
        },
        'track': {
          'name': 'PENDING',
          'duration': 232,
          'art': utils.pickPride('dab', false),
        },
        'UUID': crypto.randomUUID(),
      },
      'keys': [
        'pending',
      ],
      'playlists': {},
      'youtube': [
        {
          'id': 'OVL3MYasc-k',
          'name': 'Elk Bugle up close.',
          'art': 'https://i.ytimg.com/vi/OVL3MYasc-k/hqdefault.jpg',
          'duration': 232,
          'url': 'https://youtu.be/OVL3MYasc-k',
        },
      ],
      'status': {},
    });
  }

  // browser client will always supply UUID; is optional to support commands.
  // enables concurrent modification while dragging
  move(from:number, to:number, targetUUID?:string) {
    const length = this.#queue.tracks.length;
    logDebug(`move—initial from: ${from}, to: ${to}, length: ${length}`);

    // happens first because wrong values of from need corrected before it's used;
    // redundant length check to safely check UUID, then after because UUID is optional
    if (targetUUID && from < length && this.#queue.tracks[from].goose.UUID !== targetUUID) {
      logDebug(`move—UUID mismatch; target UUID [${targetUUID}]`);
      from = this.getIndex(targetUUID);
      if (from == -1) {
        logDebug(`move—could not find UUID [${targetUUID}]`);
        return ({ success: false, message: 'either someone else removed that track while you were moving it or we\'ve fucked up' });
      }
      logDebug(`move—UUID [${targetUUID}] matched to queue[${from}]`);
    }
    if (from < to) { to--; } // splice-removing [from] decrements all indexes > from

    if (from < length && to < length && from !== to) {
      let playhead = this.#queue.playhead;
      logDebug(`move—playhead is ${playhead}, track is ${(playhead < length) ? this.#queue.tracks[playhead].goose.track.name : 'undefined because playhead == length'}`);

      const removed = this.#queue.tracks.splice(from, 1);
      this.#queue.tracks.splice(to, 0, removed[0]);

      if ((from < playhead) && (playhead <= to)) { // handle negative crossing
        playhead--;
      } else if ((to <= playhead) && (playhead < from)) { // handle positive crossing; also to
        playhead++;
      } else if (from === playhead) { // handle from
        playhead = to;
      } else { /* do nothing */ }
      this.#queue.playhead = playhead;
      logDebug(`move—playhead is ${playhead}, track is ${(playhead < length) ? this.#queue.tracks[playhead].goose.track.name : 'undefined because playhead == length'}`);

      return ({ success: true, message: `moved ${removed[0].goose.track.name} from position ${from + 1} to position ${to + 1}` });
    } else { return ({ success: false, message: `could not move track from position ${from} to position ${to}. ${(from >= length) ? '\tfrom > length' : ''} ${(to > length) ? '\tto > length' : ''} ${(from == to) ? '\tfrom == to' : ''}` }); }
  }

  remove(position = this.#queue.playhead) { // will make this take a range later
    position = ((value = Math.abs(position), length = this.#queue.tracks.length) => (value > length) ? length : value)();
    const removed = this.#queue.tracks.splice(position, 1); // constrained 0 to length, not length - 1, and unworried about overshooting due to how splice is implemented
    if (position < this.#queue.playhead) {
      this.#queue.playhead--;
    } else if (position == this.#queue.playhead) {
      this.play();
    }
    return (removed);
  }

  removebyUUID(targetUUID:string) {
    let removed:Track[] = [];
    const index = this.getIndex(targetUUID);
    if (index !== -1) {
      removed = this.remove(index);
      logDebug(`Removed item ${index} with matching UUID`);
    }
    return (removed);
  }

  removeById(id:string) {
    const idTest = (element:Track) => element.goose.id === id;
    while (this.#queue.tracks.findIndex(idTest) > 0) {
      const index = this.#queue.tracks.findIndex(idTest);
      this.remove(index);
      logDebug(`Removed item ${index} with matching goose id`);
    }
  }

  static removeFromAll(id:string) {
    for (const player of Object.values(Player.#players)) {
      logDebug(`Attempting to remove ${id} from ${player.guildID}`);
      player.removeById(id);
    }
  }

  empty() {
    this.#queue.playhead = 0;
    this.#queue.tracks.length = 0;
    this.#audioPlayer.stop();
  }

  recall(tracks:Track[], playhead:number) {
    Player.assignUUID(tracks);
    this.#queue.tracks = tracks;
    this.jump(playhead);
  }

  // verbatim Fisher—Yates shuffle, but of the order elements will be visited rather than of the actual elements
  // to enable visiting all elements in random order, without randomly ordering them. retain positioning control
  #randomizer(length:number) {
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
  shuffle({ albumAware = false } = {}, alternate:Track[] | undefined = undefined) { // if alternate, shuffle and return that instead of the queue
    const loop = this.getLoop() || !this.getNext(); // we're treating shuffling a queue that's over as a 1-action request to restart it, shuffled
    const queue = (alternate) ? null : this.getQueue();
    const current = (alternate) ? null : this.getCurrent();
    const playhead = (alternate) ? null : (loop || !current) ? 0 : this.getPlayhead(); // shuffle everything or just the remaining, unheard queue
    const tracks = alternate || queue!.slice(playhead!);
    if (!alternate) { queue!.length = playhead as number, this.#queue.playhead = playhead as number; }
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
        const random = this.#randomizer(grouping.length);
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
      queue!.push(...result);
      if (!current) { this.play(); }
    }

    // // visual testing code from elsewhere, included here so as to not need to recreate it should it be needed in future
    // console.log(((current = this.getCurrent()) => chalk.hex(current.color || 0xFFFFFF)(`Current: #${(current) ? current.album.trackNumber : 0}: ${(current) ? current.spotify.name || current.youtube.name : 'none'}\n`))());
    // for (const [index, track] of this.queue.tracks.entries()) {
    //   console.log(chalk.hex(track.color || 0xFFFFFF)(`[${index}]: #${track.album.trackNumber || 0}: ${track.spotify.name || track.youtube.name}`));
  }

  // information
  getPrev():Track { // prior, loop around or current
    const position = ((playhead = this.#queue.playhead, length = this.#queue.tracks.length) => (playhead > 0) ? --playhead : (this.#queue.loop) ? (length &&= length - 1) : 0)();
    return (this.#queue.tracks[position]);
  }

  getCurrent():Track|undefined {
    return (this.#queue.tracks[this.#queue.playhead]);
  }

  getNext():Track|undefined { // next, loop around or end
    const position = ((playhead = this.#queue.playhead, length = this.#queue.tracks.length) => (playhead < length - 1) ? ++playhead : (this.#queue.loop) ? 0 : length)();
    return (this.#queue.tracks[position]);
  }

  getIndex(targetUUID:string) {
    return this.#queue.tracks.findIndex(track => track.goose.UUID === targetUUID);
  }

  getQueue():Track[] {
    return (this.#queue.tracks);
  }

  getPause():boolean {
    return (this.#queue.paused);
  }

  getLoop():boolean {
    return (this.#queue.loop);
  }

  getPlayhead():number {
    return (this.#queue.playhead);
  }

  getStatus():PlayerStatus {
    if (!this.#queue) { logDebug('player—getStatus and queue nullish'); }
    return this.#queue;
  }

  // embeds
  async mediaEmbed(fresh = true, messageTitle = 'Current Track:'):Promise<InteractionReplyOptions> {
    const thumb = fresh ? (new AttachmentBuilder(utils.pickPride('dab') as string, { name:'art.jpg' })) : null;
    const track = this.getCurrent();
    const bar = {
      start: track?.bar?.start,
      end: track?.bar?.end,
      barbefore: track?.bar?.barbefore,
      barafter: track?.bar?.barafter,
      head: track?.bar?.head,
    };
    // const elapsedTime = (!track || !track.status?.start) ? 0 : (this.getPause()) ? (track.status.pause! - track.status.start) : ((Date.now() / 1000) - track.status.start);
    const elapsedTime:number = (this.getPause() ? (track?.status?.pause! - track?.status?.start!) : ((Date.now() / 1000) - track?.status?.start!)) || 0;
    if (track && !Player.pending(track) && ((track.goose.artist.name !== 'Unknown Artist') && !track.goose.artist?.official)) {
      const result = await utils.mbArtistLookup(track.goose.artist.name);
      if (result) {db.updateOfficial(track.goose.id, result);}
      track.goose.artist.official = result ? result : '';
    }
    const embed = {
      color: 0x3277a8,
      author: { name: messageTitle, icon_url: utils.pickPride('fish') },
      thumbnail: { url: 'attachment://art.jpg' },
      fields: [
        { name: '\u200b', value: (track) ? `${(track.goose.artist.name || ' ')} - [${(track.goose.track.name)}](${track.youtube[0].url})\n[Support this artist!](${track.goose.artist.official})` : 'Nothing is playing.' },
        { name: (track) ? `\` ${utils.progressBar(45, (track.goose.track.duration), elapsedTime, bar)} \`` : utils.progressBar(45, 100, 0), value: `${this.getPause() ? 'Paused:' : 'Elapsed:'} ${utils.timeDisplay(elapsedTime)} | Total: ${utils.timeDisplay(track?.goose.track.duration || 0)}` },
      ],
    };
    const buttons = [
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'media-refresh', style: 2, label: 'Refresh', disabled: false },
          { type: 2, custom_id: 'media-prev', style: 1, label: 'Previous', disabled: false },
          { type: 2, custom_id: 'media-pause', style: 3, label: (this.getPause()) ? 'Play' : 'Pause', disabled: false },
          { type: 2, custom_id: 'media-next', style: 1, label: 'Next', disabled: false },
          { type: 2, custom_id: 'media-showqueue', style:1, label:'Show Queue' },
          // { type: 2, custom_id: '', style: 2, label: '', disabled: false },
        ],
      },
    ];
    return fresh ? { embeds: [embed], components: buttons, files: [thumb] } as InteractionReplyOptions : { embeds: [embed], components: buttons } as InteractionReplyOptions;
  }

  async queueEmbed(messagetitle = 'Current Queue:', page?:number | undefined, fresh = true):Promise<InteractionUpdateOptions | InteractionReplyOptions> {
    const track = this.getCurrent();
    const queue = this.getQueue();
    page = Math.abs(page!) || Math.ceil((this.getPlayhead() + 1) / 10);
    const albumart = (fresh && track) ? new AttachmentBuilder((track.goose.track.art), { name:'art.jpg' }) : (new AttachmentBuilder(utils.pickPride('dab') as string, { name:'art.jpg' }));
    const pages = Math.ceil(queue.length / 10);
    const buttonEmbed = [
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'queue-refresh', style:2, label:'Refresh' },
          { type: 2, custom_id: 'queue-prev', style:1, label:'Previous', disabled: (page === 1) ? true : false },
          { type: 2, custom_id: 'queue-home', style:2, label:'Home', disabled: (page === Math.ceil((this.getPlayhead() + 1) / 10)) ? true : false },
          { type: 2, custom_id: 'queue-next', style:1, label:'Next', disabled: (page === pages) ? true : false },
        ],
      },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'queue-loop', style:(this.getLoop()) ? 4 : 3, label:(this.getLoop()) ? 'Disable loop' : 'Enable loop' },
          { type: 2, custom_id: 'queue-shuffle', style:1, label:'Shuffle', disabled: false },
          { type: 2, custom_id: 'queue-showmedia', style:1, label:'Show Media Player' },
        ],
      },
    ];
    if (pages === 0) { return { embeds: [{ color: 0xfc1303, title: 'Nothing to show!', thumbnail: { url: 'attachment://art.jpg' } }], components: buttonEmbed, ephemeral: true }; }
    if (page > pages) { page = pages; }
    const queuePart = queue.slice((page - 1) * 10, page * 10);
    let queueStr = '';
    for (let i = 0; i < queuePart.length; i++) {
      const songNum = ((page - 1) * 10 + (i + 1));
      // const dbtrack = await db.getTrack({ 'goose.id':queuePart[i].goose.id }) as Track; // was
      const dbtrack = (!Player.pending(queuePart[i])) ? await db.getTrack({ 'goose.id':queuePart[i].goose.id }) as Track : queuePart[i];
      let songName = dbtrack.goose.track.name;
      if (songName.length > 250) { songName = songName.slice(0, 250).concat('...'); }
      const part = `**${songNum}.** ${((songNum - 1) == this.getPlayhead()) ? '**' : ''}${(dbtrack.goose.artist.name || ' ')} - [${songName}](${dbtrack.youtube[0].url}) - ${utils.timeDisplay(dbtrack.youtube[0].duration)}${((songNum - 1) == this.getPlayhead()) ? '**' : ''} \n`;
      queueStr = queueStr.concat(part);
    }
    let queueTime = 0;
    for (const item of queue) { queueTime = queueTime + Number(item.goose.track.duration); }
    // let elapsedTime = (!track || !track.status?.start) ? 0 : (this.getPause()) ? (track.status.pause! - track.status.start) : ((Date.now() / 1000) - track.status.start);
    let elapsedTime:number = (this.getPause() ? (track?.status?.pause! - track?.status?.start!) : ((Date.now() / 1000) - track?.status?.start!)) || 0;
    for (const [i, item] of queue.entries()) {
      if (i < this.getPlayhead()) {
        elapsedTime = elapsedTime + Number(item.goose.track.duration);
      } else { break;}
    }
    const bar = {
      start: track?.bar?.start || '[',
      end: track?.bar?.end || ']',
      barbefore: track?.bar?.barbefore || '#',
      barafter: track?.bar?.barafter || '-',
      head: track?.bar?.head || '#',
    };
    if (track && ((track.goose.artist.name !== 'Unknown Artist') && !track.goose.artist?.official)) {
      const result = await utils.mbArtistLookup(track.goose.artist.name);
      if (result) {db.updateOfficial(track.goose.id, result);}
      track.goose.artist.official = result ? result : '';
    }
    const embed = {
      color: 0x3277a8,
      author: { name: (messagetitle || 'Current Queue:'), icon_url: utils.pickPride('fish') },
      thumbnail: { url: 'attachment://art.jpg' },
      description: `**${this.getPause() ? 'Paused:' : 'Now Playing:'}** \n ${(track) ? `**${this.getPlayhead() + 1}. **${(track.goose.artist.name || ' ')} - [${(track.goose.track.name)}](${track.youtube[0].url}) - ${utils.timeDisplay(track.youtube[0].duration)}\n[Support this artist!](${track.goose.artist.official})` : 'Nothing is playing.'}\n\n**Queue:** \n${queueStr}`,
      fields: [
        { name: '\u200b', value: `Loop: ${this.getLoop() ? '🟢' : '🟥'}`, inline: true },
        { name: '\u200b', value: `Page ${page} of ${pages}`, inline: true },
        { name: '\u200b', value: `${queue.length} tracks`, inline: true },
        { name: `\` ${utils.progressBar(45, queueTime, elapsedTime, bar)} \``, value: `${this.getPause() ? 'Paused:' : 'Elapsed:'} ${utils.timeDisplay(elapsedTime)} | Total: ${utils.timeDisplay(queueTime)}` },
      ],
    };
    return fresh ? { embeds: [embed], components: buttonEmbed, files: [albumart] } as InteractionUpdateOptions : { embeds: [embed], components: buttonEmbed } as InteractionReplyOptions;
  }

  async decommission(interaction:CommandInteraction | ButtonInteraction, type: 'queue' | 'media', embed:InteractionReplyOptions | InteractionUpdateOptions, message = '\u27F3 expired') {
    const { embeds, components } = JSON.parse(JSON.stringify(embed));
    switch (type) {
      case 'queue': {
        logDebug('decommission queue');
        embeds[0].footer = { text: message };
        for (const row of components) {
          for (const button of row.components) { button.style = 2; }
        }
        components[0].components[0].style = 3;
        return interaction.editReply({ embeds: embeds, components: components });
        // break;
      }
      case 'media': {
        logDebug('decommission media');
        embeds[0].footer = { text: message };
        for (const button of components[0].components) { button.style = 2; }
        components[0].components[2].label = (this.getPause()) ? 'Play' : 'Pause';
        components[0].components[0].style = 3;
        return interaction.editReply({ embeds: embeds, components: components });
        // break;
      }

      default: {
        break;
      }
    }
  }

  // don't see any reason this needs to be async; todo: eventually clean up a lot of these unnecessary asyncs
  async register(interaction: CommandInteraction & { message?: Message<boolean> } | ButtonInteraction, type: 'queue'|'media', embed:InteractionUpdateOptions | InteractionReplyOptions) {
    const id = interaction.member!.user.id;
    if (!this.#embeds[id]) { this.#embeds[id] = {}; }

    const name = interaction.member!.user.username;

    switch (type) {
      case 'queue': {
        const match = (embed.embeds![0] as APIEmbed).fields![1]?.value.match(embedPage);
        if (this.#embeds[id].queue) {
          this.#embeds[id].queue!.idleTimer.refresh();
          this.#embeds[id].queue!.refreshTimer.refresh();
          this.#embeds[id].queue!.refreshCount = 0;
          this.#embeds[id].queue!.userPage = Number(match![1]);
          this.#embeds[id].queue!.followPlayhead = (Number(match![1]) == Math.ceil((this.getPlayhead() + 1) / 10));
          if (this.#embeds[id].queue!.interaction!.message!.id != interaction.message?.id) {
            const temp = this.#embeds[id].queue!.interaction!;
            this.#embeds[id].queue!.interaction = undefined;
            (async () => this.decommission(temp, type, embed))();
          }
          this.#embeds[id].queue!.interaction = interaction;
        } else {
          this.#embeds[id].queue = {
            userPage : Number(match![1]),
            followPlayhead : (Number(match![1]) == Math.ceil((this.getPlayhead() + 1) / 10)),
            refreshCount: 0,
            interaction: interaction,
            idleTimer: setTimeout(async () => {
              clearInterval(this.#embeds[id].queue!.refreshTimer);
              await this.decommission(this.#embeds[id].queue!.interaction!, 'queue', await this.queueEmbed(undefined, undefined, false));
              delete this.#embeds[id].queue;
              if (!Object.keys(this.#embeds[id]).length) { delete this.#embeds[id]; }
            }, 870000).unref(),
            refreshTimer: setInterval(async () => {
              this.#embeds[id].queue!.refreshCount++;
              this.#embeds[id].queue!.update(id, 'interval');
            }, 15000).unref(),
            getPage: () => {
              if (this.#embeds[id].queue!.followPlayhead || this.#embeds[id].queue!.refreshCount > 2) {
                this.#embeds[id].queue!.userPage = Math.ceil((this.getPlayhead() + 1) / 10);
                this.#embeds[id].queue!.refreshCount = 0;
                this.#embeds[id].queue!.followPlayhead = true;
              }
              return (this.#embeds[id].queue!.userPage);
            },
            update: async (userId:string, description:string, content?:InteractionUpdateOptions | InteractionReplyOptions) => {
              logDebug(`${name} queue: ${description}`); // to do, consider a bandaid like if description === 'web sync', refreshTimer.refresh();
              const contentPage = (content) ? (content.embeds![0] as APIEmbed)?.fields?.[1]?.value?.match(embedPage) : null;
              const differentPage = (contentPage) ? !(Number(contentPage[1]) === this.#embeds[id].queue!.getPage()) : null;
              if (!content || differentPage) { content = await this.queueEmbed('Current Queue:', this.#embeds[id].queue!.getPage(), false); }
              const { embeds, components, files } = content!;
              if (!this.#embeds[userId].queue!.interaction!.replied && files) {
                this.#embeds[userId].queue!.interaction!.message = await this.#embeds[userId].queue!.interaction!.editReply({ embeds: embeds, components: components, files: files });
              } else { this.#embeds[userId].queue!.interaction!.message = await this.#embeds[userId].queue!.interaction!.editReply({ embeds: embeds, components: components }); }
            },
          };
        }
        break;
      }

      case 'media': {
        if (this.#embeds[id].media) {
          this.#embeds[id].media!.idleTimer.refresh();
          this.#embeds[id].media!.refreshTimer.refresh();
          if (this.#embeds[id].media!.interaction!.message!.id != interaction.message?.id) {
            const temp = this.#embeds[id].media!.interaction!;
            this.#embeds[id].media!.interaction = undefined;
            (async () => this.decommission(temp, type, embed))();
          }
          this.#embeds[id].media!.interaction = interaction;
        } else {
          this.#embeds[id].media = {
            interaction: interaction,
            idleTimer: setTimeout(async () => {
              clearInterval(this.#embeds[id].media!.refreshTimer);
              await this.decommission(this.#embeds[id].media!.interaction!, 'media', await this.mediaEmbed(false));
              delete this.#embeds[id].media;
              if (!Object.keys(this.#embeds[id]).length) { delete this.#embeds[id]; }
            }, 870000).unref(),
            refreshTimer: setInterval(() => {
              this.#embeds[id].media!.update(id, 'interval');
            }, 15000).unref(),
            update: async (userId:string, description:string, content?:InteractionUpdateOptions | InteractionReplyOptions) => {
              content ||= await this.mediaEmbed(false);
              logDebug(`${name} media: ${description}`); // to do, consider a bandaid like if description === 'web sync', refreshTimer.refresh();
              const { embeds, components, files } = content!;
              if (!this.#embeds[userId].media!.interaction!.replied && files) {
                this.#embeds[userId].media!.interaction!.message = await this.#embeds[userId].media!.interaction!.editReply({ embeds: embeds, components: components, files: files });
              } else { this.#embeds[userId].media!.interaction!.message = await this.#embeds[userId].media!.interaction!.editReply({ embeds: embeds, components: components }); }
            },
          };
        }
        break;
      }

      default: {
        logDebug(`register failing with type: ${type}`);
        break;
      }
    }
  }

  async sync(interaction:CommandInteraction | ButtonInteraction, type: 'queue'|'media', queueEmbed:InteractionReplyOptions | InteractionUpdateOptions, mediaEmbed?:InteractionReplyOptions | InteractionUpdateOptions) {
    if (functions.web) { (await import('./webserver.js')).sendWebUpdate('player', this.getStatus()); }
    switch (type) {
      case 'queue': { // strip non-false parameter thing
        Object.keys(this.#embeds).map(async (id) => {
          this.#embeds[id]?.queue?.update(id, 'sync', queueEmbed);
        });
        break;
      }
      case 'media': {
        Object.keys(this.#embeds).map(async (id) => {
          const { queue, media } = this.#embeds[id];
          await Promise.all([queue?.update(id, 'sync', queueEmbed), media?.update(id, 'sync', mediaEmbed)]);
        });
        break;
      }
      default: {
        logDebug(`player sync—bad case: ${type}`);
        break;
      }
    }
  }

  async webSync(type: 'queue'|'media') {
    if (functions.web) { (await import('./webserver.js')).sendWebUpdate('player', this.getStatus()); }
    const keys = Object.keys(this.#embeds);
    if (keys.length) {
      // logDebug('have embeds');
      switch (type) {
        case 'queue': {
          const queueEmbed = await this.queueEmbed(undefined, undefined, false);
          keys.map(async (id) => {
            this.#embeds[id]?.queue?.update(id, 'web sync', queueEmbed);
          });
          break;
        }
        case 'media': {
          const mediaEmbed = await this.mediaEmbed(false);
          const queueEmbed = await this.queueEmbed(undefined, undefined, false);
          keys.map(async (id) => {
            this.#embeds[id]?.queue?.update(id, 'web sync', queueEmbed);
            this.#embeds[id]?.media?.update(id, 'web sync', mediaEmbed);
          });
          break;
        }
        default: {
          logDebug(`web sync—bad case: ${type}`);
        }
      }
    } // else { logDebug('no embeds'); }
  }
}