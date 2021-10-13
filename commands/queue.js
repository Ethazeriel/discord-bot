const { SlashCommandBuilder } = require('@discordjs/builders');
const music = require('../music.js');
const utils = require('../utils.js');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('queue related functions')
    .addSubcommand(subcommand => subcommand
      .setName('skip')
      .setDescription('skips the currently running song'))
    .addSubcommand(subcommand => subcommand
      .setName('show')
      .setDescription('Prints the current queue')
      .addIntegerOption(option =>
        option.setName('page').setDescription('Page to show').setRequired(false)))
    .addSubcommand(subcommand => subcommand
      .setName('remove')
      .setDescription('remove a track from the queue')
      .addIntegerOption(option =>
        option.setName('track').setDescription('Track to remove').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('loop')
      .setDescription('Toggles queue looping'))
    .addSubcommand(subcommand => subcommand
      .setName('empty')
      .setDescription('Empties the queue')),


  async execute(interaction) {
    console.log(`Recieved command from ${interaction.member} with name ${interaction.commandName}, subcommand ${interaction.options.getSubcommand()} and options page: ${interaction.options.getString('page')}, track: ${interaction.options.getString('track')}`);
    if (interaction.member.roles.cache.some(role => role.name === 'DJ')) {
      await interaction.deferReply({ ephemeral: true });
      switch (interaction.options.getSubcommand()) {

      case 'skip': {
        music.skipTrack();
        await interaction.followUp({ content:'Skipped.' });
        break;
      }

      case 'show': {
        const track = music.getCurrentTrack();
        let page = interaction.options.getInteger('page');
        if (page == null) {page = 1;}

        if (track != null) {
          utils.generateQueueEmbed(interaction, track, music.queue, 'Current Queue:', page);
        } else {
          await interaction.followUp({ content:'unable to get the current queue.', ephemeral: true });
        }
        break;
      }

      case 'remove': {
        music.removeTrack(interaction.options.getInteger('track') - 1);
        await interaction.followUp(`Removed item ${interaction.options.getInteger('track')} from the queue.`);
        break;
      }

      case 'loop': {
        const status = music.toggleLoop();
        if (status == true) {
          await interaction.followUp({ content:'Enabled Queue Loop.' });
        } else {await interaction.followUp({ content:'Disabled Queue Loop.' });}
        break;
      }

      case 'empty': {
        music.emptyQueue();
        await interaction.followUp({ content:'Emptied Queue.', ephemeral: true });
        break;
      }

      default: {
        console.log('OH NO SOMETHING\'S FUCKED');
        await interaction.followUp({ content:'Something broke. Please try again', ephemeral: true });
      }

      }
    } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
  },
};