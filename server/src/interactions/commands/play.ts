import { SlashCommandBuilder } from '@discordjs/builders';
import Player from '../../player.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as utils from '../../utils.js';
import { log, logDebug } from '../../logger.js';
import * as database from '../../database.js';
import fetch from '../../acquire.js';
import { youtubePattern, spotifyPattern, sanitize, sanitizePlaylists } from '../../regexes.js';
import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import { ChatInputCommandInteraction, GuildMemberRoleManager } from 'discord.js';
const { discord } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));
const roles = discord.roles;

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play something!')
  .addStringOption(option =>
    option.setName('search').setDescription('search term/youtube url/spotify uri/playlist name').setRequired(true))
  .addStringOption(option =>
    option.setName('when').setDescription('Where in the queue should this go?')
      .addChoices({ name:'Play Last', value:'last' },
        { name:'Play Next', value:'next' },
        { name:'Play Now', value:'now' }))
  .addStringOption(option =>
    option.setName('what').setDescription('Flag as internal playlist, not external search')
      .addChoices({ name:'External Search', value:'search' },
        { name:'Internal bot playlist', value:'playlist' }))
  .addStringOption(option =>
    option.setName('shuffle').setDescription('Shuffle?')
      .addChoices({ name:'No', value:'no' }, { name:'Yes', value:'tracks' }, { name:'Yes, but keep albums in order', value:'albums' }))
  .addStringOption(option =>
    option.setName('ephemeral').setDescription('Should this remain in the queue after it plays (ie. be loopable)?')
      .addChoices({ name:'No', value:'no' }, { name:'Yes', value:'yes' }));

export async function execute(interaction:ChatInputCommandInteraction) {
  const search = interaction.options.getString('search')?.replace(sanitize, '')?.trim();
  const when = interaction.options.getString('when') || 'last';
  const what = interaction.options.getString('what') || 'search';
  const shuffle = interaction.options.getString('shuffle') || 'no';
  const ephemeral = interaction.options.getString('ephemeral') || 'no';


  if (!((interaction.member?.roles as GuildMemberRoleManager)?.cache?.some(role => role.name === roles.dj))) {
    await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  if (!search) {
    await interaction.followUp({ content: 'Search can\'t be blank.' });
    return;
  }

  const player = await Player.getPlayer(interaction);
  if (!player) { return; }

  const playlist = (what === 'playlist');
  const external = (playlist && (spotifyPattern.test(search) || youtubePattern.test(search)));

  if (external) { // is spotify/ youtube resource, fall through to else
    await interaction.followUp({ content: 'Playlist flag is for internal playlists, not external resources. See /help. Searching as external resource.' });
  } else if (playlist && !external) { // internal playlist
    search.replace(sanitizePlaylists, '');
    let tracks:Track[] = await database.getPlaylist(search);
    if (tracks.length == 0) {
      log('error', [`No playlist exists by name '${search}'`]);
      await interaction.followUp({ content: `No internal playlist exists by name '${search}'. See /playlist list or /playlist help.` });
      return;
    } else if (tracks.length > 1 && (shuffle !== 'no')) {
      tracks = player.shuffle({ albumAware: (shuffle === 'albums') }, tracks) as Track[];
    }
    if (ephemeral === 'yes') {
      // console.log('ephemeral');
      for (const track of tracks) {
        track.status.ephemeral = true;
      }
    }
    switch (when) {
      case 'now': {
        await player.queueNow(tracks);
        const mediaEmbed = await player.mediaEmbed();
        const queueEmbed = await player.queueEmbed('Playing now:', Math.ceil((player.getPlayhead() + 1) / 10));
        if (tracks.length == 1) {
          await interaction.followUp(await utils.generateTrackEmbed(tracks[0], 'Playing Now: '));
          player.sync(interaction, 'media', queueEmbed, mediaEmbed);
        } else {
          await player.register(interaction, 'queue', queueEmbed);
          await player.sync(interaction, 'media', queueEmbed, mediaEmbed);
        }
        return;
      }
      case 'next': {
        await player.queueNext(tracks);
        const queueEmbed = await player.queueEmbed('Playing next:', Math.ceil((player.getPlayhead() + 2) / 10));
        if (tracks.length == 1) {
          await interaction.editReply(await utils.generateTrackEmbed(tracks[0], 'Playing Next: '));
          player.sync(interaction, 'queue', queueEmbed);
        } else {
          await player.register(interaction, 'queue', queueEmbed);
          await player.sync(interaction, 'queue', queueEmbed);
        }
        return;
      }
      case 'last': {
        const length = await player.queueLast(tracks);
        const queueEmbed = await player.queueEmbed('Queued: ', (Math.ceil((length - (tracks.length - 1)) / 10) || 1));
        if (tracks.length == 1) {
          await interaction.editReply(await utils.generateTrackEmbed(tracks[0], `Queued at position ${length}:`));
          player.sync(interaction, 'queue', queueEmbed);
        } else {
          await player.register(interaction, 'queue', queueEmbed);
          await player.sync(interaction, 'queue', queueEmbed);
        }
        return;
      }
      default: {
        log('error', [`play bad case—when ${when}, for what ${what}`]);
        await interaction.followUp({ content:'OH NO SOMETHING\'S FUCKED. Please try again', ephemeral: true });
        return;
      }
    }
  } else { // external resources
    let UUID:string;
    let length = 0; // look I'm not happy about this either
    switch (when) {
      case 'now': {
        ({ UUID } = player.pendingNext(interaction.user.username));
        const queueEmbed = await player.queueEmbed('Playing now:', Math.ceil((player.getPlayhead() + 2) / 10)); // using the 2 from below
        await player.register(interaction, 'queue', queueEmbed);
        await player.sync(interaction, 'media', queueEmbed);
        break;
      }
      case 'next': {
        ({ UUID } = player.pendingNext(interaction.user.username));
        const queueEmbed = await player.queueEmbed('Playing next:', Math.ceil((player.getPlayhead() + 2) / 10)); // to do: is 2 right?
        await player.register(interaction, 'queue', queueEmbed);
        await player.sync(interaction, 'queue', queueEmbed);
        break;
      }
      case 'last': {
        ({ UUID, length } = player.pendingLast(interaction.user.username));
        const queueEmbed = await player.queueEmbed('Queued: ', (Math.ceil((length / 10) || 1)));
        await player.register(interaction, 'queue', queueEmbed);
        await player.sync(interaction, 'queue', queueEmbed);
        break;
      }
      default: {
        log('error', [`play default case—when ${when}, for what ${what}`]);
        await interaction.followUp({ content:'OH NO SOMETHING\'S FUCKED. Please try again', ephemeral: true });
        return;
      }
    }
    let tracks: Track[] = [];
    try {
      tracks = await fetch(search, interaction.id);
      if (tracks.length == 0) {
        await interaction.followUp({ content: `No result for '${search}'. Either be more specific or directly link a spotify/youtube resource.` });
        return;
      } else if (tracks.length > 1 && (shuffle !== 'no')) {
        tracks = player.shuffle({ albumAware: (shuffle === 'albums') }, tracks) as Track[];
      }
      if (ephemeral === 'yes') {
        // console.log('ephemeral');
        for (const track of tracks) {
          track.status.ephemeral = true;
        }
      }
    } catch (error:any) {
      log('error', [`play—fetch error, ${error.stack}`]);
      await interaction.followUp({ content: 'OH NO SOMETHING\'S FUCKED.' });
      const removed = await player.removebyUUID(UUID);
      if (!removed.length) { logDebug(`failed to find/ UUID ${UUID} already removed`); }
      return;
    }

    let success = false;
    switch (when) {
      case 'now': { // wish I had a better idea than this special casing, but at least now might handle concurrency
        const nextUp = player.getNext();
        const current = player.getCurrent();
        if (nextUp && nextUp.goose.UUID === UUID) { // expected
          logDebug('play now, expected');
          success = await player.replacePending(tracks, UUID);
          if (!success) { break; }
          await player.next();
        } else if (current && current.goose.UUID === UUID) { // empty queue or player status idle->next before replace
          logDebug('play now, empty queue/ idle. probably'); // anything that could make this current should call play,
          success = await player.replacePending(tracks, UUID); // skip pending, and be idle. replace restarts when idle
          if (!success) { break; }
        } else {
          logDebug(`play now, UUID ${UUID} not next or current; concurrency issues`); // decided against finding by UUID
          await interaction.followUp({ content: 'either we\'ve fucked up or you/someone in your channel modified the queue in the tiny amount of time before this request went through' });
          return;
        }
        const mediaEmbed = await player.mediaEmbed();
        const queueEmbed = await player.queueEmbed('Playing now:', Math.ceil((player.getPlayhead() + 1) / 10));
        if (tracks.length == 1) {
          await interaction.followUp(await utils.generateTrackEmbed(tracks[0], 'Playing Now: '));
          player.sync(interaction, 'media', queueEmbed, mediaEmbed);
        } else {
          player.register(interaction, 'queue', queueEmbed);
          player.sync(interaction, 'media', queueEmbed, mediaEmbed);
        }
        return;
      }
      case 'next': {
        success = await player.replacePending(tracks, UUID);
        if (!success) { break; }
        const queueEmbed = await player.queueEmbed('Playing next:', Math.ceil((player.getPlayhead() + 2) / 10));
        if (tracks.length == 1) {
          await interaction.editReply(await utils.generateTrackEmbed(tracks[0], 'Playing Next: '));
          player.sync(interaction, 'queue', queueEmbed);
        } else {
          await player.register(interaction, 'queue', queueEmbed);
          await player.sync(interaction, 'queue', queueEmbed);
        }
        return;
      }
      case 'last': {
        success = await player.replacePending(tracks, UUID);
        if (!success) { break; }
        const queueEmbed = await player.queueEmbed('Queued: ', (Math.ceil((length - (tracks.length - 1)) / 10) || 1));
        if (tracks.length == 1) {
          await interaction.editReply(await utils.generateTrackEmbed(tracks[0], `Queued at position ${length}:`));
          player.sync(interaction, 'queue', queueEmbed);
        } else {
          await player.register(interaction, 'queue', queueEmbed);
          await player.sync(interaction, 'queue', queueEmbed);
        }
        return;
      }
      default: {
        log('error', [`play default case—when ${when}, for what ${what}`]);
        await interaction.followUp({ content:'OH NO SOMETHING\'S FUCKED. Please try again', ephemeral: true });
        return;
      }
    }
    if (!success) {
      logDebug(`failed to replace UUID ${UUID}, probably deleted`);
      await interaction.followUp({ content:'either we\'ve fucked up, or you/someone in the tiny amount of time before this request went through', ephemeral: true });
    }
  }
}