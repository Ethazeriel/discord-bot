import { Worker } from 'worker_threads';
import crypto from 'crypto';
import { logLine, logDebug } from './logger.js';
import { fileURLToPath } from 'url';

let worker = new Worker(fileURLToPath(new URL('./workers/acquire.js', import.meta.url).toString()), { workerData:{ name:'Acquire' } });
worker.on('exit', code => {
  logDebug(`Worker exited with code ${code}.`);
  worker = new Worker(fileURLToPath(new URL('./workers/acquire.js', import.meta.url).toString()), { workerData:{ name:'Acquire' } });
}); // if it exits just spawn a new one because that's good error handling, yes

export default async function fetch(search:string, id = crypto.randomBytes(5).toString('hex')):Promise<Track[]> {
  worker.postMessage({ action:'search', search:search, id:id });
  const promise = new Promise((resolve, reject) => {
    const action = (result:{ id:string, tracks:Track[]}) => {
      if (result.id === id) {
        resolve(result.tracks);
        worker.removeListener('message', action);
        worker.removeListener('error', error);
      }
      logDebug(`listener ${id} called`);
    };
    const error = (err:any) => {
      logLine('error', ['worker error', err]);
      reject(err);
      worker.removeListener('message', action);
      worker.removeListener('error', error);
    };
    worker.on('message', action);
    worker.on('error', error);
  });

  return promise as Promise<Track[]>;
}

process.on('SIGINT' || 'SIGTERM', async () => {
  worker.postMessage({ action:'exit' });
});