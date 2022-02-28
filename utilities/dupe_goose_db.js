/* eslint-disable no-console */
import fs from 'fs';
import { MongoClient } from 'mongodb';
import { logLine } from './logger.js';
const mongo = JSON.parse(fs.readFileSync('./config.json')).mongo;
import chalk from 'chalk';
const url = mongo.url;
const proddb = 'goose';
const prodtrackcol = 'tracks';
const produsercol = 'users';
const testdb = 'test';
const testtrackcol = 'tracks';
const testusercol = 'users';
let db;
let con;

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

async function stepone() {
  MongoClient.connect(url, function(err, client) {
    if (err) throw err;
    con = client;
    db = client.db(proddb);
    logLine('database', [`Connected to database: ${chalk.green(proddb)}`]);
  });
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
    logLine('database', [`Closing connection: ${chalk.green(proddb)}`]);
    await con.close();
  } catch (error) { logLine('error', ['database error:', error.message]); }
  MongoClient.connect(url, function(err, client) {
    if (err) throw err;
    con = client;
    db = client.db(testdb);
    logLine('database', [`Connected to database: ${chalk.green(testdb)}`]);
  });
  await sleep(1000);
  const newtrackdatabase = db.collection(testtrackcol);
  const result1 = await newtrackdatabase.insertMany(tracks);
  const newuserdatabase = db.collection(testusercol);
  const result2 = await newuserdatabase.insertMany(users);
  console.log(`Inserted ${chalk.blue(result1.insertedCount)} tracks`);
  console.log(`Inserted ${chalk.blue(result2.insertedCount)} users`);
  try {
    logLine('database', [`Closing connection: ${chalk.green(testdb)}`]);
    await con.close();
  } catch (error) { logLine('error', ['database error:', error.message]); }
}

stepone();


process.on('SIGINT' || 'SIGTERM', async () => {
  logLine('info', ['received termination command, exiting']);
  try {
    logLine('database', ['Closing connection']);
    await con.close();
  } catch (error) {
    logLine('error', ['database error:', error.message]);
    return error;
  }
  process.exit();
});