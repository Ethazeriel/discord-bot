import fs from 'fs';
import crypto from 'crypto';
import { Client, Collection, Intents } from 'discord.js';
const { discord, internal, functions } = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url)));
const token = discord.token;
import { logLine, logCommand, logComponent, logDebug } from './logger.js';
import * as database from './database.js';
import chalk from 'chalk';
import Player from './player.js';
import Translator from './translate.js';
import validator from 'validator';

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_PRESENCES, Intents.FLAGS.GUILD_MESSAGES] });

// dynamic import of commands, buttons, select menus
client.commands = new Collection();
const commandFiles = fs.readdirSync(new URL('./interactions/commands', import.meta.url)).filter(file => file.endsWith('.js'));
let commandHash = '';
for (const file of commandFiles) {
  commandHash = commandHash.concat(crypto.createHash('sha256').update(fs.readFileSync(new URL(`./interactions/commands/${file}`, import.meta.url))).digest('base64'));
  const command = await import(`./interactions/commands/${file}`);
  client.commands.set(command.data.name, command);
}
const contexts = new Collection();
const contextFiles = fs.readdirSync(new URL('./interactions/contexts', import.meta.url)).filter(file => file.endsWith('.js'));
for (const file of contextFiles) {
  commandHash = commandHash.concat(crypto.createHash('sha256').update(fs.readFileSync(new URL(`./interactions/contexts/${file}`, import.meta.url))).digest('base64'));
  const context = await import(`./interactions/contexts/${file}`);
  contexts.set(context.data.name, context);
}
const buttons = new Collection();
const buttonFiles = fs.readdirSync(new URL('./interactions/buttons', import.meta.url)).filter(file => file.endsWith('.js'));
for (const file of buttonFiles) {
  const button = await import(`./interactions/buttons/${file}`);
  buttons.set(button.name, button);
}
const selects = new Collection();
const selectFiles = fs.readdirSync(new URL('./interactions/selects', import.meta.url)).filter(file => file.endsWith('.js'));
for (const file of selectFiles) {
  const select = await import(`./interactions/selects/${file}`);
  selects.set(select.name, select);
}


// When the client is ready, run this code (only once)
client.once('ready', async () => {

  // deploy commands, if necessary
  const hashash = crypto.createHash('sha256').update(commandHash).digest('base64');
  if (hashash !== internal?.deployedHash) {
    const deploy = await import('./deploy.js');
    await deploy.deploy();
    const config = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url)));
    config.internal ? config.internal.deployedHash = hashash : config.internal = { deployedHash: hashash };
    fs.writeFileSync(new URL('./config.json', import.meta.url), JSON.stringify(config, '', 2));
  } else { logLine('info', [`Commands appear up to date; hash is ${hashash}`]); }

  logDebug(chalk.red.bold('DEBUG MODE ACTIVE'));
  logLine('info', ['Ready!', `Node version: ${process.version}`]);
  database.printCount();

  if (functions.web) { // this is bad code because it doesn't let things load asynchronously; consider revising
    import('./webserver.js');
  }

  for (const [id, guild] of client.guilds._cache) {
    logDebug(`Checking users for ${id}`);
    for (const [userid, member] of guild.members._cache) {
      // if (member.user.username === 'Ethazeriel') {console.log(member.user);}
      const user = await database.getUser(userid);
      if (!user) {
        logDebug(`New user with ID ${userid}, username ${member.user.username}, discrim ${member.user.discriminator}, nickname ${member.nickname}`);
        await database.newUser({ id:userid, username:member.user.username, nickname:member.nickname, discriminator:member.user.discriminator, guild:id, locale:member.user?.locale });
      } else {
        if (user.discord.username.current !== member.user.username) { await database.updateUser(userid, 'username', member.user.username); }
        if (user.discord.discriminator.current !== member.user.discriminator) { await database.updateUser(userid, 'discriminator', member.user.discriminator); }
        if (user.discord.nickname[id]?.current !== member.nickname) { await database.updateUser(userid, 'nickname', member.nickname, id); }
        // if (user.discord.locale !== member.user?.locale) { await database.updateUser(userid, 'locale', member.user?.locale); }
        // discord never actually sends us this, but will keep the code here just in case they do someday
      }
    }
  }
});

// handle interactions
client.on('interactionCreate', async interaction => {
  // console.log(interaction);
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      logCommand(interaction);
      await command.execute(interaction);
    } catch (error) {
      logLine('error', [error.stack]);
      return interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  } else if (interaction.isSelectMenu()) {
    logComponent(interaction);
    const selectMenu = selects.get(interaction.customId);
    try {
      await selectMenu.execute(interaction);
    } catch (error) {
      logLine('error', [error.stack]);
      return interaction.editReply({ content: 'There was an error while processing this select menu!', components: [], ephemeral: true });
    }
  } else if (interaction.isButton()) {
    logComponent(interaction);
    const match = interaction.customId.match(/([A-z]*)[-]([A-z]*)/);
    const buttonPress = buttons.get(match[1]);
    try {
      await buttonPress.execute(interaction, match[2]);
    } catch (error) {
      logLine('error', [error.stack]);
      return interaction.editReply({ content: 'There was an error while processing this button press!', components: [], ephemeral: true });
    }
  } else if (interaction.isContextMenu()) {
    const context = contexts.get(interaction.commandName);
    if (!context) return;
    try {
      logCommand(interaction);
      await context.execute(interaction);
    } catch (error) {
      logLine('error', [error.stack]);
      return interaction.followUp({ content: 'There was an error while executing this context menu!', ephemeral: true });
    }
  } else {return;}
});

client.on('guildMemberUpdate', async (oldUser, member) => {
  logLine('info', ['Received guild member update']);
  const user = await database.getUser(member.user.id);
  if (!user) {
    logDebug(`New user with ID ${member.user.id}, username ${member.user.username}, discrim ${member.user.discriminator}, nickname ${member.nickname}`);
    await database.newUser({ id:member.user.id, username:member.user.username, nickname:member.nickname, discriminator:member.user.discriminator, guild:member.guild.id, locale:member.user?.locale });
  } else {
    if (user.discord.username.current !== member.user.username) { await database.updateUser(member.user.id, 'username', member.user.username); }
    if (user.discord.discriminator.current !== member.user.discriminator) { await database.updateUser(member.user.id, 'discriminator', member.user.discriminator); }
    if (user.discord.nickname[member.guild.id].current !== member.nickname) { await database.updateUser(member.user.id, 'nickname', member.nickname, member.guild.id); }
    // if (user.discord.locale !== member.user?.locale) { await database.updateUser(member.user.id, 'locale', member.user?.locale); }
  }
});

client.on('guildMemberAdd', async member => {
  logLine('info', ['New user arrived']);
  const user = await database.getUser(member.user.id);
  if (!user) {
    logDebug(`New user with ID ${member.user.id}, username ${member.user.username}, discrim ${member.user.discriminator}, nickname ${member.nickname}`);
    await database.newUser({ id:member.user.id, username:member.user.username, nickname:member.nickname, discriminator:member.user.discriminator, guild:member.guild.id, locale:member.user?.locale });
  }
});

client.on('userUpdate', async (oldUser, newUser) => {
  logLine('info', [`Received global user update for ${newUser.id}`]);
  const user = await database.getUser(newUser.id);
  if (!user) {
    await database.newUser({ id:newUser.id, username:newUser.username, discriminator:newUser.discriminator });
  } else {
    if (user.discord.username.current !== newUser.username) { await database.updateUser(newUser.id, 'username', newUser.username); }
    if (user.discord.discriminator.current !== newUser.discriminator) { await database.updateUser(newUser.id, 'discriminator', newUser.discriminator); }
    // if (user.discord.locale !== newUser?.locale) { await database.updateUser(newUser.id, 'locale', newUser?.locale); }
  }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  Player.voiceEventDispatch(oldState, newState, client);
});

client.on('messageCreate', async message => {
  logDebug(`${chalk.blue(message.author.username)}: ${validator.escape(validator.stripLow(message.content || '')).trim()}`);
  if (!message.author.bot) { Translator.messageEventDispatch(message); }
});

// Login to Discord
client.login(token);

// handle exits
process.on('SIGINT' || 'SIGTERM', async () => {
  logLine('info', ['received termination command, exiting']);
  await database.closeDB();
  process.exit();
});