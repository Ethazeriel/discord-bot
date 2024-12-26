/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-console */
// @ts-nocheck
import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import { MongoClient } from 'mongodb';
import { log } from '../logger.js';
const mongo = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../config.json', import.meta.url).toString()), 'utf-8')).mongo;
import chalk from 'chalk';
const url = mongo.url;
const proddb = 'goose';
const prodtrackcol = 'tracks';
const testdb = 'test';
const testtrackcol = 'tracks';
let db:any;
let con:any;

interface OldTrack {
	goose: {
		id:string,
		plays?:number
		errors?:number
		seek?:number,
		bar?:ProgressBarOptions
	},
  keys: string[],
	playlists: Record<string, number>,
	album: {
		id: string | null,
		name:string | number, // this needs to be able to be a number for shuffle
		trackNumber:number
	},
	artist: {
		id: string | null,
		name: string,
		official: string // url link to official site, if !official then bandcamp, etc
	},
	spotify: {
		id: string[],
    name: string,
		art: string,
		duration: number
	},
	youtube: youtubeObject,
	alternates: youtubeObject[],
	ephemeral?: string
	pause?: number
	start?: number
}

interface youtubeObject {
  id: string,
  name: string,
  art: string,
  duration: number
}

const sleep = (delay:number) => new Promise((resolve) => setTimeout(resolve, delay));

async function stepone() {
  // MongoClient.connect(url, function(err:any, client:any) {
  //   if (err) throw err;
  //   con = client;
  //   db = client!.db(proddb);
  //   log('database', [`Connected to database: ${chalk.green(proddb)}`]);
  // });
  con = await MongoClient.connect(url);
  db = con.db(proddb);
  log('database', [`Connected to database: ${chalk.green(proddb)}`]);

  await sleep(1000);
  const trackdatabase = db.collection(prodtrackcol);
  const cursor = await trackdatabase.find({});
  const tracks:Array<OldTrack> = await cursor.toArray();
  console.log(`Grabbed ${chalk.blue(tracks.length)} tracks`);
  try {
    log('database', [`Closing connection: ${chalk.green(proddb)}`]);
    await con.close();
  } catch (error:any) { log('error', ['database error:', error.message]); }


  const track2s:Array<Track> = [];
  for (const track of tracks) {
    if (track?.youtube?.id) {
      const youtube:Array<TrackYoutubeSource> = [{
        id: track.youtube.id,
        name: track.youtube.name,
        art: track.youtube.art,
        duration: track.youtube.duration,
        url: `https://youtu.be/${track.youtube.id}`,
      }];
      for (const youtube2 of track.alternates) {
        youtube.push({
          id: youtube2.id,
          name: youtube2.name,
          art: youtube2.art,
          duration: youtube2.duration,
          url: `https://youtu.be/${youtube2.id}`,
        });
      }
      const spotify:TrackSource | undefined = (track.spotify.id && track.spotify.id.length) ? {
        id: track.spotify.id,
        name: track.spotify.name,
        art: track.spotify.art,
        duration: track.spotify.duration,
        url: `https://open.spotify.com/track/${track.spotify.id[0]}`,
        album: track.album as any,
        artist: {
          id:track.artist.id as string,
          name:track.artist.name,
        },
      } : undefined;
      const track2:Track = {
        goose: {
          id:track.goose.id,
          plays: track.goose.plays || 0,
          errors: track.goose.errors || 0,
          album: {
            name: track.album.name as string || 'Unknown Album',
            trackNumber: track.album.trackNumber || 0,
          },
          artist: {
            name: track.artist.name || 'Unknown Artist',
            official: track.artist.official || undefined,
          },
          track: {
            name: track.spotify.name || track.youtube.name,
            duration: track.youtube.duration,
            art: track.spotify.art || track.youtube.art,
          },
        },
        keys: track.keys,
        playlists: track.playlists,
        youtube: youtube,
        bar: track.goose.bar || undefined,
        status:{},
        spotify: spotify,
      };
      track2s.push(track2);
    }
  }

  // MongoClient.connect(url, { ignoreUndefined: true }, function(err, client) {
  //   if (err) throw err;
  //   con = client;
  //   db = client!.db(testdb);
  //   log('database', [`Connected to database: ${chalk.green(testdb)}`]);
  // });
  con = await MongoClient.connect(url, { ignoreUndefined: true });
  db = con.db(testdb);
  log('database', [`Connected to database: ${chalk.green(testdb)}`]);

  await sleep(1000);
  const newtrackdatabase = db.collection(testtrackcol);
  const result1 = await newtrackdatabase.insertMany(track2s);
  console.log(`Inserted ${chalk.blue(result1.insertedCount)} tracks`);
  try {
    log('database', [`Closing connection: ${chalk.green(testdb)}`]);
    await con.close();
  } catch (error:any) { log('error', ['database error:', error.message]); }
}

stepone();


process.on('SIGTERM', async () => {
  log('info', ['received termination command, exiting']);
  try {
    log('database', ['Closing connection']);
    await con.close();
  } catch (error:any) {
    log('error', ['database error:', error.message]);
    return error;
  }
  process.exit();
});