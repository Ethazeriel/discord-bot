/* eslint-disable no-console */
import fs from 'fs';
import { MongoClient } from 'mongodb';
import { log } from '../logger.js';
const mongo = JSON.parse(fs.readFileSync(new URL('../../../config.json', import.meta.url))).mongo;
import chalk from 'chalk';
const url = mongo.url;
const proddb = 'goose';
const prodtrackcol = 'tracks';
const produsercol = 'users';
const testdb = 'goose_backup';
const testtrackcol = 'tracks';
const testusercol = 'users';
let db;
let con;

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

async function stepone() {
  con = await MongoClient.connect(url, { ignoreUndefined: true });
  db = con.db(proddb);
  await sleep(1000);
  const trackdatabase = db.collection(prodtrackcol);
  const cursor = await trackdatabase.find({});
  const tracks = await cursor.toArray();
  const userdatabase = db.collection(produsercol);
  const cursor2 = await userdatabase.find({});
  const users = await cursor2.toArray();
  console.log(`Grabbed ${chalk.blue(tracks.length)} tracks`);
  console.log(`Grabbed ${chalk.blue(users.length)} users`);
  try {
    log('database', [`Closing connection: ${chalk.green(proddb)}`]);
    await con.close();
  } catch (error) { log('error', ['database error:', error.message]); }
  con = await MongoClient.connect(url, { ignoreUndefined: true });
  db = con.db(testdb);
  await sleep(1000);
  const newtrackdatabase = db.collection(testtrackcol);
  const result1 = await newtrackdatabase.insertMany(tracks);
  const newuserdatabase = db.collection(testusercol);
  const result2 = await newuserdatabase.insertMany(users);
  console.log(`Inserted ${chalk.blue(result1.insertedCount)} tracks`);
  console.log(`Inserted ${chalk.blue(result2.insertedCount)} users`);
  try {
    log('database', [`Closing connection: ${chalk.green(testdb)}`]);
    await con.close();
  } catch (error) { log('error', ['database error:', error.message]); }
}

stepone();


process.on('SIGTERM', async () => {
  log('info', ['received termination command, exiting']);
  try {
    log('database', ['Closing connection']);
    await con.close();
  } catch (error) {
    log('error', ['database error:', error.message]);
    return error;
  }
  process.exit();
});