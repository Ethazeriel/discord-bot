import { SlashCommandBuilder } from '@discordjs/builders';
import { logLine } from '../../logger.js';
import { sanitize, youtubePattern, sanitizePlaylists } from '../../regexes.js';
import * as database from '../../database.js';


export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('administrative functions')
  .addSubcommand(subcommand => subcommand
    .setName('removeplaylist')
    .setDescription('Removes a playlist from the DB')
    .addStringOption(option =>
      option.setName('playlist').setDescription('Name of the playlist to remove').setRequired(true)))
  .addSubcommand(subcommand => subcommand
    .setName('removetrack')
    .setDescription('Removes a track from the DB')
    .addStringOption(option =>
      option.setName('track').setDescription('youtube url of the track to remove').setRequired(true)));


export async function execute(interaction) {

  if (interaction.member?.roles?.cache?.some(role => role.name === 'Admin')) {
    await interaction.deferReply({ ephemeral: true });
    switch (interaction.options.getSubcommand()) {

      case 'removeplaylist': {
        const listname = interaction.options.getString('playlist')?.replace(sanitizePlaylists, '')?.trim();
        const result = await database.removePlaylist(listname);
        interaction.followUp({ content:`Removed ${listname} from the database; ${result} tracks.`, ephemeral: true });
        break;
      }

      case 'removetrack': {
        const track = interaction.options.getString('track')?.replace(sanitize, '')?.trim();
        if (youtubePattern.test(track)) {
          const match = track.match(youtubePattern);
          const result = await database.removeTrack(match[2]);
          interaction.followUp({ content:`Removed ${track} from the database; ${result} tracks.`, ephemeral: true });
        } else { await interaction.followUp({ content:'Invalid track URL', ephemeral: true });}
        break;
      }


      default: {
        logLine('error', ['OH NO SOMETHING\'S FUCKED']);
        await interaction.followUp({ content:'Something broke. Please try again', ephemeral: true });
      }

    }
  } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
}
