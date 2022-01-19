const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const { logLine } = require('./logger.js');
const youtubedl = require('youtube-dl-exec').raw;
const { useragent } = require('./config.json').youtube;

class Player {
  constructor() {
    //
  }

  async test(interaction, ... input) {
    await interaction.followUp({ content: `test ${input}`, ephemeral: true });
  }
}

exports.Player = Player;