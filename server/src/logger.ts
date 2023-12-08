/* eslint-disable no-console */
import fs from 'fs';
import chalk from 'chalk';
import { sanitize } from './regexes.js';
import { fileURLToPath, URL } from 'url';
const debugMode = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../config.json', import.meta.url).toString()), 'utf-8')).debug;
import { isMainThread } from 'worker_threads';
import { ButtonInteraction, CommandInteraction, MessageContextMenuCommandInteraction, GuildMember, MessageInteraction, StringSelectMenuInteraction, ComponentType } from 'discord.js';

if (!fs.existsSync('../logs')) {
  fs.mkdirSync('../logs');
}


function currentDT():string {
  const date = new Date();
  let month = (date.getMonth() + 1).toString();
  if (month.length == 1) {month = '0' + month;}
  let day = date.getDate().toString();
  if (day.length == 1) {day = '0' + day;}
  let hour = date.getHours().toString();
  if (hour.length == 1) {hour = '0' + hour;}
  let minute = date.getMinutes().toString();
  if (minute.length == 1) {minute = '0' + minute;}
  let second = date.getSeconds().toString();
  if (second.length == 1) {second = '0' + second;}
  return `[${date.getFullYear()}-${month}-${day}|${hour}:${minute}:${second}]`;
}

export async function log(level:string, args:string[]) {
  level = level.toUpperCase();
  let logStr = '';
  for (let i = 0; i < args.length; i++) {
    logStr = logStr.concat(args[i] + ' ');
  }
  switch (level) {
    case 'INFO':
      console.log(`${chalk.yellow(currentDT())} - ${chalk.bold.blue(level)} - ${logStr}`);
      fs.writeFile(fileURLToPath(new URL('../logs/all.log', import.meta.url).toString()), `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
        if (err) {
          console.error(err);
          return;
        }
      });
      break;

    case 'TRACK':
      console.log(`${chalk.yellow(currentDT())} - ${chalk.bold.green(level)} - ${logStr}`);
      fs.writeFile(fileURLToPath(new URL('../logs/all.log', import.meta.url).toString()), `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
        if (err) {
          console.error(err);
          return;
        }
      });
      break;

    case 'FETCH':
      console.log(`${chalk.yellow(currentDT())} - ${chalk.hex('#FF7F00').bold(level)} - ${logStr}`);
      fs.writeFile(fileURLToPath(new URL('../logs/all.log', import.meta.url).toString()), `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
        if (err) {
          console.error(err);
          return;
        }
      });
      break;

    case 'DATABASE':
      console.log(`${chalk.yellow(currentDT())} - ${chalk.bold.cyan(level)} - ${logStr}`);
      fs.writeFile(fileURLToPath(new URL('../logs/all.log', import.meta.url).toString()), `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
        if (err) {
          console.error(err);
          return;
        }
      });
      break;

    case 'ERROR':
      console.error(`${chalk.yellow(currentDT())} - ${isMainThread ? chalk.blue('M') : chalk.green('W')} - ${chalk.bold.red(level)} - ${logStr}`);
      fs.writeFile(fileURLToPath(new URL('../logs/all.log', import.meta.url).toString()), `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
        if (err) {
          console.error(err);
          return;
        }
      });
      fs.writeFile(fileURLToPath(new URL('../logs/error.log', import.meta.url).toString()), `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
        if (err) {
          console.error(err);
          return;
        }
      });
      break;

    default:
      console.log(`${chalk.yellow(currentDT())} - ${chalk.bold.magenta(level)} - ${logStr}`);
      fs.writeFile(fileURLToPath(new URL('../logs/all.log', import.meta.url).toString()), `${currentDT()} - ${level} - ${logStr}\n`, { flag: 'a' }, err => {
        if (err) {
          console.error(err);
          return;
        }
      });
      break;
  }

}

export async function logCommand(interaction:(CommandInteraction | MessageContextMenuCommandInteraction) & {options:any}) {
  // TS - I'm using a bunch of things that don't exist in discord.js types, so have to include the any
  // takes an interaction, logs relevant details to file and console
  // for console
  let conStr = `Guild: ${chalk.blue(interaction.guildId ? (interaction.member as GuildMember).guild.name.replace(sanitize, '').trim() : 'DM')}, User: ${chalk.blue(`${interaction.user.username.replace(sanitize, '').trim()}#${interaction.user.discriminator}`)}, Command: ${chalk.cyan(interaction.commandName)}`;
  if (interaction.options._subcommand) {
    conStr = conStr.concat(`, Subcommand: ${chalk.green(interaction.options._subcommand)}`);
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
  let logStr = `Guild: ${interaction.guildId ? (interaction.member as GuildMember).guild.name.replace(sanitize, '').trim() : 'DM'}(${interaction.guildId ? interaction.guildId : 'no id'}), User: ${interaction.user.username.replace(sanitize, '').trim()}#${interaction.user.discriminator}(${interaction.user.id}), Command: ${interaction.commandName}, ID: ${interaction.id}`;
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
  fs.writeFile(fileURLToPath(new URL('../logs/all.log', import.meta.url).toString()), `${currentDT()} - ${'COMMAND'} - ${logStr}\n`, { flag: 'a' }, err => {
    if (err) {
      console.error(err);
      return;
    }
  });
}

export async function logComponent(interaction:ButtonInteraction | StringSelectMenuInteraction) {
  // takes an interaction, logs relevant details to file and console
  // for console
  let conStr = `Guild: ${chalk.blue((interaction.member as GuildMember).guild.name.replace(sanitize, '').trim())}, User: ${chalk.blue(`${interaction.user.username.replace(sanitize, '').trim()}#${interaction.user.discriminator}`)}, Source: ${chalk.cyan((interaction.message.interaction as MessageInteraction)?.commandName || 'component')}, Type: ${chalk.cyan(interaction.componentType)}, ID: ${chalk.cyan(interaction.customId)}`;
  // for file
  let logStr = `Guild: ${(interaction.member as GuildMember).guild.name.replace(sanitize, '').trim()}(${interaction.guildId}), User: ${interaction.user.username.replace(sanitize, '').trim()}#${interaction.user.discriminator}(${interaction.user.id}), Source: ${(interaction.message.interaction as MessageInteraction)?.commandName || 'component'}(${interaction.message.id}), Type: ${interaction.componentType}, ID: ${interaction.customId}`;
  if (interaction.componentType == ComponentType.SelectMenu) {
    logStr = logStr.concat(', Values: ');
    conStr = conStr.concat(', Values: ');
    interaction.values.forEach((element:string) => {
      logStr = logStr.concat(element);
      conStr = conStr.concat(element);
    });
  }
  console.log(`${chalk.yellow(currentDT())} - ${chalk.bold.magenta('COMPONENT')} - ${conStr}`);
  fs.writeFile(fileURLToPath(new URL('../logs/all.log', import.meta.url).toString()), `${currentDT()} - ${'COMPONENT'} - ${logStr}\n`, { flag: 'a' }, err => {
    if (err) {
      console.error(err);
      return;
    }
  });
}

export async function logDebug(...message:any) {
  if (debugMode) {
    let logStr = '';
    for (let i = 0; i < message.length; i++) {
      logStr = logStr.concat(message[i] + ' ');
    }
    console.log(`${chalk.yellow(currentDT())} - ${isMainThread ? chalk.blue('M') : chalk.green('W')} - ${chalk.bold.yellow('DEBUG')} - ${logStr}`);
  }
}

export async function logLine() {
  console.log();
}
