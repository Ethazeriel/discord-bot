const { SlashCommandBuilder } = require('@discordjs/builders');
const Player = require('../../player.js');
const utils = require('../../utils.js');
const { fetch } = require('../../acquire.js');

const { logLine, logDebug } = require('../../logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('test')
    .addStringOption(option =>
      option.setName('command').setDescription('command').setRequired(true)),

  async execute(interaction) {
    if (interaction.member?.roles?.cache?.some(role => role.name === 'DJ')) {
      await interaction.deferReply({ ephemeral: true });

      const command = String(interaction.options.getString('command')).toLowerCase();

      const player = await Player.getPlayer(interaction);
      if (player) {
        switch (command) {
          case 'test': {
            await player.test(interaction);
            break;
          }

          case 'media': {
            await interaction.followUp(utils.mediaEmbed(player));
            break;
          }

          default: {
            logLine('info', ['no test case for this']);
            await interaction.followUp({ content:'No test case for this.', ephemeral: true });
          }
        }
      }
    } else {
      await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });
    }
  },
};