const fs = require('fs');
const chalk = require('chalk');
const { sanitize } = require('./regexes.js');

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

  case 'DATABASE':
    console.log(`${chalk.yellow(currentDT())} - ${chalk.bold.cyan(level)} - ${logStr}`);
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

async function logCommand(interaction) {
  // takes an interaction, logs relevant details to file and console
  // for console
  let conStr = `Guild: ${chalk.blue(interaction.member.guild.name.replace(sanitize, '').trim())}, User: ${chalk.blue(`${interaction.user.username.replace(sanitize, '').trim()}#${interaction.user.discriminator}`)}, Command: ${chalk.cyan(interaction.commandName)}`;
  if (interaction.options._subcommand) {
    conStr = conStr.concat(`, Subcommand: ${chalk.green(interaction.options._subcommand)}, `);
  }
  if (interaction.options._hoistedOptions.length) {
    conStr = conStr.concat(', Options: ');
    for (const option of interaction.options._hoistedOptions) {
      if (option.type == 'STRING') { // We're only using strings and integers right now, so this is fine - if we start using more option types later consider revising
        conStr = conStr.concat(`${chalk.green(option.name)} - ${chalk.green(option.value?.replace(sanitize, '')?.trim())}, `);
      } else { conStr = conStr.concat(`${chalk.green(option.name)} - ${chalk.green(option.value)}, `); }
    }
  }
  // for file
  let logStr = `Guild: ${interaction.member.guild.name.replace(sanitize, '').trim()}(${interaction.guildId}), User: ${interaction.user.username.replace(sanitize, '').trim()}#${interaction.user.discriminator}(${interaction.user.id}), Command: ${interaction.commandName}, ID: ${interaction.id}`;
  if (interaction.options._subcommand) {
    logStr = logStr.concat(`Subcommand: ${interaction.options._subcommand}, `);
  }
  if (interaction.options._hoistedOptions.length) {
    logStr = logStr.concat(', Options: ');
    for (const option of interaction.options._hoistedOptions) {
      if (option.type == 'STRING') { // Don't forget to fix this too
        logStr = logStr.concat(`${option.name} - ${option.value.replace(sanitize, '').trim()}, `);
      } else { logStr = logStr.concat(`${option.name} - ${option.value}, `); }
    }
  }
  console.log(`${chalk.yellow(currentDT())} - ${chalk.bold.magenta('COMMAND')} - ${conStr}`);
  fs.writeFile('./logs/all.log', `${currentDT()} - ${'COMMAND'} - ${logStr}\n`, { flag: 'a' }, err => {
    if (err) {
      console.error(err);
      return;
    }
  });
}

async function logComponent(interaction) {
  // takes an interaction, logs relevant details to file and console
  // for console
  let conStr = `Guild: ${chalk.blue(interaction.member.guild.name.replace(sanitize, '').trim())}, User: ${chalk.blue(`${interaction.user.username.replace(sanitize, '').trim()}#${interaction.user.discriminator}`)}, Source: ${chalk.cyan(interaction.message.interaction.commandName)}, Type: ${chalk.cyan(interaction.componentType)}, ID: ${chalk.cyan(interaction.customId)}`;
  // for file
  let logStr = `Guild: ${interaction.member.guild.name.replace(sanitize, '').trim()}(${interaction.guildId}), User: ${interaction.user.username.replace(sanitize, '').trim()}#${interaction.user.discriminator}(${interaction.user.id}), Source: ${interaction.message.interaction.commandName}(${interaction.message.interaction.id}), Type: ${interaction.componentType}, ID: ${interaction.customId}`;
  if (interaction.componentType == 'SELECT_MENU') {
    logStr = logStr.concat(', Values: ');
    conStr = conStr.concat(', Values: ');
    interaction.values.forEach(element => {
      logStr = logStr.concat(element);
      conStr = conStr.concat(element);
    });
  }
  console.log(`${chalk.yellow(currentDT())} - ${chalk.bold.magenta('COMPONENT')} - ${conStr}`);
  fs.writeFile('./logs/all.log', `${currentDT()} - ${'COMPONENT'} - ${logStr}\n`, { flag: 'a' }, err => {
    if (err) {
      console.error(err);
      return;
    }
  });
}

exports.logLine = logLine;
exports.logCommand = logCommand;
exports.logComponent = logComponent;