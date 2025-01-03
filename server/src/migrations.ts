import * as db from './database.js';
import { log, logDebug } from './logger.js';
import { sanitize } from './regexes.js';
import subsonic from './workers/acquire/subsonic.js';


const trackVersion = 1;

async function upgradeTrack(track:Track, internal:boolean = false):Promise<Track> {
  // if no version string, assume this is a pre-audiosource track and set version to 0
  if (!track.version) {track.version = 0;}
  log('Track', [`Migrating track ${track.goose.id} from version ${track.version}`]);
  switch (track.version) {

    case 0:{
      // migration to multiple-source track system
      type TrackV0 = Track & {youtube?:Array<TrackYoutubeSource>};
      const youtube = JSON.parse(JSON.stringify((track as TrackV0).youtube));
      track.audioSource = { youtube: youtube };
      delete (track as TrackV0).youtube;
      // see if we have subsonic info for this track and add if so
      let query = `${track.goose.track.name} ${track.goose.artist.name}`;
      query = query.replace(sanitize, '');
      query = query.replace(/(-)+/g, ' ');
      const subsonicResult = await subsonic.fromText(query);
      if (subsonicResult) {
        track.audioSource.subsonic = subsonicResult;
        // also need to update goose duration, as may differ between sources and subsonic is preferred
        track.goose.track.duration = subsonicResult.duration;
      }
      track.version = 1;
      return await upgradeTrack(track, true);
    }

    case trackVersion:{
      // do the replace
      if (internal === false) {
        // if migrate called for up to date track, yell about it and return the track as-is
        log('Error', ['migrate called but track is up to date']);
        return track;
      } else {
        log('Track', [`Track ${track.goose.id} migrated, updating db`]);
        db.replaceTrack(track);
        return track;
      }
    }
  }
  logDebug('hit cursed upgradeTrack exit');
  // should never reach this return; just here to appease TS
  return track;
}

export { trackVersion, upgradeTrack };

