/* eslint-disable no-unused-vars */
const youtubePattern = /(?:youtube\.com|youtu\.be)(\/(?:[\w-]+\?v=|embed\/|v\/)?)([\w-]{11})(\S+)?/;
const spotifyPattern = /(?:spotify\.com|spotify)(?:\/|:)((?:track|playlist|album){1})(?:\/|:)([a-zA-Z0-9]{22})/;
/* usage:
pattern.test(string); // boolean
const match = string.match(pattern);

match[0] is the whole, original string
match[1] is type; for spotify: track, playlist, or album
                  for youtube: one of /watch?v=, /v/, /embed/, /, and in many cases any alphanumeric, hyphen and underscore. currently unused and needs polish
match[2] is ID
match[3+] will be for any trailing parameters we may want later, and currently exists only as a catchall only on the youtubePattern
*/

const sanitize = /([^\w :/.?=&-])+/g;
// usage: string.replace(sanitize, ''); // destructive removal of invalid symbols

const sanitizePlaylists = /([^\w :/?=&-])+|(\.$)+/g;

exports.sanitize = sanitize;
exports.spotifyPattern = spotifyPattern;
exports.youtubePattern = youtubePattern;
exports.sanitizePlaylists = sanitizePlaylists;