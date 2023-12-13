import fs from 'fs';
import { Worker } from 'worker_threads';
import { log, logDebug } from './logger.js';
import Player from './player.js';
import fetch from './acquire.js';
import { toggleSlowMode } from './acquire.js';
import { seekTime as seekRegex } from './regexes.js';
import validator from 'validator';
import { fileURLToPath, URL } from 'url';
const { functions } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../config.json', import.meta.url).toString()), 'utf-8'));

let worker:null | Worker = null;

logDebug('webserver presumably being imported');
if (functions.web) {
  logDebug('webserver workers being spawned');
  worker = new Worker(fileURLToPath(new URL('./workers/webserver.js', import.meta.url).toString()), { workerData:{ name:'WebServer' } });
  worker.on('exit', code => {
    logDebug(`Worker exited with code ${code}.`);
    worker = new Worker(fileURLToPath(new URL('./workers/webserver.js', import.meta.url).toString()), { workerData:{ name:'WebServer' } });
  }); // if it exits just spawn a new one because that's good error handling, yes

  worker.on('error', code => {
    logDebug(`Worker threw error ${code.message}.`, '\n', code.stack);
    worker = new Worker(fileURLToPath(new URL('./workers/webserver.js', import.meta.url).toString()), { workerData:{ name:'WebServer' } });
  }); // ehh fuck it, probably better than just crashing I guess

  worker.on('message', async (message:WebWorkerMessage) => {

    // typeguard, should never be true in this scope
    if (!worker) {return;}

    switch (message.type) {
      case 'player': {
        const { player, message:error } = await Player.getPlayer(message.userId, message.action !== 'get');
        if (player) {
          switch (message.action) {
            case 'get': {
              const status = player.getStatus();
              if (!status) { logDebug('webserver parent and status nullish'); }
              worker.postMessage({ id:message.id, status:status });
              break;
            }

            case 'slowmode': {
              toggleSlowMode();
              break;
            }

            case 'prev': {
              if (player.getQueue().length) {
                player.prev();
                player.webSync('media');
                const status = player.getStatus();
                worker.postMessage({ id:message.id, status:status });
              } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
              break;
            }

            case 'next': {
              if (player.getQueue().length) {
                if (player.getCurrent()) {
                  player.next();
                } else { player.jump(0); }
                player.webSync('media');
                const status = player.getStatus();
                worker.postMessage({ id:message.id, status:status });
              } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
              break;
            }

            case 'jump': {
              if (player.getQueue().length) {
                const position = Math.abs(Number(message.parameter));
                player.jump(position);
                player.webSync('media');
                const status = player.getStatus();
                worker.postMessage({ id:message.id, status:status });
              } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
              break;
            }

            case 'seek': { // copied wholesale from interaction/queue/seek
              if (player.getQueue().length) {
                const track = player.getCurrent();
                if (track) {
                  const usrtime = validator.escape(validator.stripLow(message.parameter + '')).trim();
                  if (!seekRegex.test(usrtime)) { worker.postMessage({ id:message.id, error:'Invalid timestamp' }); } else {
                    const match = usrtime.match(seekRegex);
                    let time = Number(match![3]);
                    if (match![1] && !match![2]) { match![2] = match![1], match![1] = '0'; }
                    if (match![2]) {time = (Number(match![2]) * 60) + time;}
                    if (match![1]) {time = (Number(match![1]) * 3600) + time;}

                    if (time > track.goose.track.duration) { worker.postMessage({ id:message.id, error:'Can\'t seek beyond end of track' });} else {
                      await player.seek(time);
                      player.webSync('media');
                      const status = player.getStatus();
                      worker.postMessage({ id:message.id, status:status });
                    }
                  }
                } else { worker.postMessage({ id:message.id, error:'Nothing is playing' }); }
              } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
              break;
            }

            case 'togglePause': {
              if (player.getQueue().length) {
                if (player.getCurrent()) {
                  let force;
                  if (message.parameter !== 'undefined') { force = (message.parameter === 'true') ? true : false; }
                  player.togglePause({ force: force });
                } else { player.jump(0); }
                player.webSync('media');
                const status = player.getStatus();
                worker.postMessage({ id:message.id, status:status });
              } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
              break;
            }

            case 'toggleLoop': {
              if (player.getQueue().length) {
                const current = player.getCurrent();
                player.toggleLoop();
                player.webSync((current) ? 'queue' : 'media');
                const status = player.getStatus();
                worker.postMessage({ id:message.id, status:status });
              } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
              break;
            }

            case 'pendingIndex':{ // eslint-disable-next-line prefer-const
              let [stringIndex, query] = (message.parameter as string).split(' ');
              if (!(stringIndex && query)) {
                logDebug(`webparent queue—at least one parameter nullish; stringIndex contains [${stringIndex}], query contains [${query}]; message was [${message.parameter}]`);
                worker.postMessage({ id:message.id, error: `either you've altered your client or we've fucked up; can't queue ${message.parameter}` });
                return;
              }
              let index = Number(stringIndex);
              if (isNaN(index)) {
                logDebug(`webparent queue—index NaN, contains [${index}]`);
                worker.postMessage({ id:message.id, error: `either you've altered your client or we've fucked up; can't queue ${message.parameter}` });
                return;
              }
              // I could do this right or I could get it working and sleep
              const shittify = /(?:spotify\.com|spotify).+((?:track|playlist|album){1}).+([a-zA-Z0-9]{22})/;
              if (shittify.test(query)) {
                const match = query.match(shittify);
                query = `spotify.com/${match![1]}/${match![2]}`;
              } else {
                logDebug(`webparent queue—shitty bandaid failed; ${query} does not match regex`);
                worker.postMessage({ id:message.id, error: 'I\'ll fix this once I sleep <3' });
                return;
              }

              const { UUID } = player.pendingIndex(message.userName, index);
              player.webSync('queue');
              const status = player.getStatus();
              worker.postMessage({ id:message.id, status:status });

              let tracks: Track[] = [];
              try {
                tracks = await fetch(query);
                if (tracks.length == 0) {
                  logDebug(`webparent queue—[${query}] resulted in 0 tracks; message was [${message.parameter}]`);
                  worker.postMessage({ id:message.id, error: `either ${query}\nis an empty playlist/ album, or we've fucked up` });
                  return;
                }
              } catch (error:any) {
                log('error', [`webparent queue—fetch error, ${error.stack}`]);
                worker.postMessage({ id:message.id, error: `check that ${query} is't a private playlist` });
                const removed = await player.removebyUUID(UUID);
                if (!removed.length) { logDebug(`webparent queue—failed to find/ UUID ${UUID} already removed`); }
                return;
              }

              let flag = false;
              const length = player.getQueue().length;
              if (index < 0) {
                flag = true; index = 0;
              } else if (length < index) { flag = true; /* handled by splice */ }
              if (flag) { logDebug(`webparent queue—${(index < 0) ? `index negative ${index}` : `index ${index} > ${length}`}. queueing anyway`); }

              const success = player.replacePending(tracks, UUID);
              if (!success) {
                logDebug(`webparent queue—failed to replace UUID ${UUID}, probably deleted`);
                return;
              }

              const current = player.getCurrent();
              //                if current will change or just changed (pending and was just replaced)
              const mediaSync = (current === undefined || current.goose.UUID === UUID);

              player.webSync(mediaSync ? 'media' : 'queue');
              return;
            }

            case 'move': { // TODO: probably remove/ move this to the webserver parent when done testing
              const length = player.getQueue().length;
              if (length > 1) {
                if (message.parameter && typeof message.parameter == 'string') {
                  const [stringFrom, stringTo, UUID] = (message.parameter as string).split(' ');
                  if (stringFrom && stringTo && UUID) {
                    const from = Number(stringFrom); const to = Number(stringTo);
                    if (!(isNaN(from) || isNaN(to) || typeof UUID !== 'string')) {
                      const { success, message: failure } = player.move(from, to, UUID);
                      if (success) {
                        player.webSync('queue');
                        const status = player.getStatus();
                        worker.postMessage({ id:message.id, status:status });
                      } else { logDebug(`move—probable user error ${failure}`); worker.postMessage({ id:message.id, error:failure }); }
                    } else {
                      logDebug(`move—${isNaN(from) ? `from is NaN, contains [${from}]` : isNaN(to) ? `to is NaN, contains [${to}]` : `UUID is not a string, contains [${UUID}]`}`);
                      worker.postMessage({ id:message.id, error:'either you\'ve altered your client or we\'ve fucked up' });
                    }
                  } else {
                    logDebug(`move—${!stringFrom ? `from is nullish, contains [${stringFrom}]` : !stringTo ? `to is nullish, contains [${stringTo}]` : `UUID is nullish, contains [${UUID}]`}`);
                    worker.postMessage({ id:message.id, error:'either you\'ve altered your client or we\'ve fucked up' });
                  }
                } else {
                  logDebug(`move—${!message.parameter ? `parameter is nullish, contains [${message.parameter}]` : `parameter is not a string, typeof [${typeof message.parameter}]`}`);
                  worker.postMessage({ id:message.id, error:'either you\'ve altered your client or we\'ve fucked up' });
                }
              } else {
                logDebug('move—web client, length <= 1');
                worker.postMessage({ id:message.id, error:'probably your auto-updates broke; try refreshing' });
              }
              break;
            }

            case 'remove': {
              if (player.getQueue().length) { // TO DO: don\'t correct for input of 0, give error instead
                const position = Math.abs((Number(message.parameter)));
                const playhead = player.getPlayhead();
                const removed = player.remove(position); // we'll be refactoring remove later
                player.webSync((playhead == position) ? 'media' : 'queue');
                if (removed.length) {
                  const status = player.getStatus();
                  worker.postMessage({ id:message.id, status:status });
                } else { worker.postMessage({ id:message.id, error:'Remove failed' }); }
              } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
              break;
            }

            case 'empty': {
              player.empty();
              const status = player.getStatus();
              worker.postMessage({ id:message.id, status:status });
              break;
            }

            case 'shuffle': {
              if (player.getQueue().length) {
                const current = player.getCurrent();
                player.shuffle({ albumAware: (message.parameter == 1) });
                player.webSync((current) ? 'queue' : 'media');
                const status = player.getStatus();
                worker.postMessage({ id:message.id, status:status });
              } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
              break;
            }

            default:
              logDebug('Hit webserver player message default case,', JSON.stringify(message, null, 2));
              worker.postMessage({ id:message.id, error:'Invalid player action' });
              break;
          }
        } else { worker.postMessage({ id:message.id, error:error }); }
        break;
      }

      default:
        logDebug('Hit webserver worker default case,', JSON.stringify(message, null, 2));
        worker.postMessage({ id:message.id, error:'Invalid server action' });
        break;
    }
  });
}
export async function sendWebUpdate(type:'player', data:PlayerStatus) {
  logDebug('send web update is executing');
  if (!functions.web) {return;}
  if (!worker) {return;}
  if (type === 'player') {
    worker.postMessage({ action: 'websync', queue:data });
  }
}

process.on('SIGINT' || 'SIGTERM', async () => {
  if (worker) {worker.postMessage({ action:'exit' });}
});