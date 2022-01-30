const { SlashCommandBuilder } = require('@discordjs/builders');
const Player = require('../../player.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('test')
    .addStringOption(option =>
      option.setName('test').setDescription('test').setRequired(true)),

  async execute(interaction) {
    const test = String(interaction.options.getString('test')).toLowerCase();

    if (interaction.member?.roles?.cache?.some(role => role.name === 'DJ')) {
      await interaction.deferReply({ ephemeral: true });

      const player = await Player.getPlayer(interaction, { explicitJoin : (test == 'join') });
      if (player) {
        switch (test) {
          case 'test': {
            await player.test(interaction);
            break;
          }
          default: {
            //
          }
        }
      }
    } else {
      await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });
    }
  },
};