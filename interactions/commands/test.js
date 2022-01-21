const { SlashCommandBuilder } = require('@discordjs/builders');
const { Player } = require('../player.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('tests')
    .addStringOption(option =>
      option.setName('test').setDescription('tests').setRequired(true)),

  async execute(interaction) {
    const test = interaction.options.getString('test');
    if (interaction.member?.roles?.cache?.some(role => role.name === 'DJ')) {
      await interaction.deferReply({ ephemeral: true });

      const player = new Player();
      player.test(interaction, test);
    } else {
      await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });
    }
  },
};