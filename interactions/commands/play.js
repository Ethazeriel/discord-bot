import { SlashCommandBuilder } from '@discordjs/builders';
import Player from '../../player.js';
import * as utils from '../../utils.js';
import { logLine } from '../../logger.js';
import * as database from '../../database.js';
import fetch from '../../acquire.js';
import { youtubePattern, spotifyPattern, sanitize, sanitizePlaylists } from '../../regexes.js';

// const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play something!')
  .addStringOption(option =>
    option.setName('search').setDescription('search term/youtube url/spotify uri/playlist name').setRequired(true))
  .addStringOption(option =>
    option.setName('when').setDescription('Where in the queue should this go?')
      .addChoice('Play Last', 'last')
      .addChoice('Play Next', 'next')
      .addChoice('Play Now', 'now'))
  .addStringOption(option =>
    option.setName('what').setDescription('Flag as internal playlist, not external search')
      .addChoice('External Search', 'search')
      .addChoice('Internal bot playlist', 'playlist'));

export async function execute(interaction) {
  const search = interaction.options.getString('search')?.replace(sanitize, '');
  const when = interaction.options.getString('when') || 'last';
  const what = interaction.options.getString('what') || null;


  if (interaction.member?.roles?.cache?.some(role => role.name === 'DJ')) {
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
            logLine('error', [`No playlist exists by name '${search}'`]);
            await interaction.followUp({ content: `No internal playlist exists by name '${search}'. See /playlist list or /playlist help.` });
          }
        }
      } else {
        try {
          tracks = await fetch(search);
          if (!tracks || tracks.length == 0) {
            await interaction.followUp({ content: `No result for '${search}'. Either be more specific or directly link a spotify/youtube resource.` });
          }
        } catch (error) {
          await interaction.followUp({ content: `OH NO SOMETHING'S FUCKED. Error: ${error.message}` });
        }
      }

      if (tracks && tracks.length > 0) {
        switch (when) {
          case 'now': {
            await player.queueNow(tracks);
            if (tracks.length == 1) {
              const message = await utils.generateTrackEmbed(tracks[0], 'Playing Now: ');
              await interaction.followUp(message);
            } else {
              const message = await player.queueEmbed('Playing Now: ', 1);
              await interaction.followUp(message);
            }
            break;
          }
          case 'next': {
            await player.queueNext(tracks);
            // await sleep(500);
            if (tracks.length == 1) {
              const message = await utils.generateTrackEmbed(tracks[0], 'Playing Next: ');
              await interaction.followUp(message);
            } else {
              const message = await player.queueEmbed('Playing Next: ', 1);
              await interaction.followUp(message);
            }
            break;
          }
          case 'last': {
            const length = await player.queueLast(tracks);
            if (tracks.length == 1) {
              const message = await utils.generateTrackEmbed(tracks[0], `Queued at position ${length}:`);
              await interaction.followUp(message);
            } else {
              // await sleep(500);
              const message = await player.queueEmbed('Queued: ', (Math.ceil((length - (tracks.length - 1)) / 10) || 1));
              await interaction.followUp(message);
            }
            break;
          }
          default: {
            logLine('error', ['OH NO SOMETHING\'S FUCKED']);
            await interaction.followUp({ content:'Something broke. Please try again', ephemeral: true });
          }
        }
      }
    }
  } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
}