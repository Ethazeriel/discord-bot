const { SlashCommandBuilder } = require('@discordjs/builders');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('Joins you in voice'),


  async execute(interaction) {

    music.createVoiceConnection(interaction);
    await interaction.reply(`Joined voice channel ${interaction.member.voice.channel}`);
  },
};