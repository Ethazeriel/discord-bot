import fs from 'fs';
import { getVoiceConnection } from '@discordjs/voice';
import crypto from 'crypto';
import { ButtonInteraction, CommandInteraction, GuildMember, AttachmentBuilder, VoiceChannel, Client, VoiceState, InteractionUpdateOptions, ClientUser, InteractionReplyOptions, Message, APIEmbed } from 'discord.js';
import * as db from './database.js';
import { log, logDebug } from './logger.js';
import { fileURLToPath, URL } from 'url';
const { functions } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../config.json', import.meta.url).toString()), 'utf-8'));
import * as utils from './utils.js';
import { embedPage } from './regexes.js';
import { Worker } from 'worker_threads';

export default class Player {

  // type definitions
  worker:Worker;
  queue:PlayerStatus;
  guildID:string;
  embeds:Record<string, {
    queue?: {
      userPage:number
      followPlayhead:boolean
      refreshCount:number
      interaction?:CommandInteraction & { message?: Message<boolean> } | ButtonInteraction
      idleTimer:NodeJS.Timeout
      refreshTimer:NodeJS.Timeout
      getPage:() => Promise<number>
      update:(userId:string, description:string, content?:InteractionUpdateOptions | InteractionReplyOptions) => void
    }
    media?: {
      interaction?:CommandInteraction & { message?: Message<boolean> } | ButtonInteraction
      idleTimer:NodeJS.Timeout
      refreshTimer:NodeJS.Timeout
      update:(userId:string, description:string, content?:InteractionUpdateOptions | InteractionReplyOptions) => void
    }
  }>;
  listeners:Set<string>;
  // acquisition
  static #players:Record<string, Player> = {};
  constructor(interaction:CommandInteraction | ButtonInteraction) {
    this.queue = {
      tracks: [],
      playhead: 0,
      loop: false,
      paused: false,
    };
    this.guildID = interaction.guild!.id;
    this.embeds = {};
    this.listeners = new Set();

    const channelId = (interaction.member as GuildMember).voice.channel!.id;
    const guildId = (interaction.member as GuildMember).voice.channel!.guild.id;
    this.worker = new Worker(fileURLToPath(new URL('./workers/audiodaemon.js', import.meta.url).toString()), { workerData:{ name:'Player', channelID: channelId, guildID: guildId } });

    this.worker.on('exit', async (code) => {
      logDebug(`Worker exited with code ${code}.`);
      if (Object.keys(this.embeds).length) {
        const mediaEmbed = await this.mediaEmbed(false);
        const queueEmbed = await this.queueEmbed(undefined, undefined, false);
        Object.keys(this.embeds).map(async (id) => {
          const { media, queue } = this.embeds[id];
          if (media) {
            clearTimeout(this.embeds[id].media!.idleTimer);
            clearInterval(this.embeds[id].media!.refreshTimer);
            await this.decommission(this.embeds[id].media!.interaction!, 'media', mediaEmbed, 'Bot left');
          }
          if (queue) {
            clearTimeout(this.embeds[id].queue!.idleTimer);
            clearInterval(this.embeds[id].queue!.refreshTimer);
            await this.decommission(this.embeds[id].queue!.interaction!, 'queue', queueEmbed, 'Bot left');
          }
          if (this.embeds[id]) {delete this.embeds[id];}
        });
      }
      logDebug(`Removing player with id ${this.guildID}`);
      delete Player.#players[this.guildID];
    }); // if it exits we also exit

    this.worker.on('error', async (code) => {
      logDebug(`Worker threw error ${code.message}.`, '\n', code.stack);
      if (Object.keys(this.embeds).length) {
        const mediaEmbed = await this.mediaEmbed(false);
        const queueEmbed = await this.queueEmbed(undefined, undefined, false);
        Object.keys(this.embeds).map(async (id) => {
          const { media, queue } = this.embeds[id];
          if (media) {
            clearTimeout(this.embeds[id].media!.idleTimer);
            clearInterval(this.embeds[id].media!.refreshTimer);
            await this.decommission(this.embeds[id].media!.interaction!, 'media', mediaEmbed, 'Bot left');
          }
          if (queue) {
            clearTimeout(this.embeds[id].queue!.idleTimer);
            clearInterval(this.embeds[id].queue!.refreshTimer);
            await this.decommission(this.embeds[id].queue!.interaction!, 'queue', queueEmbed, 'Bot left');
          }
          if (this.embeds[id]) {delete this.embeds[id];}
        });
      }
      logDebug(`Removing player with id ${this.guildID}`);
      delete Player.#players[this.guildID];
    }); // handle errors by deleting everything
  }

  static async getPlayer(interaction:CommandInteraction | ButtonInteraction, { explicitJoin = false } = {}) {
    const followUp = (message:string) => ((interaction.isCommand()) ? interaction.editReply({ content: message }) : interaction.editReply({ embeds: [{ color: 0xfc1303, title: message, thumbnail: { url: 'attachment://art.jpg' } }], components: [] }));
    const userChannel = (interaction.member as GuildMember).voice.channelId;

    if (!userChannel) {
      await followUp('You must join a voice channel first.');
      return (null);
    }
    const guild = interaction.guild!.id;
    const connection = getVoiceConnection(guild);
    const botChannel = (connection) ? interaction.client.channels.cache.get(connection.joinConfig.channelId as string) as VoiceChannel : null;
    const isAlone = !botChannel || botChannel.members.size == 1; // was just member check, but since connection seems unreliable, think this is necessary

    if (userChannel == botChannel?.id) {
      if (explicitJoin) { await followUp('Bot is already in your channel.'); }
      return (Player.#players[guild]);
    } else if (!connection || isAlone) {
      const player = ((Player.#players[guild] = new Player(interaction)));
      if (explicitJoin) { await followUp('Joined voice.'); }
      return (player);
    } else {
      await followUp('Bot is busy in another channel.');
      return (null);
    }
  }

  static retrievePlayer(id:string, type:'guild' | 'user') {
    if (type === 'guild') {
      return Player.#players[id];
    } else if (type === 'user') {
      let player;
      Object.keys(Player.#players).map((playerId) => {
        if (Player.#players[playerId].listeners.has(id)) {
          player = Player.#players[playerId];
          // if you're here to add print lines because /load isn't working it's because the bot hasn't had time to idle out of the channel after you restarted it
          // boot the bot, everything is fine
        }
      });
      return (player);
    } else { log('error', [`invalid retrievePlayer type: ${type}`]); }
  }

  static async voiceEventDispatch(oldState:VoiceState, newState:VoiceState, client:Client) {
    logDebug(`Voice state update for server ${oldState.guild.id}, user ${oldState.member!.displayName}`);
    const player = Player.#players[oldState.guild.id] || (Player.#players[newState.guild.id]);
    if (player) {
      player.voiceEvent(oldState, newState, client);
    } else {
      logDebug(`No player currently active in server ${oldState.guild.id}`);
    }
  }

  // events
  async voiceEvent(oldState:VoiceState, newState:VoiceState, client:Client) {
    const connection = getVoiceConnection(newState.guild.id);
    if (connection && (connection.joinConfig.channelId === oldState.channelId) && (newState.channelId != connection.joinConfig.channelId)) {
      if (!(newState.member as GuildMember).user.bot) {
        const id = (newState.member as GuildMember).id;
        this.listeners.delete(id);
        await db.saveStash(id, this.queue.playhead, this.queue.tracks);
        if (this.embeds[id]?.queue) {
          clearTimeout(this.embeds[id].queue!.idleTimer);
          clearInterval(this.embeds[id].queue!.refreshTimer);
          await this.decommission(this.embeds[id].queue!.interaction!, 'queue', await this.queueEmbed('Current Queue:', await this.embeds[id].queue!.getPage(), false), 'You left the channel');
        }
        if (this.embeds[id]?.media) {
          clearTimeout(this.embeds[id].media!.idleTimer);
          clearInterval(this.embeds[id].media!.refreshTimer);
          await this.decommission(this.embeds[id].media!.interaction!, 'media', await this.mediaEmbed(false), 'You left the channel');
        }
        if (this.embeds[id]) {delete this.embeds[id];}
      }
      if (!this.listeners.size) { logDebug('Alone in channel; leaving voice'), connection.destroy(); }
    } else if (connection && (connection.joinConfig.channelId === newState.channelId) && (oldState.channelId != connection.joinConfig.channelId)) {
      const id = (newState.member as GuildMember).id;
      if (!(newState.member as GuildMember).user.bot) {
        this.listeners.add(id);
      } else if ((client.user as ClientUser).id == id) {
        this.listeners.clear();
        const botChannel = client.channels.cache.get(connection.joinConfig.channelId as string) as VoiceChannel;
        for (const [, member] of botChannel.members) {
          if (!member.user.bot) { this.listeners.add(member.user.id); }
        }
        if (!this.listeners.size) { logDebug('Alone in channel; leaving voice'), connection.destroy(); }
      }
    }
  }

  // type playerdata = {
  //   action:string,
  //   args:any[],
  //   id:string,
  // }

  async dispatch(action:string, args:any[] = [], id = crypto.randomBytes(5).toString('hex')):Promise<any> {
    this.worker.postMessage({ action:action, args:args, id:id });
    const promise = new Promise((resolve, reject) => {
      const actions = (result:{ id:string, return:any}) => {
        if (result.id === id) {
          resolve(result.return);
          this.worker.removeListener('message', actions);
          this.worker.removeListener('error', error);
        }
        logDebug(`acquire worker, listener ${id} called`);
      };
      const error = (err:any) => {
        log('error', ['worker error', JSON.stringify(err, null, 2)]);
        reject(err);
        this.worker.removeListener('message', actions);
        this.worker.removeListener('error', error);
      };
      this.worker.on('message', actions);
      this.worker.on('error', error);
    });

    return promise as Promise<any>;
  }

  static leave(interaction:CommandInteraction | ButtonInteraction) {
    const connection = getVoiceConnection(interaction.guild!.id);
    if (connection) {
      const userChannel = (interaction.member as GuildMember).voice.channelId;
      const botChannel = (connection) ? interaction.client.channels.cache.get(connection.joinConfig.channelId as string) as VoiceChannel : null;
      const isAlone = botChannel?.members?.size == 1;

      if (userChannel == botChannel || isAlone) {
        for (const [, member] of botChannel!.members) {
          // console.log(member.id);
          if (!member.user.bot) { db.saveStash(member.id, Player.#players[interaction.guild!.id].queue.playhead, Player.#players[interaction.guild!.id].queue.tracks); }
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
    this.dispatch('play');
  }

  async prev(play = true) { // prior, loop or restart current
    this.dispatch('prev', [play]);
  }

  async next(play = true) { // next, loop or end
    this.dispatch('next', [play]);
  }

  async jump(position:number) {
    this.dispatch('jump', [position]);
  }

  async seek(time:number) {
    this.dispatch('seek', [time]);
  }

  togglePause({ force }:{ force?:boolean } = {}) {
    const result = this.dispatch('togglePause', [{ force:force }]);
    return result;
  }

  async toggleLoop({ force }:{ force?:boolean } = {}) {
    const result = this.dispatch('toggleLoop', [{ force:force }]);
    return result;
  }

  async queueNow(tracks:Track[]) {
    this.dispatch('queueNow', [tracks]);
  }

  async queueNext(tracks:Track[]) {
    this.dispatch('queueNext', [tracks]);
  }

  async queueIndex(tracks:Track[], index:number) {
    this.dispatch('queueIndex', [tracks, index]);
  }

  async queueLast(tracks:Track[]) {
    const result = this.dispatch('queueLast', [tracks]);
    return result;
  }

  // browser client will always supply UUID; is optional to support commands.
  // is here in attempt to improve UX of concurrent modification while dragging
  move(from:number, to:number, UUID?:string) {
    const result = this.dispatch('move', [from, to, UUID]);
    return result;
  }

  async remove(position = this.queue.playhead) { // will make this take a range later
    const result = this.dispatch('remove', [position]);
    return result;
  }

  removeById(id:string) {
    const result = this.dispatch('removeById', [id]);
    return result;
  }

  static removeFromAll(id:string) {
    for (const guild in Player.#players) {
      logDebug(`Attempting to remove ${id} from ${guild}`);
      Player.#players[guild].removeById(id);
    }
  }

  empty() {
    this.dispatch('empty');
  }

  // an implementation of the goals described here: https://engineering.atspotify.com/2014/02/how-to-shuffle-songs
  shuffle({ albumAware = false } = {}, alternate:Track[] | undefined = undefined) { // if alternate, shuffle and return that instead of the queue
    const result = this.dispatch('move', [{ albumAware:albumAware }, alternate]);
    return result;
  }

  // information
  getPrev() { // prior, loop around or current
    const result = this.dispatch('getPrev');
    return result;
  }

  getCurrent() {
    const result = this.dispatch('getCurrent');
    return result;
  }

  getNext() { // next, loop around or end
    const result = this.dispatch('getNext');
    return result;
  }

  getQueue() {
    const result = this.dispatch('getQueue');
    return result;
  }

  getPause() {
    const result = this.dispatch('getPause');
    return result;
  }

  getLoop() {
    const result = this.dispatch('getLoop');
    return result;
  }

  getPlayhead() {
    const result = this.dispatch('getPlayhead');
    return result;
  }

  getStatus() {
    const result = this.dispatch('getStatus');
    return result;
  }

  // embeds
  async mediaEmbed(fresh = true, messageTitle = 'Current Track:'):Promise<InteractionReplyOptions> {
    const thumb = fresh ? (new AttachmentBuilder(utils.pickPride('dab') as string, { name:'art.jpg' })) : null;
    const track = await this.getCurrent();
    const bar = {
      start: track?.bar?.start,
      end: track?.bar?.end,
      barbefore: track?.bar?.barbefore,
      barafter: track?.bar?.barafter,
      head: track?.bar?.head,
    };
    // const elapsedTime = (!track || !track.status?.start) ? 0 : (this.getPause()) ? (track.status.pause! - track.status.start) : ((Date.now() / 1000) - track.status.start);
    const elapsedTime:number = (await this.getPause() ? (track?.status?.pause! - track?.status?.start!) : ((Date.now() / 1000) - track?.status?.start!)) || 0;
    if (track && ((track.goose.artist.name !== 'Unknown Artist') && !track.goose.artist?.official)) {
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
        { name: (track) ? `\` ${utils.progressBar(45, (track.goose.track.duration), elapsedTime, bar)} \`` : utils.progressBar(45, 100, 0), value: `${await this.getPause() ? 'Paused:' : 'Elapsed:'} ${utils.timeDisplay(elapsedTime)} | Total: ${utils.timeDisplay(track?.goose.track.duration || 0)}` },
      ],
    };
    const buttons = [
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'media-refresh', style: 2, label: 'Refresh', disabled: false },
          { type: 2, custom_id: 'media-prev', style: 1, label: 'Previous', disabled: false },
          { type: 2, custom_id: 'media-pause', style: 3, label: (await this.getPause()) ? 'Play' : 'Pause', disabled: false },
          { type: 2, custom_id: 'media-next', style: (await this.getCurrent()) ? 1 : 2, label: 'Next', disabled: (await this.getCurrent()) ? false : true },
          { type: 2, custom_id: 'media-showqueue', style:1, label:'Show Queue' },
          // { type: 2, custom_id: '', style: 2, label: '', disabled: false },
        ],
      },
    ];
    return fresh ? { embeds: [embed], components: buttons, files: [thumb] } as InteractionReplyOptions : { embeds: [embed], components: buttons } as InteractionReplyOptions;
  }

  async queueEmbed(messagetitle = 'Current Queue:', page?:number | undefined, fresh = true):Promise<InteractionUpdateOptions | InteractionReplyOptions> {
    const track = await this.getCurrent();
    const queue = await this.getQueue();
    page = Math.abs(page!) || Math.ceil((await this.getPlayhead() + 1) / 10);
    const albumart = (fresh && track) ? new AttachmentBuilder((track.goose.track.art), { name:'art.jpg' }) : (new AttachmentBuilder(utils.pickPride('dab') as string, { name:'art.jpg' }));
    const pages = Math.ceil(queue.length / 10);
    const buttonEmbed = [
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'queue-refresh', style:2, label:'Refresh' },
          { type: 2, custom_id: 'queue-prev', style:1, label:'Previous', disabled: (page === 1) ? true : false },
          { type: 2, custom_id: 'queue-home', style:2, label:'Home', disabled: (page === Math.ceil((await this.getPlayhead() + 1) / 10)) ? true : false },
          { type: 2, custom_id: 'queue-next', style:1, label:'Next', disabled: (page === pages) ? true : false },
        ],
      },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'queue-loop', style:(await this.getLoop()) ? 4 : 3, label:(await this.getLoop()) ? 'Disable loop' : 'Enable loop' },
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
      const dbtrack = await db.getTrack({ 'goose.id':queuePart[i].goose.id }) as Track;
      let songName = dbtrack.goose.track.name;
      if (songName.length > 250) { songName = songName.slice(0, 250).concat('...'); }
      const part = `**${songNum}.** ${((songNum - 1) == await this.getPlayhead()) ? '**' : ''}${(dbtrack.goose.artist.name || ' ')} - [${songName}](${dbtrack.youtube[0].url}) - ${utils.timeDisplay(dbtrack.youtube[0].duration)}${((songNum - 1) == await this.getPlayhead()) ? '**' : ''} \n`;
      queueStr = queueStr.concat(part);
    }
    let queueTime = 0;
    for (const item of queue) { queueTime = queueTime + Number(item.goose.track.duration); }
    // let elapsedTime = (!track || !track.status?.start) ? 0 : (this.getPause()) ? (track.status.pause! - track.status.start) : ((Date.now() / 1000) - track.status.start);
    let elapsedTime:number = (await this.getPause() ? (track?.status?.pause! - track?.status?.start!) : ((Date.now() / 1000) - track?.status?.start!)) || 0;
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
      description: `**${await this.getPause() ? 'Paused:' : 'Now Playing:'}** \n ${(track) ? `**${await this.getPlayhead() + 1}. **${(track.goose.artist.name || ' ')} - [${(track.goose.track.name)}](${track.youtube[0].url}) - ${utils.timeDisplay(track.youtube[0].duration)}\n[Support this artist!](${track.goose.artist.official})` : 'Nothing is playing.'}\n\n**Queue:** \n${queueStr}`,
      fields: [
        { name: '\u200b', value: `Loop: ${await this.getLoop() ? '🟢' : '🟥'}`, inline: true },
        { name: '\u200b', value: `Page ${page} of ${pages}`, inline: true },
        { name: '\u200b', value: `${queue.length} tracks`, inline: true },
        { name: `\` ${utils.progressBar(45, queueTime, elapsedTime, bar)} \``, value: `${await this.getPause() ? 'Paused:' : 'Elapsed:'} ${utils.timeDisplay(elapsedTime)} | Total: ${utils.timeDisplay(queueTime)}` },
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
        await interaction.editReply({ embeds: embeds, components: components });
        break;
      }
      case 'media': {
        logDebug('decommission media');
        embeds[0].footer = { text: message };
        for (const button of components[0].components) { button.style = 2; }
        components[0].components[2].label = (await this.getPause()) ? 'Play' : 'Pause';
        components[0].components[0].style = 3;
        await interaction.editReply({ embeds: embeds, components: components });
        break;
      }

      default: {
        break;
      }
    }
  }

  async register(interaction: CommandInteraction & { message?: Message<boolean> } | ButtonInteraction, type: 'queue'|'media', embed:InteractionUpdateOptions | InteractionReplyOptions) {
    const id = interaction.member!.user.id;
    if (!this.embeds[id]) { this.embeds[id] = {}; }

    const name = interaction.member!.user.username;

    switch (type) {
      case 'queue': {
        const match = (embed.embeds![0] as APIEmbed).fields![1]?.value.match(embedPage);
        if (this.embeds[id].queue) {
          this.embeds[id].queue!.idleTimer.refresh();
          this.embeds[id].queue!.refreshTimer.refresh();
          this.embeds[id].queue!.refreshCount = 0;
          this.embeds[id].queue!.userPage = Number(match![1]);
          this.embeds[id].queue!.followPlayhead = (Number(match![1]) == Math.ceil((await this.getPlayhead() + 1) / 10));
          if (this.embeds[id].queue!.interaction!.message!.id != interaction.message?.id) {
            const temp = this.embeds[id].queue!.interaction!;
            this.embeds[id].queue!.interaction = undefined;
            (async () => this.decommission(temp, type, embed))();
          }
          this.embeds[id].queue!.interaction = interaction;
        } else {
          this.embeds[id].queue = {
            userPage : Number(match![1]),
            followPlayhead : (Number(match![1]) == Math.ceil((await this.getPlayhead() + 1) / 10)),
            refreshCount: 0,
            interaction: interaction,
            idleTimer: setTimeout(async () => {
              clearInterval(this.embeds[id].queue!.refreshTimer);
              await this.decommission(this.embeds[id].queue!.interaction!, 'queue', await this.queueEmbed(undefined, undefined, false));
              delete this.embeds[id].queue;
              if (!Object.keys(this.embeds[id]).length) { delete this.embeds[id]; }
            }, 870000).unref(),
            refreshTimer: setInterval(async () => {
              this.embeds[id].queue!.refreshCount++;
              this.embeds[id].queue!.update(id, 'interval');
            }, 15000).unref(),
            getPage: async () => {
              if (this.embeds[id].queue!.followPlayhead || this.embeds[id].queue!.refreshCount > 2) {
                this.embeds[id].queue!.userPage = Math.ceil((await this.getPlayhead() + 1) / 10);
                this.embeds[id].queue!.refreshCount = 0;
                this.embeds[id].queue!.followPlayhead = true;
              }
              return (this.embeds[id].queue!.userPage);
            },
            update: async (userId:string, description:string, content?:InteractionUpdateOptions | InteractionReplyOptions) => {
              logDebug(`${name} queue: ${description}`);
              const contentPage = (content) ? (content.embeds![0] as APIEmbed)?.fields?.[1]?.value?.match(embedPage) : null;
              const differentPage = (contentPage) ? !(Number(contentPage[1]) === await this.embeds[id].queue!.getPage()) : null;
              if (!content || differentPage) { content = await this.queueEmbed('Current Queue:', await this.embeds[id].queue!.getPage(), false); }
              const { embeds, components, files } = content!;
              if (!this.embeds[userId].queue!.interaction!.replied && files) {
                this.embeds[userId].queue!.interaction!.message = await this.embeds[userId].queue!.interaction!.editReply({ embeds: embeds, components: components, files: files });
              } else { this.embeds[userId].queue!.interaction!.message = await this.embeds[userId].queue!.interaction!.editReply({ embeds: embeds, components: components }); }
            },
          };
        }
        break;
      }

      case 'media': {
        if (this.embeds[id].media) {
          this.embeds[id].media!.idleTimer.refresh();
          this.embeds[id].media!.refreshTimer.refresh();
          if (this.embeds[id].media!.interaction!.message!.id != interaction.message?.id) {
            const temp = this.embeds[id].media!.interaction!;
            this.embeds[id].media!.interaction = undefined;
            (async () => this.decommission(temp, type, embed))();
          }
          this.embeds[id].media!.interaction = interaction;
        } else {
          this.embeds[id].media = {
            interaction: interaction,
            idleTimer: setTimeout(async () => {
              clearInterval(this.embeds[id].media!.refreshTimer);
              await this.decommission(this.embeds[id].media!.interaction!, 'media', await this.mediaEmbed(false));
              delete this.embeds[id].media;
              if (!Object.keys(this.embeds[id]).length) { delete this.embeds[id]; }
            }, 870000).unref(),
            refreshTimer: setInterval(() => {
              this.embeds[id].media!.update(id, 'interval');
            }, 15000).unref(),
            update: async (userId:string, description:string, content?:InteractionUpdateOptions | InteractionReplyOptions) => {
              content ||= await this.mediaEmbed(false);
              logDebug(`${name} media: ${description}`);
              const { embeds, components, files } = content!;
              if (!this.embeds[userId].media!.interaction!.replied && files) {
                this.embeds[userId].media!.interaction!.message = await this.embeds[userId].media!.interaction!.editReply({ embeds: embeds, components: components, files: files });
              } else { this.embeds[userId].media!.interaction!.message = await this.embeds[userId].media!.interaction!.editReply({ embeds: embeds, components: components }); }
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
    switch (type) {
      case 'queue': { // strip non-false parameter thing
        Object.keys(this.embeds).map(async (id) => {
          this.embeds[id]?.queue?.update(id, 'sync', queueEmbed);
        });
        break;
      }
      case 'media': {
        Object.keys(this.embeds).map(async (id) => {
          const { queue, media } = this.embeds[id];
          await Promise.all([queue?.update(id, 'sync', queueEmbed), media?.update(id, 'sync', mediaEmbed)]);
        });
        break;
      }
      default: {
        logDebug(`player sync—bad case: ${type}`);
        break;
      }
    }
    if (functions.web) { (await import('./webserver.js')).sendWebUpdate('player', await this.getStatus()); }
  }

  async webSync(type: 'queue'|'media') {
    if (functions.web) { (await import('./webserver.js')).sendWebUpdate('player', await this.getStatus()); }
    const keys = Object.keys(this.embeds);
    if (keys.length) {
      logDebug('have embeds');
      switch (type) {
        case 'queue': {
          const queueEmbed = await this.queueEmbed(undefined, undefined, false);
          keys.map(async (id) => {
            this.embeds[id]?.queue?.update(id, 'web sync', queueEmbed);
          });
          break;
        }
        case 'media': {
          const mediaEmbed = await this.mediaEmbed(false);
          const queueEmbed = await this.queueEmbed(undefined, undefined, false);
          keys.map(async (id) => {
            this.embeds[id]?.queue?.update(id, 'web sync', queueEmbed);
            this.embeds[id]?.media?.update(id, 'web sync', mediaEmbed);
          });
          break;
        }
        default: {
          logDebug(`web sync—bad case: ${type}`);
        }
      }
    } else { logDebug('no embeds'); }
  }
}