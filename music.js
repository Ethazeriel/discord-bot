const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');


async function createVoiceConnection(interaction) {
  const connection = joinVoiceChannel({
    channelId: interaction.member.voice.channel.id,
    guildId: interaction.member.voice.channel.guild.id,
    adapterCreator: interaction.member.voice.channel.guild.voiceAdapterCreator,
  });
  connection.on('stateChange', (oldState, newState) => { console.log(`Connection transitioned from ${oldState.status} to ${newState.status}`); });


}

async function playTrack(interaction, track) {
  const resource = createAudioResource(ytdl(track.url), { metadata: { title: track.title } });
  const connection = getVoiceConnection(interaction.guild.id);

  const player = createAudioPlayer();
  player.on('error', error => {console.error('error:', error.message, 'with file', error.resource.metadata.title, 'full:', error);});
  player.on('stateChange', (oldState, newState) => { console.log(`Player transitioned from ${oldState.status} to ${newState.status}`); });

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
}

async function leaveVoice(interaction) {
  const connection = getVoiceConnection(interaction.guild.id);
  connection.destroy();
}


exports.createVoiceConnection = createVoiceConnection;
exports.playTrack = playTrack;
exports.leaveVoice = leaveVoice;