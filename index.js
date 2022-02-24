const fs = require('fs');
// Require the necessary discord.js classes
const { Client, Collection, Intents } = require('discord.js');
const { token } = require('./config.json').discord;
const { logLine, logCommand, logComponent, logDebug } = require('./logger.js');
// const { leaveVoice } = require('./music');
const database = require('./database.js');
const chalk = require('chalk');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES] });

// dynamic import of commands, buttons, select menus
client.commands = new Collection();
const commandFiles = fs.readdirSync('./interactions/commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./interactions/commands/${file}`);
  client.commands.set(command.data.name, command);
}
const buttons = new Collection();
const buttonFiles = fs.readdirSync('./interactions/buttons').filter(file => file.endsWith('.js'));
for (const file of buttonFiles) {
  const button = require(`./interactions/buttons/${file}`);
  buttons.set(button.name, button);
}
const selects = new Collection();
const selectFiles = fs.readdirSync('./interactions/selects').filter(file => file.endsWith('.js'));
for (const file of selectFiles) {
  const select = require(`./interactions/selects/${file}`);
  selects.set(select.name, select);
}


// When the client is ready, run this code (only once)
client.once('ready', async () => {
  logDebug(chalk.red.bold('DEBUG MODE ACTIVE'));
  logLine('info', ['Ready!', `Node version: ${process.version}`]);
  database.printCount();
  // console.log(client);
  for (const [id, guild] of client.guilds._cache) {
    logDebug(`Checking users for ${id}`);
    for (const [userid, member] of guild.members._cache) {
      // if (member.user.username === 'Ethazeriel') {console.log(member.user);}
      const user = await database.getUser(userid);
      if (!user) {
        logDebug(`New user with ID ${userid}, username ${member.user.username}, discrim ${member.user.discriminator}, nickname ${member.nickname}`);
        await database.newUser({ id:userid, username:member.user.username, nickname:member.nickname, discriminator:member.user.discriminator, guild:id, locale:member.user?.locale });
      } else {
        if (user.discord.username.current !== member.user.username) {
          await database.updateUser(userid, 'username', member.user.username);
        }
        if (user.discord.discriminator.current !== member.user.discriminator) {
          await database.updateUser(userid, 'discriminator', member.user.discriminator);
        }
        if (user.discord.nickname[id]?.current !== member.nickname) {
          await database.updateUser(userid, 'nickname', member.nickname, id);
        }
        // if (user.discord.locale !== member.user?.locale) {
        // discord never actually sends us this, but will keep the code here just in case they do someday
        //   await database.updateUser(userid, 'locale', member.user?.locale);
        // }
      }
    }
  }
});

// handle interactions
client.on('interactionCreate', async interaction => {
  // console.log(interaction);
  // if (!interaction.isCommand() || !interaction.isSelectMenu()) return;
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
      return interaction.update({ content: 'There was an error while processing this select menu!', components: [], ephemeral: true });
    }
  } else if (interaction.isButton()) {
    logComponent(interaction);
    const match = interaction.customId.match(/([A-z]*)[-]([A-z]*)/);
    const buttonPress = buttons.get(match[1]);
    try {
      await buttonPress.execute(interaction, match[2]);
    } catch (error) {
      logLine('error', [error.stack]);
      return interaction.update({ content: 'There was an error while processing this button press!', components: [], ephemeral: true });
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
    if (user.discord.username.current !== member.user.username) {
      await database.updateUser(member.user.id, 'username', member.user.username);
    }
    if (user.discord.discriminator.current !== member.user.discriminator) {
      await database.updateUser(member.user.id, 'discriminator', member.user.discriminator);
    }
    if (user.discord.nickname[member.guild.id].current !== member.nickname) {
      await database.updateUser(member.user.id, 'nickname', member.nickname, member.guild.id);
    }
    // if (user.discord.locale !== member.user?.locale) {
    //   await database.updateUser(member.user.id, 'locale', member.user?.locale);
    // }
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
    if (user.discord.username.current !== newUser.username) {
      await database.updateUser(newUser.id, 'username', newUser.username);
    }
    if (user.discord.discriminator.current !== newUser.discriminator) {
      await database.updateUser(newUser.id, 'discriminator', newUser.discriminator);
    }
    // if (user.discord.locale !== newUser?.locale) {
    //   await database.updateUser(newUser.id, 'locale', newUser?.locale);
    // }
  }
});

// Login to Discord
client.login(token);

// handle exits
process.on('SIGINT' || 'SIGTERM', async () => {
  logLine('info', ['received termination command, exiting']);
  await database.closeDB();
  process.exit();
});