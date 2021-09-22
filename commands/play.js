const { SlashCommandBuilder } = require('@discordjs/builders');
const ytdl = require('ytdl-core');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('play a song')
    .addStringOption(option =>
      option.setName('source').setDescription('Song source').setRequired(true)),


  async execute(interaction) {

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
