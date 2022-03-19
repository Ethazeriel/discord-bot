import { Worker } from 'worker_threads';
import crypto from 'crypto';
import { logLine, logDebug } from './logger.js';


let worker = new Worker('./workers/acquire.js', { workerData:{ name:'Acquire' } });
worker.on('exit', code => {
  logDebug(`Worker exited with code ${code}.`);
  worker = new Worker('./workers/acquire.js', { workerData:{ name:'Acquire' } });
}); // if it exits just spawn a new one because that's good error handling, yes

export default async function fetch(search, id = crypto.randomBytes(5).toString('hex')) {
  worker.postMessage({ search:search, id:id });
  const promise = new Promise((resolve, reject) => {
    const action = (result) => {
      if (result.id === id) {
        resolve(result.tracks);
        worker.removeListener('message', action);
        worker.removeListener('error', error);
      }
      logDebug(`listener ${id} called`);
    };
    const error = (err) => {
      logLine('error', ['worker error', err]);
      reject(err);
      worker.removeListener('message', action);
      worker.removeListener('error', error);
    };
    worker.on('message', action);
    worker.on('error', error);
  });

  return promise;
}
