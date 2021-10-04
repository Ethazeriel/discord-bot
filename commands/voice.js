const { SlashCommandBuilder } = require('@discordjs/builders');
const music = require('../music.js');
const utils = require('../utils.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('voice related functions')
    .addSubcommand(subcommand => subcommand
      .setName('nowplaying')
      .setDescription('Gets the current track'))
    .addSubcommand(subcommand => subcommand
      .setName('join')
      .setDescription('joins you in voice'))
    .addSubcommand(subcommand => subcommand
      .setName('leave')
      .setDescription('forces the bot to leave voice')),


  async execute(interaction) {

    switch (interaction.options.getSubcommand()) {

    case 'join': {
      music.createVoiceConnection(interaction);
      await interaction.reply({ content:`Joined voice channel ${interaction.member.voice.channel}`, ephemeral: true });
      break;
    }

    case 'leave': {
      music.leaveVoice(interaction);
      await interaction.reply({ content:'Left voice channel (if I was in one).', ephemeral: true });
      break;
    }

    case 'nowplaying': {
      const track = music.getCurrentTrack();
      // console.log(track);

      if (track != null) {
        utils.generateTrackEmbed(interaction, track, 'Now Playing: ');
      } else {
        await interaction.reply({ content:'unable to get the current track.', ephemeral: true });
      }
      break;
    }

    default: {
      console.log('OH NO SOMETHING\'S FUCKED');
      await interaction.reply({ content:'Something broke. Please try again', ephemeral: true });
    }

    }

  },
};