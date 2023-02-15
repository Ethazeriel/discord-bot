import { Worker } from 'worker_threads';
import { logDebug } from './logger.js';
import Player from './player.js';
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

worker.on('message', async (message:WebWorkerMessage) => {

  switch (message.type) {
    case 'player': {
      const player = Player.retrievePlayer(message.userId, 'user');
      if (player) {
        switch (message.action) {
          case 'get': {
            const status = player.getStatus();
            if (!status) { logDebug('webserver parent and status nullish'); }
            worker.postMessage({ id:message.id, status:status });
            break;
          }

          case 'prev': {
            if (player.getQueue().length) {
              await player.prev();
              player.webSync('media');
              const status = player.getStatus();
              worker.postMessage({ id:message.id, status:status });
            } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
            break;
          }

          case 'next': {
            if (player.getQueue().length) {
              if (player.getNext()) {
                await player.next();
                player.webSync('media');
                const status = player.getStatus();
                worker.postMessage({ id:message.id, status:status });
              } else { worker.postMessage({ id:message.id, error:'Queue is over, and not set to loop.' }); } // rework; next on ended queue should restart
            } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
            break;
          }

          case 'jump': {
            if (player.getQueue().length) {
              const position = Math.abs(Number(message.parameter));
              await player.jump(position);
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
                await player.togglePause();
                player.webSync('media');
                const status = player.getStatus();
                worker.postMessage({ id:message.id, status:status });
              } else { worker.postMessage({ id:message.id, error:'Queue is over, and not set to loop.' }); } // rework; play-pause on ended queue should restart
            } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
            break;
          }

          case 'toggleLoop': {
            if (player.getQueue().length) {
              const current = player.getCurrent();
              await player.toggleLoop();
              player.webSync((current) ? 'queue' : 'media');
              const status = player.getStatus();
              worker.postMessage({ id:message.id, status:status });
            } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
            break;
          }

          case 'queue':
            // yeah I have no idea what the fuck I want to do here
            break;

          case 'move': { // TODO: probably remove/ move this to the webserver parent when done testing
            if (player.getQueue().length > 1) {
              if (message.parameter && typeof message.parameter == 'string') {
                const [stringFrom, stringTo, stringUUID] = (message.parameter as string).split(' ');
                if (stringFrom && stringTo && stringUUID) {
                  const from = Number(stringFrom); const to = Number(stringTo);
                  const UUID = Number(stringUUID);
                  if (!(isNaN(from) || isNaN(to) || isNaN(UUID))) {
                    const { success, message: failure } = player.move(from, to, UUID);
                    if (success) {
                      player.webSync('queue');
                      const status = player.getStatus();
                      worker.postMessage({ id:message.id, status:status });
                    } else { logDebug(`move—probable user error ${failure}`); worker.postMessage({ id:message.id, error:`sorry this isn't formatted: ${failure}` }); }
                  } else {
                    logDebug(`move—${isNaN(from) ? `from is NaN, contains [${from}]` : isNaN(to) ? `to is NaN, contains [${to}]` : `UUID is NaN, contains [${UUID}]`}`);
                    worker.postMessage({ id:message.id, error:'either you\'ve altered your client or we\'ve fucked up' });
                  }
                } else {
                  logDebug(`move—${!stringFrom ? `from is nullish, contains [${stringFrom}]` : !stringTo ? `to is nullish, contains [${stringTo}]` : `UUID is nullish, contains [${stringUUID}]`}`);
                  worker.postMessage({ id:message.id, error:'either you\'ve altered your client or we\'ve fucked up' });
                }
              } else {
                logDebug(`move—${!message.parameter ? `parameter is nullish, contains [${message.parameter}]` : `parameter is not a string, typeof [${typeof message.parameter}]`}`);
                worker.postMessage({ id:message.id, error:'either you\'ve altered your client or we\'ve fucked up' });
              }
            } else {
              logDebug('move—web client, length <= 1');
              worker.postMessage({ id:message.id, error:'probably your auto-updates broke; queue is ~empty. try refreshing' });
            }
            break;
          }

          case 'remove': {
            if (player.getQueue().length) { // TO DO: don\'t correct for input of 0, give error instead
              const position = Math.abs((Number(message.parameter)));
              const playhead = player.getPlayhead();
              const removed = await player.remove(position); // we'll be refactoring remove later
              player.webSync((playhead == position) ? 'media' : 'queue');
              if (removed.length) {
                const status = player.getStatus();
                worker.postMessage({ id:message.id, status:status });
              } else { worker.postMessage({ id:message.id, error:'Remove failed' }); }
            } else { worker.postMessage({ id:message.id, error:'Queue is empty' }); }
            break;
          }

          case 'empty': {
            await player.empty();
            const status = player.getStatus();
            worker.postMessage({ id:message.id, status:status });
            break;
          }

          case 'shuffle': {
            if (player.getQueue().length) {
              const current = player.getCurrent();
              await player.shuffle({ albumAware: (message.parameter == 1) });
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
      } else { logDebug('webserver parent and player nullish'); worker.postMessage({ id:message.id, error:'Invalid player id' }); }
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

process.on('SIGINT' || 'SIGTERM', async () => {
  worker.postMessage({ action:'exit' });
});