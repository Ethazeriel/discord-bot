import { Worker } from 'worker_threads';
import { logDebug } from './logger.js';
import Player from './player.js';
import { seekTime as seekRegex } from './regexes.js';
import validator from 'validator';

let worker = new Worker('./workers/webserver.js', { workerData:{ name:'WebServer' } });
worker.on('exit', code => {
  logDebug(`Worker exited with code ${code}.`);
  worker = new Worker('./workers/webserver.js', { workerData:{ name:'WebServer' } });
}); // if it exits just spawn a new one because that's good error handling, yes

worker.on('message', async (message) => {

  switch (message.type) {
    case 'player': {
      const player = Player.retrievePlayer(message.userId, 'user');
      if (player) {
        switch (message.action) {
          case 'get': {
            const status = player.getStatus();
            worker.postMessage({ id:message.id, status:status });
            break;
          }

          case 'previous': {
            await player.prev();
            const status = player.getStatus();
            worker.postMessage({ id:message.id, status:status });
            break;
          }

          case 'next': {
            await player.next();
            const status = player.getStatus();
            worker.postMessage({ id:message.id, status:status });
            break;
          }

          case 'jump': {
            const position = Math.abs(Number(message.parameter));
            await player.jump(position);
            player.webSync('media');
            const status = player.getStatus();
            worker.postMessage({ id:message.id, status:status });
            break;
          }

          case 'seek': { // copied wholesale from interaction/queue/seek
            const track = player.getCurrent();
            const usrtime = validator.escape(validator.stripLow(message.parameter + '')).trim();
            if (!seekRegex.test(usrtime)) { worker.postMessage({ id:message.id, error:'Invalid timestamp' }); } else {
              const match = usrtime.match(seekRegex);
              let time = Number(match[3]);
              if (match[1] && !match[2]) { match[2] = match[1], match[1] = null; }
              if (match[2]) {time = (Number(match[2]) * 60) + time;}
              if (match[1]) {time = (Number(match[1]) * 3600) + time;}

              if (time > track.youtube.duration) { worker.postMessage({ id:message.id, error:'Can\'t seek beyond end of track' });} else {
                await player.seek(time);
                const status = player.getStatus();
                worker.postMessage({ id:message.id, status:status });
              }
            }
            break;
          }

          case 'togglePause': {
            await player.togglePause();
            const status = player.getStatus();
            worker.postMessage({ id:message.id, status:status });
            break;
          }

          case 'toggleLoop': {
            await player.toggleLoop();
            const status = player.getStatus();
            worker.postMessage({ id:message.id, status:status });
            break;
          }

          case 'queue':
            // yeah I have no idea what the fuck I want to do here
            break;

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
            await player.shuffle({ albumAware: (message.parameter == 1) });
            const status = player.getStatus();
            worker.postMessage({ id:message.id, status:status });
            break;
          }

          default:
            logDebug('Hit webserver player message default case,', JSON.stringify(message, '', 2));
            worker.postMessage({ id:message.id, error:'Invalid player action' });
            break;
        }
      } else { worker.postMessage({ id:message.id, error:'Invalid player id' }); }
      break;
    }

    default:
      logDebug('Hit webserver worker default case,', JSON.stringify(message, '', 2));
      worker.postMessage({ id:message.id, error:'Invalid server action' });
      break;
  }
});

export async function sendWebUpdate(type, data) {
  if (type === 'player') {
    worker.postMessage({ action: 'websync', queue:data });
  }
}

process.on('SIGINT' || 'SIGTERM', async () => {
  worker.postMessage({ action:'exit' });
});