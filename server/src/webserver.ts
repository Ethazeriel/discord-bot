import { Worker } from 'worker_threads';
import { log, logDebug } from './logger.js';
import Player from './player.js';
import fetch from './acquire.js';
import { toggleSlowMode } from './acquire.js';
import { seekTime as seekRegex } from './regexes.js';
import validator from 'validator';
import { fileURLToPath, URL } from 'url';

let worker = new Worker(fileURLToPath(new URL('./workers/webserver.js', import.meta.url).toString()), { workerData:{ name:'WebServer' } });
worker.on('exit', code => {
  logDebug(`Worker exited with code ${code}.`);
  worker = new Worker(fileURLToPath(new URL('./workers/webserver.js', import.meta.url).toString()), { workerData:{ name:'WebServer' } });
}); // if it exits just spawn a new one because that's good error handling, yes

worker.on('error', code => {
  logDebug(`Worker threw error ${code.message}.`, '\n', code.stack);
  worker = new Worker(fileURLToPath(new URL('./workers/webserver.js', import.meta.url).toString()), { workerData:{ name:'WebServer' } });
}); // ehh fuck it, probably better than just crashing I guess

worker.on('message', async (message:WebWorkerMessage<ActionType>) => {

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
                const force = (message as WebWorkerMessage<'togglePause'>).parameter;
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

          case 'pendingIndex': {
            if (!(message.parameter)) {
              logDebug(`webparent queue—parameter nullish; was [${message.parameter}]`);
              worker.postMessage({ id:message.id, error: `either you've altered your client or we've fucked up; can't queue ${message.parameter}` });
              return;
            }
            // if we're here, these values should be safe (validated by joi)
            let index = (message.parameter as PlayerPendingIndex).index;
            const query = (message.parameter as PlayerPendingIndex).query;

            const { UUID } = player.placeholderIndex(message.userName, index);
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
              const removed = player.removebyUUID(UUID);
              if (!removed.length) { logDebug(`webparent queue—failed to find/ UUID ${UUID} already removed`); }
              return;
            }

            let flag = false;
            const length = player.getQueue().length;
            if (index < 0) {
              flag = true; index = 0;
            } else if (length < index) { flag = true; /* handled by splice */ }
            if (flag) { logDebug(`webparent queue—${(index < 0) ? `index negative ${index}` : `index ${index} > ${length}`}. queueing anyway`); }

            const success = player.replacePlaceholder(tracks, UUID);
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

          case 'failedIndex': {
            if (!(message.parameter)) {
              logDebug(`webparent queue—parameter nullish; was [${message.parameter}]`);
              worker.postMessage({ id:message.id, error: `either you've altered your client or we've fucked up; can't queue ${message.parameter}` });
              return;
            }
            // if we're here, these values should be safe (validated by joi)
            const UUID = (message.parameter as PlayerFailedIndex).UUID;
            const query = (message.parameter as PlayerFailedIndex).query;

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
              return;
            }

            const success = player.replacePlaceholder(tracks, UUID);
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
              if (message.parameter) {
                const from = (message.parameter as PlayerMove).from;
                const to = (message.parameter as PlayerMove).to;
                const UUID = (message.parameter as PlayerMove).UUID;
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
                logDebug(`move—${`parameter is nullish, contains [${message.parameter}]` }`);
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

export async function sendWebUpdate(type:'player', data:PlayerStatus) {
  if (type === 'player') {
    worker.postMessage({ action: 'websync', queue:data });
  }
}

process.on('SIGTERM', async () => {
  worker.postMessage({ action:'exit' });
});