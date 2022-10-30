import { SlashCommandBuilder } from '@discordjs/builders';
import Player from '../../player.js';
import * as utils from '../../utils.js';
import { log } from '../../logger.js';
import * as database from '../../database.js';
import fetch from '../../acquire.js';
import { youtubePattern, spotifyPattern, sanitize, sanitizePlaylists } from '../../regexes.js';
import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import { ChatInputCommandInteraction, GuildMemberRoleManager } from 'discord.js';
const { discord } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));
const roles = discord.roles;


// const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

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


  if ((interaction.member?.roles as GuildMemberRoleManager)?.cache?.some(role => role.name === roles.dj)) {
    await interaction.deferReply({ ephemeral: true });

    if (!search) {
      await interaction.followUp({ content: 'Search can\'t be blank.' });
      return;
    }

    const player = await Player.getPlayer(interaction);
    if (player) {
      let tracks = null;
      if (what === 'playlist') {
        if ((spotifyPattern.test(search) || youtubePattern.test(search))) {
          await interaction.followUp({ content: 'Playlist flag is for internal playlists, not external resources. See /help play or /help playlist for usage and interrelationship' });
        } else {
          search.replace(sanitizePlaylists, '');
          tracks = await database.getPlaylist(search);
          if (tracks.length == 0) {
            log('error', [`No playlist exists by name '${search}'`]);
            await interaction.followUp({ content: `No internal playlist exists by name '${search}'. See /playlist list or /playlist help.` });
          }
        }
      } else {
        try {
          tracks = await fetch(search, interaction.id);
          if (!tracks || tracks.length == 0) {
            await interaction.followUp({ content: `No result for '${search}'. Either be more specific or directly link a spotify/youtube resource.` });
          }
        } catch (error:any) {
          await interaction.followUp({ content: `OH NO SOMETHING'S FUCKED. Error: ${error.message}` });
        }
      }

      if (tracks && tracks.length > 0) {
        if (tracks.length > 1 && (shuffle !== 'no')) {
          tracks = player.shuffle({ albumAware: (shuffle === 'albums') }, tracks);
        }

        if (ephemeral === 'yes') {
          // console.log('ephemeral');
          for (const track of tracks) {
            track.ephemeral = true;
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
              await Promise.all([player.register(interaction, 'queue', queueEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
            }
            break;
          }
          case 'next': {
            await player.queueNext(tracks);
            const queueEmbed = await player.queueEmbed('Playing next:', Math.ceil((player.getPlayhead() + 2) / 10));
            if (tracks.length == 1) {
              await interaction.editReply(await utils.generateTrackEmbed(tracks[0], 'Playing Next: '));
              player.sync(interaction, 'queue', queueEmbed);
            } else {
              await Promise.all([player.register(interaction, 'queue', queueEmbed), player.sync(interaction, 'queue', queueEmbed)]);
            }
            break;
          }
          case 'last': {
            const length = await player.queueLast(tracks);
            const queueEmbed = await player.queueEmbed('Queued: ', (Math.ceil((length - (tracks.length - 1)) / 10) || 1));
            if (tracks.length == 1) {
              await interaction.editReply(await utils.generateTrackEmbed(tracks[0], `Queued at position ${length}:`));
              player.sync(interaction, 'queue', queueEmbed);
            } else {
              await Promise.all([player.register(interaction, 'queue', queueEmbed), player.sync(interaction, 'queue', queueEmbed)]);
            }
            break;
          }
          default: {
            log('error', ['OH NO SOMETHING\'S FUCKED']);
            await interaction.followUp({ content:'Something broke. Please try again', ephemeral: true });
          }
        }
      }
    }
  } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
}