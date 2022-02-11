const youtubedl = require('youtube-dl-exec').raw;
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, getVoiceConnections } = require('@discordjs/voice');

const { logLine, logDebug } = require('./logger.js');
const { useragent } = require('./config.json').youtube;

const players = [];

class Player {
  // acquisition
  constructor(interaction) {
    logDebug('constructor');
    this.queue = {
      tracks: [],
      playhead: 0,
      loop: false,
      paused: false,
    };

    this.player = createAudioPlayer();
    this.player.on('error', error => { logLine('error', [error.stack ]); });
    this.player.on('stateChange', (oldState, newState) => {
      logDebug(`Player transitioned from ${oldState.status} to ${newState.status}`);

      if (newState.status == 'idle') { // Starts the next track in line when one finishes
        this.queue.playhead++;
        this.play();
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

  static async getPlayer(interaction, { explicitJoin = false } = {}) {
    const userChannel = interaction.member.voice.channelId;

    if (!userChannel) {
      await interaction.followUp({ content:'You must join a voice channel first.', ephemeral: true });
      return (null);
    }

    const guild = interaction.guild.id;
    const connection = getVoiceConnection(guild);
    const botChannel = (connection) ? interaction.client.channels.cache.get(connection.joinConfig.channelId) : null;
    const isAlone = !botChannel || botChannel.members.size == 1; // was just member check, but since connection seems unreliable, think this is necessary

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

  // presence
  join(interaction) {
    joinVoiceChannel({
      channelId: interaction.member.voice.channelId,
      guildId: interaction.guild.id,
      adapterCreator: interaction.member.voice.channel.guild.voiceAdapterCreator,
    });

    return (this); // lazy code condensing
  }

  leave(interaction) {
    const success = getVoiceConnection(interaction.guild.id)?.disconnect();
    return (success);
  }

  // core
  play() {
    const track = this.queue.tracks[this.queue.playhead];
    if (track) {
      try {
        const resource = createAudioResource(youtubedl(track.youtube.id, {
          o: '-',
          q: '',
          'force-ipv4': '',
          f: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
          r: '100K',
          cookies: 'cookies.txt',
          'user-agent': useragent,
        }, { stdio: ['ignore', 'pipe', 'ignore'] }).stdout);
        this.player.play(resource);
        logLine('track', ['Playing track:', (track.artist.name || 'no artist'), ':', (track.spotify.name || track.youtube.name)]);
      } catch (error) {
        logLine('error', [error.stack]);
      }
    }
  }

  // modification
  queueNow(tracks) {
    // not constrained to length because splice does that automatically
    this.queue.tracks.splice(this.queue.playhead + 1, 0, ...tracks);
    this.play();
  }

  queueNext(tracks) {
    // not constrained to length because splice does that automatically
    this.queue.tracks.splice(this.queue.playhead + 1, 0, ...tracks);
    if (this.player.state.status == 'idle') { this.play(); }
  }

  queueLast(tracks) {
    this.queue.tracks.push(tracks);
    if (this.player.state.status == 'idle') { this.play(); }
  }

  remove(position = this.queue.playhead) { // will make this take a range later
    position = ((value = Math.abs(position), length = this.queue.length) => (value > length) ? length : value)();
    const removed = this.queue.tracks.splice(position, 1); // constrained 0 to length, not length - 1, and unworried about overshooting due to how splice is implemented
    if (position < this.queue.playhead) {
      this.queue.playhead--;
    } else if (position == this.queue.playhead) {
      this.play();
    }
    return (removed);
  }

  clear() {
    this.queue.playhead = 0;
    this.queue.tracks.length = 0;
    this.player.stop();
  }

  // manipulation
  prev() { // prior, loop or restart current
    this.queue.playhead = ((playhead = this.queue.playhead) => (playhead > 0) ? playhead-- : (this.queue.loop) ? this.queue.length - 1 : 0)();
    this.play(); // thinking to have play return track, for feedback on if there is a track at playhead
  }

  next() { // next, loop or end
    this.queue.playhead = ((playhead = this.queue.playhead, length = this.queue.length) => (playhead < length - 1) ? playhead++ : (this.queue.loop) ? 0 : length)();
    this.play(); // thinking to have play return track, for feedback on if there is a track at playhead
  }

  jump(position) {
    this.queue.playhead = ((value = Math.abs(position), length = this.queue.length) => (value > length) ? length : value)();
    this.play();
  }

  seek(time) {
    return ({ content:'No seek yet :c' });
  }

  shuffle({ albumAware = false } = {}) {
    return ({ content:'No shuffle yet :c' });
  }

  togglePause({ force } = {}) {
    force = (typeof force == 'boolean') ? force : undefined;
    const condition = (force == undefined) ? this.queue.paused : !force;
    const result = (condition) ? !this.player.unpause() : this.player.pause();
    (condition != result) ? this.queue.paused = result : logDebug('togglePause failed');
    return ((condition != result) ? ({ content: (result) ? 'Paused.' : 'Unpaused.' }) : ({ content:'OH NO SOMETHING\'S FUCKED' }));
  }

  toggleLoop({ force } = {}) {
    force = (typeof force == 'boolean') ? force : undefined;
    this.queue.loop = (force == undefined) ? !this.queue.loop : force;
  }

  // information

  current() {
    return (this.queue.tracks[this.queue.playhead]);
  }

  queue() {
    return (this.queue.tracks);
  }

  getPause() {
    return (this.queue.paused);
  }

  getLoop() {
    return (this.queue.loop);
  }

  // testing
  test(interaction) {
    console.log(this.player.state.status == 'idle');
  }
}

exports.getPlayer = Player.getPlayer;
exports.Player = Player;