const { SlashCommandBuilder } = require('@discordjs/builders');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus } = require('@discordjs/voice');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('play a song'),


  async execute(interaction) {
    const connection = joinVoiceChannel({
      channelId: interaction.member.voice.channel.id,
      guildId: interaction.member.voice.channel.guild.id,
      adapterCreator: interaction.member.voice.channel.guild.voiceAdapterCreator,
    });
    connection.on('stateChange', (oldState, newState) => { console.log(`Connection transitioned from ${oldState.status} to ${newState.status}`); });
    const player = createAudioPlayer();
    player.on('error', error => {console.error('error:', error.message, 'with file', error.resource.metadata.title);});
    player.on('stateChange', (oldState, newState) => { console.log(`Player transitioned from ${oldState.status} to ${newState.status}`); });

    const resource = createAudioResource('space.mp3', { metadata: { title: 'SPACE' } });
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

