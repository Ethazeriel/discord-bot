const fs = require('fs');
const chalk = require('chalk');

function currentDT() {
  const date = new Date();
  return `[${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]`;
}

async function logLine(level, args) {
  level = level.toUpperCase();
  let logStr = '';
  for (let i = 0; i < args.length; i++) {
    logStr = logStr.concat(args[i] + ' ');
  }
  switch (level) {
  case 'INFO':
    console.log(`${chalk.yellow(currentDT())} - ${chalk.bold.blue(level)} - ${logStr}`);
    fs.writeFile('./logs/all.log', `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
      if (err) {
        console.error(err);
        return;
      }
    });
    break;

  case 'TRACK':
    console.log(`${chalk.yellow(currentDT())} - ${chalk.bold.green(level)} - ${logStr}`);
    fs.writeFile('./logs/all.log', `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
      if (err) {
        console.error(err);
        return;
      }
    });
    break;

  case 'ERROR':
    console.error(`${chalk.yellow(currentDT())} - ${chalk.bold.red(level)} - ${logStr}`);
    fs.writeFile('./logs/all.log', `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
      if (err) {
        console.error(err);
        return;
      }
    });
    fs.writeFile('./logs/error.log', `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
      if (err) {
        console.error(err);
        return;
      }
    });
    break;

  default:
    console.log(`${chalk.yellow(currentDT())} - ${chalk.bold.magenta(level)} - ${logStr}`);
    fs.writeFile('./logs/all.log', `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
      if (err) {
        console.error(err);
        return;
      }
    });
    break;
  }

}

exports.logLine = logLine;