const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const { logLine } = require('./logger.js');
const youtubedl = require('youtube-dl-exec').raw;
const { useragent } = require('./config.json').youtube;

// set things up
let queue = [];
let currentTrack = [];
const player = createAudioPlayer();
let playerStatus = 'idle';
let voiceConnected = false;
let connectionId = null;
let loop = false;
let queuestash = [];
let client = null;

player.on('error', error => {logLine('error', [ 'error:', error.message, 'with file', error.resource.metadata.title, 'full:', error.stack ]);});
player.on('stateChange', (oldState, newState) => {
  logLine('info', ['Player transitioned from', oldState.status, 'to', newState.status]);
  playerStatus = newState.status;
  if (newState.status == 'idle') { // Starts the next track in line when one finishes
    playTrack();
  }
});


function createVoiceConnection(interaction) { // join a voice channel
  if (voiceConnected == false) {
    const connection = joinVoiceChannel({
      channelId: interaction.member.voice.channel.id,
      guildId: interaction.member.voice.channel.guild.id,
      adapterCreator: interaction.member.voice.channel.guild.voiceAdapterCreator,
    });
    connectionId = interaction.guild.id;
    client = interaction.client; // we need this so we can access our client instance in playtrack
    connection.on('stateChange', (oldState, newState) => {
      logLine('info', ['Connection transitioned from', oldState.status, 'to', newState.status]);
      if (newState.status == 'destroyed') {
        stashQueue(); // store the current queue in a variable when the bot leaves chat
      }
    });
    connection.subscribe(player);
    voiceConnected = true;
  }
}

function stashQueue() { // if something fucks up, this lets us get the most recent queue back
  queuestash = queue;
  if (loop != true) { queuestash.unshift(currentTrack); }
  logLine('info', ['Stashed', queuestash.length, 'items']);
  emptyQueue();
}

function unstashQueue() {
  queue = queuestash;
  playTrack();
}

function addToQueue(track) { // append things to the queue
  queue.push(track);
  if (playerStatus == 'idle') { // start playing if the player is idle
    playTrack();
  }
  return queue.length;
}

function addMultipleToQueue(tracks) {
  for (const track of tracks) {
    queue.push(track);
  }
  if (playerStatus == 'idle') { // start playing if the player is idle
    playTrack();
  }

}

function addToQueueTop(track) { // prepend things to the queue
  queue.unshift(track);
  if (playerStatus == 'idle') { // start playing if the player is idle
    playTrack();
  }
}

function addToQueueSkip(track) { // start playing immediately
  queue.unshift(track);
  playTrack();
}


async function playTrack() { // start the player
  const channel = client.channels.cache.get(getVoiceConnection(connectionId).joinConfig.channelId);
  if (channel.members.size > 1) {
    if (queue.length > 0) {
      const track = queue[0];
      try {
        const resource = createAudioResource(youtubedl(track.youtube.id, {
          o: '-',
          q: '',
          f: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
          r: '100K',
          cookies: 'cookies.txt',
          'user-agent': useragent,
        }, { stdio: ['ignore', 'pipe', 'ignore'] }).stdout);
        player.play(resource);
        logLine('track', ['Playing track: ', track.artist.name, ':', track.spotify.name]);
      } catch (error) {
        logLine('error', [error.stack]);
      }
      currentTrack = queue[0];
      queue.shift();
      if (loop == true) {queue.push(track);}
    } else {
      logLine('info', ['queue finished']);
    }
  } else {
    leaveVoice();
    logLine('info', ['Alone in channel, leaving voice']);
  }
}

async function playLocalTrack(track) { // play a locally stored track
  const resource = createAudioResource(track.url, { metadata: { title: track.title } });
  player.play(resource);
}

async function leaveVoice() { // leave a voice channel
  skipTrack();
  const connection = getVoiceConnection(connectionId);
  connection.destroy();
  voiceConnected = false;
}

function getCurrentTrack() {
  return currentTrack;
}

function removeTrack(track) {
  queue.splice(track, 1);
}

function toggleLoop() {
  if (loop == false) {
    loop = true;
    if (currentTrack != queue[queue.length - 1]) {
      queue.push(currentTrack);
    }
    return true;
  } else {
    loop = false;
    return false;
  }
}

function getLoop() { // this is really just for the showqueue command
  return loop;
}

function emptyQueue() {
  queue = [];
}

function skipTrack() {

  const track = {
    title: 'Silence',
    artist: 'Eth',
    album: 'ethsound',
    url: '../empty.mp3',
    albumart: 'albumart/albumart.jpg',
  };

  playLocalTrack(track);
}
exports.createVoiceConnection = createVoiceConnection;
exports.playTrack = playTrack;
exports.leaveVoice = leaveVoice;
exports.queue = queue;
exports.addToQueue = addToQueue;
exports.getCurrentTrack = getCurrentTrack;
exports.addToQueueTop = addToQueueTop;
exports.addToQueueSkip = addToQueueSkip;
exports.playLocalTrack = playLocalTrack;
exports.addMultipleToQueue = addMultipleToQueue;
exports.removeTrack = removeTrack;
exports.toggleLoop = toggleLoop;
exports.getLoop = getLoop;
exports.emptyQueue = emptyQueue;
exports.stashQueue = stashQueue;
exports.unstashQueue = unstashQueue;
exports.skipTrack = skipTrack;