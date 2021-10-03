const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

// set things up
const queue = [];
let currentTrack = [];
const player = createAudioPlayer();
let playerStatus = 'idle';
let voiceConnected = false;

player.on('error', error => {console.error('error:', error.message, 'with file', error.resource.metadata.title, 'full:', error);});
player.on('stateChange', (oldState, newState) => {
  console.log(`Player transitioned from ${oldState.status} to ${newState.status}`);
  playerStatus = newState.status;
  if (oldState.status == 'playing' && newState.status == 'idle') { // Starts the next track in line when one finishes
    playTrack();
  }
});


async function createVoiceConnection(interaction) { // join a voice channel
  if (voiceConnected == false) {
    const connection = joinVoiceChannel({
      channelId: interaction.member.voice.channel.id,
      guildId: interaction.member.voice.channel.guild.id,
      adapterCreator: interaction.member.voice.channel.guild.voiceAdapterCreator,
    });
    connection.on('stateChange', (oldState, newState) => { console.log(`Connection transitioned from ${oldState.status} to ${newState.status}`); });
    connection.subscribe(player);
    voiceConnected = true;
  }
}


function addToQueue(track) { // append things to the queue
  queue.push(track);
  if (playerStatus == 'idle') { // start playing if the player is idle
    playTrack();
  }
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
  if (queue.length > 0) {
    const track = queue[0];
    const resource = createAudioResource(ytdl(track.url), { metadata: { title: track.title } });
    // const connection = getVoiceConnection(id);
    player.play(resource);
    currentTrack = queue[0];
    queue.shift();
  } else {
    console.log('queue finished');
  }
}

async function playLocalTrack(track) { // play a locally stored track
  const resource = createAudioResource(track.url, { metadata: { title: track.title } });
  player.play(resource);
}

async function leaveVoice(interaction) { // leave a voice channel
  const connection = getVoiceConnection(interaction.guild.id);
  connection.destroy();
  voiceConnected = false;
}

function getCurrentTrack() {
  if (playerStatus == 'playing') {
    return currentTrack;
  } else {
    return null;
  }
}

function removeTrack(track) {
  queue.splice(track, 1);
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