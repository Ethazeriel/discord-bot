const { SlashCommandBuilder } = require('@discordjs/builders');
const music = require('../music.js');
const utils = require('../utils.js');
const { logLine } = require('../logger.js');

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

    if (interaction.member?.roles?.cache?.some(role => role.name === 'DJ')) {
      await interaction.deferReply({ ephemeral: true });
      switch (interaction.options.getSubcommand()) {

      case 'join': {
        music.createVoiceConnection(interaction);
        await interaction.followUp({ content:`Joined voice channel ${interaction.member.voice.channel}`, ephemeral: true });
        break;
      }

      case 'leave': {
        music.leaveVoice();
        await interaction.followUp({ content:'Left voice channel (if I was in one).', ephemeral: true });
        break;
      }

      case 'nowplaying': {
        const track = music.getCurrentTrack();

        if (track != null) {
          utils.generateTrackEmbed(interaction, track, 'Now Playing: ');
        } else {
          await interaction.followUp({ content:'unable to get the current track.', ephemeral: true });
        }
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