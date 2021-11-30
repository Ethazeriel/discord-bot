const music = require('./music.js');

let list = [];

function removeTrack(track) {
  list.splice(track, 1);
}

function emptyList() {
  list = [];
}

function importQueue() {
  const first = music.getCurrentTrack();
  const songqueue = music.queue;
  list.push(first);
  for (const track of songqueue) {
    list.push(track);
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