const { SlashCommandBuilder } = require('@discordjs/builders');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('forces the bot to leave voice'),


  async execute(interaction) {

    music.leaveVoice(interaction);
    await interaction.reply('Left voice channel (if I was in one).');
  },
};