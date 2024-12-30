// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { dragPattern, youtubePattern, youtubePlaylistPattern, spotifyPattern, napsterPattern, subsonicPattern } from './regexes.js';

export function timeDisplay(seconds:number) {
  let time = new Date(seconds * 1000).toISOString().substring(11, 19).replace(/^[0:]+/, '');
  switch (time.length) {
    case 0: time = `0${time}`;
    case 1: time = `0${time}`;
    case 2: time = `0:${time}`;
    default: return time;
  }
}

// standard disallows reading values of external types mid-drag; can only match keys
export const allowExternal = (event:React.DragEvent<HTMLElement>):boolean => {
  const index = event.dataTransfer.types.findIndex((type) => typeof type === 'string' && dragPattern.test(type));
  return (index !== -1);
};

export const allowedExternalTypes = (event:React.DragEvent<HTMLElement>) => {
  const allowed = event.dataTransfer.types.filter((type) => typeof type === 'string' && dragPattern.test(type))
    .map((type) => event.dataTransfer.getData(type))
    .filter((type) => spotifyPattern.test(type) || subsonicPattern.test(type));
  //  || youtubePlaylistPattern.test(type) || napsterPattern.test(type) || youtubePattern.test(type)

  return (allowed);
};

export function chooseAudioSource(track:Track):TrackSource|TrackYoutubeSource {
  if (track.audioSource.subsonic) {
    return track.audioSource.subsonic;
  } else {
    return track.audioSource.youtube![0];
  }
}