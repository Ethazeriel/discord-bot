const { SlashCommandBuilder } = require('@discordjs/builders');
const Player = require('../../player.js');
const utils = require('../../utils.js');

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
            player.test(interaction);
            break;
          }

          case 'reg1': {
            player.reg1(interaction, (async () => utils.generateQueueEmbed(player, 'Playing Next: ', 1)));
            interaction.followUp(await utils.generateQueueEmbed(player, 'Playing Next: ', 1));
            break;
          }

          case 'reg2': {
            const action = (async () => utils.generateQueueEmbed(player, 'Playing Next: ', 1));
            player.reg2(interaction, action);
            interaction.followUp(await utils.generateQueueEmbed(player, 'Playing Next: ', 1));
            break;
          }

          case 'update': {
            player.update(interaction, 'media');
            break;
          }

          case 'media': {
            const embed = utils.mediaEmbed(player);
            interaction.message = await interaction.followUp(embed);
            await player.register(interaction, 'media', embed);
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