// const music = require('./music.js');
const Player = require('./player.js');

const list = [];

function removeTrack(track) {
  list.splice(track, 1);
}

function emptyList() {
  list.length = 0;
}

async function importQueue(interaction) {
  const player = await Player.getPlayer(interaction);
  if (player) {
    const queue = player.getQueue();
    list.push(...queue);
    interaction.followUp({ content: `Copied ${queue.length} items from the play queue to the workspace`, ephemeral: true });
  }
}

function addTracks(tracks, index) {
  let where = index;
  for (const track of tracks) {
    list.splice(where, 0, track);
    where++;
  }
  return list.length;
}

function moveTrack(fromindex, toindex) {
  const track = list.splice(fromindex, 1);
  list.splice(toindex, 0, track[0]);
  return track;
}

exports.list = list;
exports.removeTrack = removeTrack;
exports.emptyList = emptyList;
exports.importQueue = importQueue;
exports.addTracks = addTracks;
exports.moveTrack = moveTrack;