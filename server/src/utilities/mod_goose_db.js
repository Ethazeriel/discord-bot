/* eslint-disable no-console */
import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import { MongoClient } from 'mongodb';
import { log } from '../logger.js';
const { mongo } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../config.json', import.meta.url).toString()), 'utf-8'));
import chalk from 'chalk';
const url = mongo.url;
const proddb = 'goose';
const prodtrackcol = 'tracks';
const produsercol = 'users';
const testdb = 'test';
const testtrackcol = 'newtracks';
const testusercol = 'users';
let db;
let con;

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

async function stepone() {
  // MongoClient.connect(url, function(err, client) {
  //   if (err) throw err;
  //   con = client;
  //   db = client.db(proddb);
  //   log('database', [`Connected to database: ${chalk.green(proddb)}`]);
  // });
  con = await MongoClient.connect(url, { ignoreUndefined: true });
  db = con.db(proddb);
  await sleep(3000);
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

  const newtracks = [];
  for (const track of tracks) {
    const youtube = JSON.parse(JSON.stringify(track.youtube));
    track.audioSource = { youtube: youtube }
    track.youtube = undefined;
    newtracks.push(track);
  }


  // MongoClient.connect(url, function(err, client) {
  //   if (err) throw err;
  //   con = client;
  //   db = client.db(testdb);
  //   log('database', [`Connected to database: ${chalk.green(testdb)}`]);
  // });
  con = await MongoClient.connect(url, { ignoreUndefined: true });
  db = con.db(testdb);
  await sleep(3000);
  const newtrackdatabase = db.collection(testtrackcol);
  const result1 = await newtrackdatabase.insertMany(newtracks);
  // const newuserdatabase = db.collection(testusercol);
  // const result2 = await newuserdatabase.insertMany(users);
  console.log(`Inserted ${chalk.blue(result1.insertedCount)} tracks`);
  // console.log(`Inserted ${chalk.blue(result2.insertedCount)} users`);
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