import { SlashCommandBuilder } from '@discordjs/builders';
import { log } from '../../logger.js';
import { sanitize, youtubePattern, sanitizePlaylists } from '../../regexes.js';
import * as database from '../../database.js';
import validator from 'validator';
import fs from 'fs';
import type { ChatInputCommandInteraction, GuildMemberRoleManager } from 'discord.js';
import { fileURLToPath } from 'url';
const { discord } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));
const roles = discord.roles;


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


export async function execute(interaction:ChatInputCommandInteraction) {

  if ((interaction.member?.roles as GuildMemberRoleManager)?.cache?.some(role => role.name === roles.admin)) {
    await interaction.deferReply({ ephemeral: true });
    switch (interaction.options.getSubcommand()) {

      case 'removeplaylist': {
        const listname = validator.escape(validator.stripLow(interaction.options.getString('playlist')?.replace(sanitizePlaylists, '') || ''))?.trim();
        const result = await database.removePlaylist(listname);
        interaction.followUp({ content:`Removed ${listname} from the database; ${result} tracks.`, ephemeral: true });
        break;
      }

      case 'removetrack': {
        const track = interaction.options.getString('track')?.replace(sanitize, '')?.trim() || '';
        if (youtubePattern.test(track)) {
          const match = track.match(youtubePattern);
          const result = await database.removeTrack(match![2]);
          interaction.followUp({ content:`Removed ${track} from the database; ${result} tracks.`, ephemeral: true });
        } else { await interaction.followUp({ content:'Invalid track URL', ephemeral: true });}
        break;
      }


      default: {
        log('error', ['OH NO SOMETHING\'S FUCKED']);
        await interaction.followUp({ content:'Something broke. Please try again', ephemeral: true });
      }

    }
  } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
}
