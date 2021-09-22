const { SlashCommandBuilder } = require('@discordjs/builders');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');


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
      }
      break;

    case 'spotify':
      try {
        // handle direct spotify urls

      } catch (error) {
        console.error('Error parsing spotify string:', reqstr, '. Stacktrace:', error);
      }

      break;

    default:
      // error out if we don't know how to handle the string
      console.log(`Failed to parse string ${reqstr}`);
      await interaction.reply({ content:`Failed to parse string ${reqstr}`, ephemeral: true });
    }

    const connection = joinVoiceChannel({
      channelId: interaction.member.voice.channel.id,
      guildId: interaction.member.voice.channel.guild.id,
      adapterCreator: interaction.member.voice.channel.guild.voiceAdapterCreator,
    });
    connection.on('stateChange', (oldState, newState) => { console.log(`Connection transitioned from ${oldState.status} to ${newState.status}`); });
    const player = createAudioPlayer();
    player.on('error', error => {console.error('error:', error.message, 'with file', error.resource.metadata.title, 'full:', error);});
    player.on('stateChange', (oldState, newState) => { console.log(`Player transitioned from ${oldState.status} to ${newState.status}`); });

    const resource = createAudioResource(ytdl(track.url), { metadata: { title: track.title } });
    player.play(resource);
    connection.subscribe(player);

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 5e3);
      await interaction.reply(`Now Playing: ${resource.metadata.title}`);
      return connection;
    } catch (error) {
      connection.destroy();
      console.log(error);
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
