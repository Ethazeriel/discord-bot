const { SlashCommandBuilder } = require('@discordjs/builders');
const { logLine } = require('../logger.js');
const { sanitize } = require('../regexes.js');
const database = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('administrative functions')
    .addSubcommand(subcommand => subcommand
      .setName('removeplaylist')
      .setDescription('Gets the current track')
      .addStringOption(option =>
        option.setName('playlist').setDescription('Name of the playlist to remove').setRequired(true))),


  async execute(interaction) {
    logLine('command',
      ['Recieved command from ',
        interaction.member.displayName,
        'with name ',
        interaction.commandName,
        'subcommand ',
        interaction.options.getSubcommand()]);

    if (interaction.member.roles.cache.some(role => role.name === 'Admin')) {
      await interaction.deferReply({ ephemeral: true });
      switch (interaction.options.getSubcommand()) {

      case 'removeplaylist': {
        const listname = interaction.options.getString('playlist')?.replace(sanitize, '');
        const result = await database.removePlaylist(listname);
        interaction.followUp({ content:`Removed ${listname} from the database; ${result} tracks.`, ephemeral: true });
        break;
      }


      default: {
        logLine('error', ['OH NO SOMETHING\'S FUCKED']);
        await interaction.followUp({ content:'Something broke. Please try again', ephemeral: true });
      }

      }
    } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
  },

};