const { SlashCommandBuilder } = require('@discordjs/builders');
const music = require('../music.js');
const ytdl = require('ytdl-core');
const { MessageAttachment } = require('discord.js');
const Canvas = require('canvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('music related functions')
    .addSubcommand(subcommand => subcommand
      .setName('join')
      .setDescription('joins you in voice'))
    .addSubcommand(subcommand => subcommand
      .setName('leave')
      .setDescription('forces the bot to leave voice'))
    .addSubcommand(subcommand => subcommand
      .setName('play')
      .setDescription('play a song')
      .addStringOption(option =>
        option.setName('source').setDescription('Song source').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('nowplaying')
      .setDescription('Gets the current track')),


  async execute(interaction) {

    switch (interaction.options.getSubcommand()) {

    case 'join': {
      music.createVoiceConnection(interaction);
      await interaction.reply(`Joined voice channel ${interaction.member.voice.channel}`);
      break;
    }

    case 'leave': {
      music.leaveVoice(interaction);
      await interaction.reply('Left voice channel (if I was in one).');
      break;
    }

    case 'play': {
      const reqstr = interaction.options.getString('source');

      let trackInfo = null;
      let track = null;
      switch (getRequestType(reqstr)) {
      case 'youtube':
        try {
        // handle direct youtube urls
          trackInfo = await ytdl.getInfo(reqstr);
          track = {
            title: trackInfo.videoDetails.title,
            url: trackInfo.videoDetails.video_url,
          };
        } catch (error) {
          console.error('Error parsing youtube string:', reqstr, '. Stacktrace:', error);
          await interaction.reply({ content:`Error parsing youtube string: ${reqstr}`, ephemeral: true });
        }
        break;

      case 'spotify':
        try {
        // handle direct spotify urls

        } catch (error) {
          console.error('Error parsing spotify string:', reqstr, '. Stacktrace:', error);
          await interaction.reply({ content:`Error parsing spotify string: ${reqstr}`, ephemeral: true });
        }

        break;

      default:
      // error out if we don't know how to handle the string
        console.log(`Failed to parse string ${reqstr}`);
        await interaction.reply({ content:`Failed to parse string ${reqstr}`, ephemeral: true });
      }

      music.createVoiceConnection(interaction);
      music.playTrack(interaction, track);
      break;
    }

    case 'nowplaying': {
      // const track = music.getCurrentTrack();


      const canvas = Canvas.createCanvas(160, 100);
      const context = canvas.getContext('2d');
      const bg = await Canvas.loadImage('http://ethazeriel.net/bg.png');
      context.drawImage(bg, 0, 0, canvas.width, canvas.height);
      const attachment = new MessageAttachment(canvas.toBuffer(), 'np-image.png');

      // push the message to chat
      await interaction.reply({ files: [attachment] });
      break;
    }

    default: {
      console.log('OH NO SOMETHING\'S FUCKED');
      await interaction.reply({ content:'Something broke. Please try again', ephemeral: true });
    }

    }

  },
};


function getRequestType(string) {
  const test = string.split('//');
  if (test[1].startsWith('www.youtube' || 'youtube' || 'youtu.be')) {
    return ('youtube');
  } else if (test[1].startsWith('open.spotify' || 'spotify')) {
    return ('spotify');
  }
}
