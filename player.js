const youtubedl = require('youtube-dl-exec').raw;
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, getVoiceConnections } = require('@discordjs/voice');

const { logLine, logDebug } = require('./logger.js');
const { useragent } = require('./config.json').youtube;

const players = [];

class Player {
  constructor(interaction) {
    logDebug('constructor');
    this.queue = {
      index: 0,
      tracks: [],
      loop: false,
    };

    this.player = createAudioPlayer();
    this.player.on('error', error => { logLine('error', [error.stack ]); });
    this.player.on('stateChange', (oldState, newState) => {
      logDebug(`Player transitioned from ${oldState.status} to ${newState.status}`);

      if (newState.status == 'idle') { // Starts the next track in line when one finishes
        //
      }
    });

    const connection = joinVoiceChannel({
      channelId: interaction.member.voice.channel.id,
      guildId: interaction.member.voice.channel.guild.id,
      adapterCreator: interaction.member.voice.channel.guild.voiceAdapterCreator,
    });
    connection.on('stateChange', (oldState, newState) => {
      logDebug(`Connection transitioned from ${oldState.status} to ${newState.status}`);
      if (newState.status == 'destroyed') {
        //
      }
    });
    connection.subscribe(this.player);
  }

  test(interaction) {
    //
  }

  async join(interaction) {
    joinVoiceChannel({
      channelId: interaction.member.voice.channelId,
      guildId: interaction.guild.id,
      adapterCreator: interaction.member.voice.channel.guild.voiceAdapterCreator,
    });

    return (this); // lazy code condensing
  }

  static async getPlayer(interaction, { explicitJoin = false } = {}) {
    const userChannel = interaction.member.voice.channelId;

    if (!userChannel) {
      await interaction.followUp({ content:'You must join a voice channel first.', ephemeral: true });
      return (null);
    }

    const guild = interaction.guild.id;
    const connection = getVoiceConnection(guild);
    const botChannel = (connection) ? interaction.client.channels.cache.get(connection.joinConfig.channelId) : null;
    const isAlone = botChannel?.members?.size == 1;

    if (userChannel == botChannel?.id) {
      if (explicitJoin) { await interaction.followUp({ content:'Bot is already in your channel.', ephemeral: true }); }
      return (players[guild]);
    } else if (!connection || isAlone) {
      return (players[guild]?.join(interaction) || (players[guild] = new Player(interaction)));
    } else {
      await interaction.followUp({ content:'Bot is busy in another channel.', ephemeral: true });
      return (null);
    }
  }
}

exports.getPlayer = Player.getPlayer;
exports.Player = Player;