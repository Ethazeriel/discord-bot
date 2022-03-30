/* eslint-disable no-unused-vars */
export const youtubePattern = /(?:youtube\.com|youtu\.be)(\/(?:[\w-]+\?v=|embed\/|v\/)?)([\w-]{11})(\S+)?/;
export const spotifyPattern = /(?:spotify\.com|spotify)(?:\/|:)((?:track|playlist|album){1})(?:\/|:)([a-zA-Z0-9]{22})/;
/* usage:
pattern.test(string); // boolean
const match = string.match(pattern);

match[0] is the whole, original string
match[1] is type; for spotify: track, playlist, or album
                  for youtube: one of /watch?v=, /v/, /embed/, /, and in many cases any alphanumeric, hyphen and underscore. currently unused and needs polish
match[2] is ID
match[3+] will be for any trailing parameters we may want later, and currently exists only as a catchall only on the youtubePattern
*/

export const sanitize = /([^\w :/.?=&-])+/g;
// usage: string.replace(sanitize, ''); // destructive removal of invalid symbols

export const sanitizePlaylists = /([^\w :/?=&-])+|(\.$)+/g;
export const embedPage = /(?:Page )(\d+)(?: of )(\d+)/;
export const seekTime = /^(?:(\d+):)?(?:(\d+):)?(\d+)$/;