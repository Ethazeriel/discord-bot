/* eslint-disable no-console */
import fs from 'fs';
import { MongoClient } from 'mongodb';
import { log } from './logger.js';
const mongo = JSON.parse(fs.readFileSync(new URL('../../config.json', import.meta.url))).mongo;
import chalk from 'chalk';
import ytdl from 'ytdl-core';
const url = mongo.url;
const dbname = mongo.database;
const collname = mongo.collection;
let db;
let con;

MongoClient.connect(url, function(err, client) {
  if (err) throw err;
  con = client;
  db = client.db(dbname);
  log('database', [`Connected to database: ${dbname}`]);
});

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));


async function dothing() {
  await sleep(1000);
  const database = db.collection(collname);
  const cursor = await database.find({ 'goose.update':{ $not:{ $exists:true } } });
  const tracks = await cursor.toArray();
  if (!Object.keys(tracks).length) {
    console.log('Query returned empty set');
  }
  let count = 0;
  for (const element of tracks) {
    let good = true;
    const filter = { 'goose.id':element.goose.id };
    try {
      const newtube = await ytdl.getBasicInfo(element.youtube.id);
      console.log('ytdl 1 back');
      if (newtube.videoDetails.title != element.youtube.name) {
        const update = { $set: { 'youtube.name':newtube.videoDetails.title } };
        const result = await database.updateOne(filter, update);
        if (result.modifiedCount == 1) {
          console.log(`Updated track ${chalk.green(element.goose.id)} with new title ${chalk.blue(newtube.videoDetails.title)}`);
        } else {console.log(`Something went wrong with ${chalk.red(element.goose.id)}`);}
      } else {console.log(`Did not update track ${chalk.blue(element.goose.id)} as title already matches`);}
    } catch (error) {
      console.log(`error with track ${chalk.blue(element.goose.id)}: `, error);
      good = false;
    }

    let its = 0;
    await element.alternates.forEach(async (alternate, index) => {
      try {
        const newalternate = await ytdl.getBasicInfo(alternate.id);
        console.log(`ytdl ${index + 2} back`);
        if (newalternate.videoDetails.title != element.alternates[index].name) {
          element.alternates[index].name = newalternate.videoDetails.title;
        }
        its++;
      } catch (error) {
        console.log(`error with track ${chalk.blue(element.goose.id)}, alternate ${index}: `, error);
        good = false;
      }
    });
    await sleep(3000);
    good = (its == 4) ? good : false;
    if (!element.alternates.length) {good = true;}
    const update2 = { $set: { alternates: element.alternates } };
    const result2 = await database.updateOne(filter, update2);
    if (result2.modifiedCount == 1) {
      console.log(`Updated alternates of ${chalk.green(element.goose.id)}`);
    } else {console.log(`Alternates match for ${chalk.red(element.goose.id)}`);}
    count++;
    if (good) {
      console.log('Update is good - saving DB marker');
      const gupdate = { $set: { 'goose.update':true } };
      const result3 = await database.updateOne(filter, gupdate);
      if (result3.modifiedCount == 1) {
        console.log(`Set good marker in ${chalk.green(element.goose.id)}`);
      } else {console.log(`Didn't set marker in ${chalk.red(element.goose.id)}`);}
    } else {console.log(`Didn't set marker in ${chalk.red(element.goose.id)}, good is false`);}
    console.log('sleeping for 2 seconds before the next track');
    await sleep(2000);
  }
  await sleep(4000);

  console.log(`Modified ${chalk.blue(count)} tracks`);
  try {
    log('database', [`Closing connection: ${dbname}`]);
    await con.close();
  } catch (error) {
    log('error', ['database error:', error.message]);
    return error;
  }
}

dothing();


process.on('SIGTERM', async () => {
  log('info', ['received termination command, exiting']);
  try {
    log('database', [`Closing connection: ${dbname}`]);
    await con.close();
  } catch (error) {
    log('error', ['database error:', error.message]);
    return error;
  }
  process.exit();
});