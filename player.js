import fs from 'fs';
import youtubedl from 'youtube-dl-exec';
import { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource } from '@discordjs/voice';
import crypto from 'crypto';
import { MessageAttachment } from 'discord.js';
import * as db from './database.js';
import { logLine, logDebug } from './logger.js';
const { useragent } = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url))).youtube;
import * as utils from './utils.js';
import { embedPage } from './regexes.js';
import { stream as seekable } from 'play-dl';

export default class Player {
  // acquisition
  static #players = {};
  constructor(interaction) {
    this.queue = {
      tracks: [],
      playhead: 0,
      loop: false,
      paused: false,
    };
    this.guildID = interaction.guild.id;
    this.listeners = {};

    this.player = createAudioPlayer();
    this.player.on('error', error => { logLine('error', [error.stack ]); });
    this.player.on('stateChange', (oldState, newState) => {
      logDebug(`Player transitioned from ${oldState.status} to ${newState.status}`);

      if (newState.status == 'playing') {
        this.queue.tracks[this.queue.playhead].start = (Date.now() / 1000) - (this.queue.tracks[this.queue.playhead].goose.seek || 0);
      } else if (newState.status == 'idle') {
        const track = this.queue.tracks[this.queue.playhead];
        if (track) {
          const elapsed = (Date.now() / 1000) - track.start;
          const duration = track.youtube.duration;
          const difference = Math.abs(duration - elapsed);
          const percentage = (100 * ((elapsed < duration) ? (elapsed / duration) : (duration / elapsed)));
          if (difference > 10 || percentage < 95) {
            logDebug(`track: ${track.spotify.name || track.youtube.name}—goose: ${track.goose.id} duration discrepancy. start ${track.start}, elapsed ${elapsed}, duration ${duration}, difference ${difference}, percentage ${percentage}`.replace(/(?<=\d*\.\d{3})\d+/g, ''));
            db.logPlay(track.goose.id, false);
          } else { db.logPlay(track.goose.id); }
        }
        if (this.getNext()) { this.next(); }
      }
    });

    const connection = joinVoiceChannel({
      channelId: interaction.member.voice.channel.id,
      guildId: interaction.member.voice.channel.guild.id,
      adapterCreator: interaction.member.voice.channel.guild.voiceAdapterCreator,
    });
    connection.on('stateChange', (oldState, newState) => {
      logDebug(`Connection transitioned from ${oldState.status} to ${newState.status}`);
      if (newState.status == 'destroyed') {
        Object.keys(this.listeners).map(async (id) => {
          const { media, queue } = this.listeners[id];
          if (queue) {
            clearInterval(this.listeners[id].queue.idleTimer);
            clearInterval(this.listeners[id].queue.refreshTimer);
            await this.decommission(this.listeners[id].queue.interaction, 'queue', await this.queueEmbed('Current Queue:', this.listeners[id].queue.getPage(), false), 'Bot left');
          }
          if (media) {
            clearInterval(this.listeners[id].media.idleTimer);
            clearInterval(this.listeners[id].media.refreshTimer);
            await this.decommission(this.listeners[id].media.interaction, 'media', await this.mediaEmbed(false), 'Bot left');
          }
          if (this.listeners[id]) {delete this.listeners[id];}
        });
        logDebug(`Removing player with id ${this.guildID}`);
        delete Player.#players[this.guildID];
      }
    });
    connection.subscribe(this.player);
  }

  static async getPlayer(interaction, { explicitJoin = false } = {}) {
    const followUp = (message) => ((interaction.isCommand()) ? interaction.editReply({ content: message }) : interaction.editReply({ embeds: [{ color: 0xfc1303, title: message, thumbnail: { url: 'attachment://art.jpg' } }], components: [] }));
    const userChannel = interaction.member.voice.channelId;

    if (!userChannel) {
      await followUp('You must join a voice channel first.');
      return (null);
    }
    const guild = interaction.guild.id;
    const connection = getVoiceConnection(guild);
    const botChannel = (connection) ? interaction.client.channels.cache.get(connection.joinConfig.channelId) : null;
    const isAlone = !botChannel || botChannel.members.size == 1; // was just member check, but since connection seems unreliable, think this is necessary

    if (userChannel == botChannel?.id) {
      if (explicitJoin) { await followUp('Bot is already in your channel.'); }
      return (Player.#players[guild]);
    } else if (!connection || isAlone) {
      const player = (Player.#players[guild]?.join(interaction) || (Player.#players[guild] = new Player(interaction)));
      if (explicitJoin) { await followUp('Joined voice.'); }
      return (player);
    } else {
      await followUp('Bot is busy in another channel.');
      return (null);
    }
  }

  static async retrievePlayer(guildId) {
    return Player.#players[guildId];
  }

  static async voiceEventDispatch(oldState, newState, client) {
    logDebug(`Voice state update for server ${oldState.guild.id}, user ${oldState.member.displayName}`);
    if (Player.#players[oldState.guild.id]) {Player.#players[oldState.guild.id].voiceEvent(oldState, newState, client);} else {
      logDebug(`No player currently active in server ${oldState.guild.id}`);
    }
  }

  // events
  async voiceEvent(oldState, newState, client) {
    // console.log('player function called');
    const connection = getVoiceConnection(newState.guild.id);
    if ((connection.joinConfig.channelId === oldState.channelId) && (newState.channelId != connection.joinConfig.channelId)) {
      // console.log('channel matches, this is a leave event');
      if (!newState.member.user.bot) {
        const id = newState.member.id;
        await db.saveStash(id, this.queue.playhead, this.queue.tracks);
        if (this.listeners[id]?.queue) {
          clearInterval(this.listeners[id].queue.idleTimer);
          clearInterval(this.listeners[id].queue.refreshTimer);
          await this.decommission(this.listeners[id].queue.interaction, 'queue', await this.queueEmbed('Current Queue:', this.listeners[id].queue.getPage(), false), 'You left the channel');
        }
        if (this.listeners[id]?.media) {
          clearInterval(this.listeners[id].media.idleTimer);
          clearInterval(this.listeners[id].media.refreshTimer);
          await this.decommission(this.listeners[id].media.interaction, 'media', await this.mediaEmbed(false), 'You left the channel');
        }
        if (this.listeners[id]) {delete this.listeners[id];}
      }
      const botChannel = (connection) ? client.channels.cache.get(connection.joinConfig.channelId) : null;
      let humans = 0;
      for (const [, member] of botChannel.members) { (!member.user.bot) ? humans++ : null; }
      if (humans == 0) {
        logDebug('Alone in channel; leaving voice');
        connection.destroy();
      }
    }
  }

  // presence
  join(interaction) {
    joinVoiceChannel({
      channelId: interaction.member.voice.channelId,
      guildId: interaction.guild.id,
      adapterCreator: interaction.member.voice.channel.guild.voiceAdapterCreator,
    });

    return (this); // lazy code condensing
  }

  static leave(interaction) {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
      const userChannel = interaction.member.voice.channelId;
      const botChannel = (connection) ? interaction.client.channels.cache.get(connection.joinConfig.channelId) : null;
      const isAlone = botChannel.members?.size == 1;

      if (userChannel == botChannel || isAlone) {
        for (const [, member] of botChannel.members) {
          // console.log(member.id);
          if (!member.user.bot) { db.saveStash(member.id, Player.#players[interaction.guild.id].queue.playhead, Player.#players[interaction.guild.id].queue.tracks); }
        }
        const success = connection.disconnect();
        // eslint-disable-next-line no-console
        (!success) ? console.log(`failed to disconnect connection: ${connection}`) : connection.destroy();
        return ({ content: (success) ? 'Left voice.' : 'Failed to leave voice.' });
      } else {
        return ({ content:'Bot is busy in another channel.' });
      }
    } else { return ({ content:'Bot is not in a voice channel.' }); }
  }

  // playback
  async play() {
    let track = this.queue.tracks[this.queue.playhead];
    track &&= await db.getTrack({ 'goose.id': track.goose.id });
    this.queue.tracks[this.queue.playhead] &&= track;
    if (this.getPause()) { this.togglePause({ force: false }); }
    if (track) {
      try {
        const resource = createAudioResource(youtubedl.raw(`https://www.youtube.com/watch?v=${track.youtube.id}`, {
          o: '-',
          q: '',
          'force-ipv4': '',
          f: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
          r: '100K',
          cookies: 'cookies.txt',
          'user-agent': useragent,
        }, { stdio: ['ignore', 'pipe', 'ignore'] }).stdout);
        this.player.play(resource);
        logLine('track', ['Playing track:', (track.artist.name || 'no artist'), ':', (track.spotify.name || track.youtube.name)]);
      } catch (error) {
        logLine('error', [error.stack]);
      }
    } else if (this.player.state.status == 'playing') { this.player.stop(); }
    return (track);
  }

  async prev() { // prior, loop or restart current
    // this.queue.playhead = ((playhead = this.queue.playhead) => (playhead > 0) ? --playhead : (this.queue.loop) ? this.queue.tracks.length - 1 : 0)();
    this.queue.playhead = ((playhead = this.queue.playhead, length = this.queue.tracks.length) => (playhead > 0) ? --playhead : (this.queue.loop) ? (length &&= length - 1) : 0)();
    return (await this.play()); // thinking to have play return track, for feedback on if there is a track at playhead
  }

  async next() { // next, loop or end
    this.queue.playhead = ((playhead = this.queue.playhead, length = this.queue.tracks.length) => (playhead < length - 1) ? ++playhead : (this.queue.loop) ? 0 : length)();
    return (await this.play()); // thinking to have play return track, for feedback on if there is a track at playhead
  }

  async jump(position) {
    this.queue.playhead = ((value = Math.abs(position), length = this.queue.tracks.length) => (value < length) ? value : (length &&= length - 1))();
    // this.queue.playhead = ((value = Math.abs(position), length = this.queue.tracks.length) => (value < length) ? value : (length == 0) ? length : length - 1)();
    return (await this.play());
  }

  async seek(time) {
    let track = this.queue.tracks[this.queue.playhead];
    track &&= await db.getTrack({ 'goose.id': track.goose.id });
    this.queue.tracks[this.queue.playhead] &&= track;
    if (this.getPause()) { this.togglePause({ force: false }); }
    if (track) {
      try {
        const source = await seekable(`https://www.youtube.com/watch?v=${track.youtube.id}`, { seek:time });
        const resource = createAudioResource(source.stream, { inputType: source.type });
        this.player.play(resource);
        logLine('track', [`Seeking to time ${time} in `, (track.artist.name || 'no artist'), ':', (track.spotify.name || track.youtube.name)]);
      } catch (error) {
        logLine('error', [error.stack]);
      }
      track.goose.seek = time;
      track.start = (Date.now() / 1000) - (time || 0);
    } else if (this.player.state.status == 'playing') { this.player.stop(); }
    return (track);
  }

  togglePause({ force } = {}) {
    force = (typeof force == 'boolean') ? force : undefined;
    const condition = (force == undefined) ? this.queue.paused : !force;
    const result = (condition) ? !this.player.unpause() : this.player.pause();
    (condition != result) ? this.queue.paused = result : logDebug('togglePause failed');
    return ((condition != result) ? ({ content: (result) ? 'Paused.' : 'Unpaused.' }) : ({ content:'OH NO SOMETHING\'S FUCKED' }));
  }

  async toggleLoop({ force } = {}) {
    force = (typeof force == 'boolean') ? force : undefined;
    this.queue.loop = (force == undefined) ? !this.queue.loop : force;
    if (this.queue.loop && this.queue.tracks.length && (this.queue.tracks.length == this.queue.playhead)) { await this.next(); }
    return (this.queue.loop);
  }

  // modification
  async queueNow(tracks) {
    // not constrained to length because splice does that automatically
    this.queue.tracks.splice(this.queue.playhead + 1, 0, ...tracks);
    (this.player.state.status == 'idle') ? await this.play() : await this.next();
  }

  async queueNext(tracks) {
    // not constrained to length because splice does that automatically
    this.queue.tracks.splice(this.queue.playhead + 1, 0, ...tracks);
    if (this.player.state.status == 'idle') { await this.play(); }
  }

  async queueLast(tracks) {
    this.queue.tracks.push(...tracks);
    if (this.player.state.status == 'idle') { await this.play(); }
    return (this.queue.tracks.length);
  }

  async remove(position = this.queue.playhead) { // will make this take a range later
    position = ((value = Math.abs(position), length = this.queue.tracks.length) => (value > length) ? length : value)();
    const removed = this.queue.tracks.splice(position, 1); // constrained 0 to length, not length - 1, and unworried about overshooting due to how splice is implemented
    if (position < this.queue.playhead) {
      this.queue.playhead--;
    } else if (position == this.queue.playhead) {
      await this.play(); // should either this or jump check for being paused?
    }
    return (removed);
  } // seems fine

  empty() {
    this.queue.playhead = 0;
    this.queue.tracks.length = 0;
    this.player.stop();
  }

  #randomizer(length) {
    const random = [];
    for (let i = 0; i < length; i++) { random[i] = [i]; }
    for (let i = 0; i < (length - 2); i++) {
      const j = crypto.randomInt(i, length);
      const temp = random[j];
      random[j] = random[i];
      random[i] = temp;
    }
    return (random);
  }

  shuffle({ albumAware = false } = {}, alternate = undefined) { // if alternate, we shuffle and return that instead of shuffling the queue itself
    const loop = this.getLoop() || !this.getNext(); // we're treating shuffling a queue that's over as a 1-action request to restart it, shuffled
    const queue = (alternate) ? null : this.getQueue();
    const current = (alternate) ? null : this.getCurrent();
    const playhead = (alternate) ? null : (loop) ? 0 : this.getPlayhead(); // shuffle everything or just the remaining, presumably unheard queue
    const tracks = alternate || queue.slice(playhead);
    if (!alternate) { queue.length = playhead, this.queue.playhead = playhead; }
    // logDebug(`current: ${(current) ? current.spotify.name || current.youtube.name : 'none'} \n`);

    if (albumAware) {
      tracks.sort((a, b) => (a.album.trackNumber < b.album.trackNumber) ? -1 : 1);
      tracks.sort((a, b) => (a.album.name === b.album.name) ? 0 : (a.album.name < b.album.name) ? -1 : 1);
      tracks.map((track) => track.album.name ||= crypto.randomInt(tracks.length)); // null album is not an album I want to group together
    }
    tracks.sort((a, b) => (a.artist.name === b.artist.name) ? 0 : (a.artist.name < b.artist.name) ? -1 : 1);
    const groupBy = (albumAware) ? 'album' : 'artist';

    const groups = [];
    for (let grouping = 0, index = 0; index < tracks.length; index++) {
      if (groups[grouping] && groups[grouping][0][groupBy].name !== tracks[index][groupBy].name) { grouping++; }
      if (!groups[grouping]) { (groups[grouping] = []); }
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
          if (position > sparse.length) { position = Math.abs(position - sparse.length); }
          sparse.splice(position, 0, grouping[random[i]]);
        }
      }
    }
    let result = sparse.filter((element) => element);

    if (alternate) {
      return (result);
    } else {
      if (current) {
        let start = 0;
        while (result[start].start != current.start) {
          start++;
        }
        let end = start + 1;
        if (albumAware) {
          while (end < result.length && result[start].album.name == result[end].album.name) { end++; }
        }
        const rearranged = [];
        rearranged.push(...result.slice(start, end));
        rearranged.push(...result.slice(end));
        rearranged.push(...result.slice(0, start));
        result = rearranged;
      }
      queue.push(...result);
    }

    // // visual testing code from elsewhere, included here so as to not need to recreate it should it be needed in future
    // console.log(((current = this.getCurrent()) => chalk.hex(current.color || 0xFFFFFF)(`Current: #${(current) ? current.album.trackNumber : 0}: ${(current) ? current.spotify.name || current.youtube.name : 'none'}\n`))());
    // for (const [index, track] of this.queue.tracks.entries()) {
    //   console.log(chalk.hex(track.color || 0xFFFFFF)(`[${index}]: #${track.album.trackNumber || 0}: ${track.spotify.name || track.youtube.name}`));
  }

  // information
  getPrev() {
    const position = ((playhead = this.queue.playhead, length = this.queue.tracks.length) => (playhead > 0) ? --playhead : (this.queue.loop) ? (length &&= length - 1) : 0)();
    return (this.queue.tracks[position]);
  }

  getCurrent() {
    return (this.queue.tracks[this.queue.playhead]);
  }

  getNext() {
    const position = ((playhead = this.queue.playhead, length = this.queue.tracks.length) => (playhead < length - 1) ? ++playhead : (this.queue.loop) ? 0 : length)();
    return (this.queue.tracks[position]);
  }

  getQueue() {
    return (this.queue.tracks);
  }

  getPause() {
    return (this.queue.paused);
  }

  getLoop() {
    return (this.queue.loop);
  }

  getPlayhead() {
    return (this.queue.playhead);
  }

  // embeds
  async mediaEmbed(fresh = true, messageTitle = 'Current Track:') {
    const thumb = fresh ? (new MessageAttachment(utils.pickPride('dab'), 'art.jpg')) : null;
    const track = this.getCurrent();
    const bar = {
      start: track?.goose?.bar?.start,
      end: track?.goose?.bar?.end,
      barbefore: track?.goose?.bar?.barbefore,
      barafter: track?.goose?.bar?.barafter,
      head: track?.goose?.bar?.head,
    };
    const elapsedTime = ((Date.now() / 1000) - track?.start) || 0;
    if (track?.artist?.name && !track?.artist?.official) {
      const result = await utils.mbArtistLookup(track.artist.name);
      if (result) {db.updateOfficial(track.goose.id, result);}
      track.artist.official = result ? result : '';
    }
    const embed = {
      color: 0x3277a8,
      author: { name: messageTitle, icon_url: utils.pickPride('fish') },
      thumbnail: { url: 'attachment://art.jpg' },
      fields: [
        { name: '\u200b', value: (track) ? `${(track.artist.name || ' ')} - [${(track.spotify.name || track.youtube.name)}](https://youtube.com/watch?v=${track.youtube.id})\n[Support this artist!](${track.artist.official})` : 'Nothing is playing.' },
        { name: `\` ${utils.progressBar(45, (track?.youtube?.duration || track?.spotify?.duration), elapsedTime, bar)} \``, value: `Elapsed: ${utils.timeDisplay(elapsedTime)} | Total: ${utils.timeDisplay(track?.youtube?.duration || track?.spotify?.duration || 0)}` },
      ],
    };
    const buttons = [
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'media-refresh', style: 2, label: 'Refresh', disabled: false },
          { type: 2, custom_id: 'media-prev', style: 1, label: 'Previous', disabled: false },
          { type: 2, custom_id: 'media-pause', style: 3, label: (this.getPause()) ? 'Play' : 'Pause', disabled: false },
          { type: 2, custom_id: 'media-next', style: (this.getCurrent()) ? 1 : 2, label: 'Next', disabled: (this.getCurrent()) ? false : true },
          { type: 2, custom_id: 'media-showqueue', style:1, label:'Show Queue' },
          // { type: 2, custom_id: '', style: 2, label: '', disabled: false },
        ],
      },
    ];
    return fresh ? { embeds: [embed], components: buttons, files: [thumb] } : { embeds: [embed], components: buttons };
  }

  async queueEmbed(messagetitle, page, fresh = true) {
    const track = this.getCurrent();
    const queue = this.getQueue();
    page = Math.abs(page) || Math.ceil((this.getPlayhead() + 1) / 10);
    const albumart = (fresh && track) ? new MessageAttachment((track.spotify.art || track.youtube.art), 'art.jpg') : null;
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
      const dbtrack = await db.getTrack({ 'goose.id':queuePart[i].goose.id });
      const part = `**${songNum}.** ${((songNum - 1) == this.getPlayhead()) ? '**' : ''}${(dbtrack.artist.name || ' ')} - [${(dbtrack.spotify.name || dbtrack.youtube.name)}](https://youtube.com/watch?v=${dbtrack.youtube.id}) - ${utils.timeDisplay(dbtrack.youtube.duration)}${((songNum - 1) == this.getPlayhead()) ? '**' : ''} \n`;
      queueStr = queueStr.concat(part);
    }
    let queueTime = 0;
    for (const item of queue) { queueTime = queueTime + Number(item.youtube.duration || item.spotify.duration); }
    let elapsedTime = ((Date.now() / 1000) - track?.start) || 0;
    for (const [i, item] of queue.entries()) {
      if (i < this.getPlayhead()) {
        elapsedTime = elapsedTime + Number(item.youtube.duration || item.spotify.duration);
      } else { break;}
    }
    const bar = {
      start: track?.goose?.bar?.start || '[',
      end: track?.goose?.bar?.end || ']',
      barbefore: track?.goose?.bar?.barbefore || '#',
      barafter: track?.goose?.bar?.barafter || '-',
      head: track?.goose?.bar?.head || '#',
    };
    if (track?.artist?.name && !track?.artist?.official) {
      const result = await utils.mbArtistLookup(track.artist.name);
      if (result) {db.updateOfficial(track.goose.id, result);}
      track.artist.official = result ? result : '';
    }
    const embed = {
      color: 0x3277a8,
      author: { name: (messagetitle || 'Current Queue:'), icon_url: utils.pickPride('fish') },
      thumbnail: { url: 'attachment://art.jpg' },
      fields: [
        { name: 'Now Playing:', value: (track) ? `**${this.getPlayhead() + 1}. **${(track.artist.name || ' ')} - [${(track.spotify.name || track.youtube.name)}](https://youtube.com/watch?v=${track.youtube.id}) - ${utils.timeDisplay(track.youtube.duration)}\n[Support this artist!](${track.artist.official})` : 'Nothing is playing.' },
        { name: 'Queue:', value: queueStr },
        { name: '\u200b', value: `Loop: ${this.getLoop() ? '🟢' : '🟥'}`, inline: true },
        { name: '\u200b', value: `Page ${page} of ${pages}`, inline: true },
        { name: '\u200b', value: `${queue.length} tracks`, inline: true },
        { name: `\` ${utils.progressBar(45, queueTime, elapsedTime, bar)} \``, value: `Elapsed: ${utils.timeDisplay(elapsedTime)} | Total: ${utils.timeDisplay(queueTime)}` },
      ],
    };
    return fresh ? { embeds: [embed], components: buttonEmbed, files: [albumart] } : { embeds: [embed], components: buttonEmbed };
  }

  async decommission(interaction, type, embed, message = '\u27F3 expired') {
    const { embeds, components } = JSON.parse(JSON.stringify(embed));
    interaction.decommission = true;
    switch (type) {
      case 'queue': {
        logDebug('decommission queue');
        embeds[0].footer = { text: message };
        for (const row of components) {
          for (const button of row.components) { button.style = 2; }
        }
        components[0].components[0].style = 3;
        await interaction.editReply({ embeds: embeds, components: components });
        break;
      }
      case 'media': {
        logDebug('decommission media');
        embeds[0].footer = { text: message };
        for (const button of components[0].components) { button.style = 2; }
        components[0].components[2].label = (this.getPause()) ? 'Play' : 'Pause';
        components[0].components[0].style = 3;
        await interaction.editReply({ embeds: embeds, components: components });
        break;
      }

      default: {
        break;
      }
    }
  }

  async register(interaction, type, embed) {
    const id = interaction.member.user.id;
    if (!this.listeners[id]) { this.listeners[id] = {}; }

    const name = interaction.member.user.username;

    switch (type) {
      case 'queue': {
        const match = embed.embeds[0].fields[3]?.value.match(embedPage);
        if (this.listeners[id].queue) {
          this.listeners[id].queue.idleTimer.refresh();
          this.listeners[id].queue.refreshTimer.refresh();
          this.listeners[id].queue.refreshCount = 0;
          this.listeners[id].queue.userPage = (match) ? Number(match[1]) : 1;
          this.listeners[id].queue.followPlayhead = (((match) ? Number(match[1]) : 1) == Math.ceil((this.getPlayhead() + 1) / 10));
          if (this.listeners[id].queue.interaction.message.id != interaction.message?.id) {
            const temp = this.listeners[id].queue.interaction;
            this.listeners[id].queue.interaction = undefined;
            (async () => this.decommission(temp, type, embed))();
          }
          this.listeners[id].queue.interaction = interaction;
        } else {
          this.listeners[id].queue = {
            userPage : (match) ? Number(match[1]) : 1,
            followPlayhead : (((match) ? Number(match[1]) : 1) == Math.ceil((this.getPlayhead() + 1) / 10)),
            refreshCount: 0,
            interaction: interaction,
            idleTimer: setInterval(async () => {
              clearInterval(this.listeners[id].queue.idleTimer);
              clearInterval(this.listeners[id].queue.refreshTimer);
              await this.decommission(this.listeners[id].queue.interaction, 'queue', await this.queueEmbed('Current Queue:', this.listeners[id].queue.getPage(), false));
              delete this.listeners[id].queue;
              if (!Object.keys(this.listeners[id]).length) { delete this.listeners[id]; }
            }, 870000).unref(),
            refreshTimer: setInterval(async () => {
              this.listeners[id].queue.refreshCount++;
              this.listeners[id].queue.update(id, 'interval');
            }, 15000).unref(),
            getPage: function() {
              if (this.listeners[id].queue.followPlayhead || this.listeners[id].queue.refreshCount > 2) {
                this.listeners[id].queue.userPage = Math.ceil((this.getPlayhead() + 1) / 10);
                this.listeners[id].queue.refreshCount = 0;
                this.listeners[id].queue.followPlayhead = true;
              }
              return (this.listeners[id].queue.userPage);
            }.bind(this),
            update: async function(userId, description, content) {
              content ||= await this.queueEmbed('Current Queue:', this.listeners[id].queue.getPage(), false);
              const message = `${name} queue: ${description}`;
              if (this.listeners[userId].queue.interaction.decommission) {
                logDebug(`decommission interrupt — ${message}`);
                setImmediate(() => this.listeners[userId].queue.interaction.editReply(content)).unref();
              } else {
                logDebug(message);
                this.listeners[userId].queue.interaction.message = await this.listeners[userId].queue.interaction.editReply(content);
              }
            }.bind(this),
          };
        }
        break;
      }

      case 'media': {
        if (this.listeners[id].media) {
          this.listeners[id].media.idleTimer.refresh();
          this.listeners[id].media.refreshTimer.refresh();
          logDebug(`old ${this.listeners[id].media.interaction.message.id}`);
          logDebug(`new ${interaction.message?.id}`);
          if (this.listeners[id].media.interaction.message.id != interaction.message?.id) {
            const temp = this.listeners[id].media.interaction;
            this.listeners[id].media.interaction = undefined;
            (async () => this.decommission(temp, type, embed))();
          }
          this.listeners[id].media.interaction = interaction;
        } else {
          this.listeners[id].media = {
            interaction: interaction,
            idleTimer: setInterval(async () => {
              clearInterval(this.listeners[id].media.idleTimer);
              clearInterval(this.listeners[id].media.refreshTimer);
              await this.decommission(this.listeners[id].media.interaction, 'media', await this.mediaEmbed(false));
              delete this.listeners[id].media;
              if (!Object.keys(this.listeners[id]).length) { delete this.listeners[id]; }
            }, 870000).unref(),
            refreshTimer: setInterval(() => {
              this.listeners[id].media.update(id, 'interval');
            }, 15000).unref(),
            update: async function(userId, description, content) {
              content ||= await this.mediaEmbed(false);
              const message = `${name} media: ${description}`;
              if (this.listeners[userId].media.interaction.decommission) {
                logDebug(`decommission interrupt — ${message}`);
                setImmediate(() => this.listeners[userId].media.interaction.editReply(content)).unref();
              } else {
                logDebug(message);
                this.listeners[userId].media.interaction.message = await this.listeners[userId].media.interaction.editReply(content);
              }
            }.bind(this),
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

  sync(interaction, type, embed) {
    switch (type) {
      case 'queue': {
        Object.keys(this.listeners).map(async (id) => {
          const { queue } = this.listeners[id];
          const queueEmbed = (queue) ? await this.queueEmbed('Current Queue:', this.listeners[id].queue.getPage(), false) : undefined;
          this.listeners[id]?.queue?.update(id, 'sync', queueEmbed);
        });
        break;
      }
      case 'media': {
        Object.keys(this.listeners).map(async (id) => {
          const { media, queue } = this.listeners[id];
          const queueEmbed = (queue) ? await this.queueEmbed('Current Queue:', this.listeners[id].queue.getPage(), false) : undefined;
          const promises = [media?.update(id, 'sync', embed), queue?.update(id, 'sync', queueEmbed)];
          await Promise.all(promises);
        });
        break;
      }
      default: {
        logDebug(`player sync—bad case: ${type}`);
        break;
      }
    }
  }
}