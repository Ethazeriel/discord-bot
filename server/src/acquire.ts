import { Worker } from 'worker_threads';
import crypto from 'crypto';
import { log, logDebug } from './logger.js';
import { fileURLToPath, URL } from 'url';

const sleep = (ms:number) => new Promise((resolve) => setTimeout(resolve, ms));
let slowMode:boolean;
export function toggleSlowMode() {
  slowMode = !slowMode;
}

let worker = new Worker(fileURLToPath(new URL('./workers/acquire.js', import.meta.url).toString()), { workerData:{ name:'Acquire' } });
worker.on('exit', code => {
  logDebug(`Worker exited with code ${code}.`);
  worker = new Worker(fileURLToPath(new URL('./workers/acquire.js', import.meta.url).toString()), { workerData:{ name:'Acquire' } });
}); // if it exits just spawn a new one because that's good error handling, yes

worker.on('error', code => {
  logDebug(`Worker threw error ${code.message}.`, '\n', code.stack);
  worker = new Worker(fileURLToPath(new URL('./workers/acquire.js', import.meta.url).toString()), { workerData:{ name:'Acquire' } });
}); // ehh fuck it, probably better than just crashing I guess

export default async function fetch(search:string, id = crypto.randomBytes(5).toString('hex')):Promise<Track[]> {
  if (slowMode) { await sleep(20000); }
  worker.postMessage({ action:'search', search:search, id:id });
  const promise = new Promise((resolve, reject) => {
    const action = (result:{ id:string, tracks:Track[]}) => {
      if (result.id === id) {
        resolve(result.tracks);
        worker.removeListener('message', action);
        worker.removeListener('error', error);
      }
      logDebug(`acquire worker, listener ${id} called`);
    };
    const error = (err:any) => {
      log('error', ['worker error', JSON.stringify(err, null, 2)]);
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