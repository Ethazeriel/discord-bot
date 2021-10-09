const fs = require('fs');
const chalk = require('chalk');

function currentDT() {
  const date = new Date();
  return `[${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]`;
}

function logLine(level, args) {
  level = level.toUpperCase();
  let logStr = '';
  for (let i = 0; i < args.length; i++) {
    logStr = logStr.concat(args[i] + ' ');
  }
  console.log(`${chalk.inverse(currentDT())} - ${chalk.bgBlue(level)} - ${logStr}`);
}

exports.logLine = logLine;