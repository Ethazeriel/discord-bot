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
import { ChatInputCommandInteraction, GuildMemberRoleManager, InteractionUpdateOptions, InteractionReplyOptions } from 'discord.js';
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
    await interaction.editReply({ content: 'Search can\'t be blank.' });
    return;
  }
  if (when !== 'last' && when !== 'next' && when !== 'now') { // should we be checking for other bad data?
    log('error', [`/play—bad when ${when}. user ${interaction.user.username}#${interaction.user.discriminator} with what ${what} and search ${search}`]);
    interaction.editReply({ content: 'OH NO SOMETHING\'S FUCKED' });
    return;
  }

  const { player, message } = await Player.getPlayer(interaction);

  if (!player) {
    interaction.editReply({ content: message });
    return;
  }

  let UUID = '';
  let length = 0; // queue length, for embed, only used when === 'last'
  let getTracks:Promise<Track[]>;
  const playlist = (what === 'playlist');
  const internal = playlist && !(spotifyPattern.test(search) || youtubePattern.test(search));

  if (playlist && !internal) { // if resource is external, educate user and handle as external
    await interaction.followUp({ content: 'Searching as external resource. Playlist flag is for internal playlists, not external resources. See `/help`.', ephemeral: true });
  }

  if (internal) { // internal playlist
    search.replace(sanitizePlaylists, '');
    getTracks = database.getPlaylist(search);
  } else { // external resources
    getTracks = fetch(search, interaction.id);
    let queueEmbed;
    if (when === 'now' || when === 'next') {
      ({ UUID } = player.pendingNext(interaction.user.username));
      queueEmbed = await player.queueEmbed('Pending:', Math.ceil((player.getPlayhead() + 2) / 10));
    } else {
      ({ UUID, length } = player.pendingLast(interaction.user.username));
      queueEmbed = await player.queueEmbed('Pending:', (Math.ceil((length / 10) || 1)));
    }
    await player.sync(interaction, 'queue', queueEmbed);
  }

  let tracks = await getTracks.catch(async (error:Error) => {
    log('error', [`play—${internal ? 'db' : 'fetch'} error, ${error.stack}`]);
    await interaction.editReply({ content: (internal) ? 'OH NO SOMETHING\'S FUCKED' : 'either that\'s a private playlist or SOMETHING\'S FUCKED' });
    if (!internal) { // only external resources exist as pending tracks
      const removed = player.removebyUUID(UUID);
      if (!removed.length) { logDebug(`failed to find/ UUID ${UUID} already removed`); }
    }
    return undefined;
  });
  if (!tracks) { return; }

  if (tracks.length === 0) {
    if (internal) {
      logDebug('error', [`No playlist exists by name '${search}'`]);
      await interaction.editReply({ content: `No internal playlist exists by name '${search}'. See \`/playlist list\` or \`/playlist help\`.` });
      return;
    }
    logDebug('error', [`No result for search '${search}'`]);
    await interaction.editReply({ content: `No result for '${search}'. Either be more specific or directly link a spotify/youtube resource.` });
    return;
  }

  if (shuffle !== 'no') {
    if (tracks.length > 1) {
      tracks = player.shuffle({ albumAware: (shuffle === 'albums') }, tracks) as Track[];
    } else { await interaction.followUp({ content: '`/play shuffle` is to shuffle each `/play` before it\'s added; to shuffle the queue, see `/queue shuffle`', ephemeral: true }); }
  }
  if (ephemeral === 'yes') {
    for (const track of tracks) {
      track.status.ephemeral = true;
    }
  }

  // only external resources exist as pending tracks
  if (!internal) {
    const success = player.replacePending(tracks, UUID);
    if (!success) { // to do: remove this if we decide that pending tracks should not be removeable
      logDebug(`failed to replace UUID ${UUID}, probably deleted`);
      await interaction.editReply({ content:'either you/someone removed your pending track before it resolved or SOMETHING\'S FUCKED' });
      return;
    }
  }

  const current = player.getCurrent();
  //                [if current will change                   ] or just changed (pending and was just replaced)
  const mediaSync = (when === 'now' || current === undefined || !internal && current.goose.UUID === UUID);
  let queueEmbed:undefined | InteractionReplyOptions | InteractionUpdateOptions = undefined;
  let messageWithoutContext = '';

  switch (when) {
    case 'now': {
      let moved = false;
      if (internal) {
        player.queueNow(tracks); // handles calling play or next
      } else {
        const nextUp = player.getNext();
        if (nextUp && nextUp.goose.UUID === UUID) { // typical
          logDebug('pending now, typical');
          player.next();
        } else if (current && current.goose.UUID === UUID) { /* replacePending handled this */
          // empty or ended queue or player status idle->next before replace; anything that could make this true should be calling play, have
          logDebug('pending now, queue empty/ended or something\'s wrong'); // skipped pending and be idle; and replace will have called play
        } else {
          moved = true;
          logDebug(`pending now, UUID ${UUID} not next or current`);
          await interaction.followUp({ content: 'you/someone rearranged the queue. use `/queue jump` if you still want them to play now', ephemeral: true });
        }
      }
      const position = moved ? player.getIndex(UUID) : player.getPlayhead();
      messageWithoutContext = moved ? `Queued at position ${position}:` : 'Playing now:';
      queueEmbed = await player.queueEmbed(moved ? 'Queued:' : messageWithoutContext, Math.ceil((position + 1) / 10));
      break;
    }
    case 'next': {
      if (internal) {
        player.queueNext(tracks);
      } else { /* replacePending handled this */ }
      messageWithoutContext = 'Playing next:';
      queueEmbed = await player.queueEmbed(messageWithoutContext, Math.ceil((player.getPlayhead() + 2) / 10));
      break;
    }
    case 'last': {
      if (internal) { // when !internal, length was assigned by call to pendingLast
        length = player.queueLast(tracks) - (tracks.length - 1);
      } else { /* replacePending handled this */ } // and pendingLast assigned length
      messageWithoutContext = `Queued at position ${length}:`;
      queueEmbed = await player.queueEmbed('Queued:', (Math.ceil(length / 10) || 1));
      break;
    }
  }

  const mediaEmbed = mediaSync ? await player.mediaEmbed() : undefined;
  if (tracks.length === 1) {
    await interaction.editReply(await utils.generateTrackEmbed(tracks[0], messageWithoutContext));
    player.sync(interaction, mediaSync ? 'media' : 'queue', queueEmbed, mediaEmbed);
  } else {
    await player.register(interaction, 'queue', queueEmbed);
    player.sync(interaction, mediaSync ? 'media' : 'queue', queueEmbed, mediaEmbed);
  }
}