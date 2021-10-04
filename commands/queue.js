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
      .setDescription('Toggles queue looping')),


  async execute(interaction) {
    if (interaction.member.roles.cache.some(role => role.name === 'DJ')) {
      switch (interaction.options.getSubcommand()) {

      case 'skip': {

        let track = null;

        track = {
          title: 'Silence',
          artist: 'Eth',
          album: 'ethsound',
          url: '../empty.mp3',
          albumart: 'albumart/albumart.jpg',
        };

        music.createVoiceConnection(interaction);
        music.playLocalTrack(track);
        await interaction.reply({ content:'Skipped.' });
        break;
      }

      case 'showqueue': {
        const track = music.getCurrentTrack();
        let page = interaction.options.getInteger('page');
        if (page == null) {page = 1;}

        if (track != null) {
          utils.generateQueueEmbed(interaction, track, music.queue, 'Current Queue:', page);
        } else {
          await interaction.reply({ content:'unable to get the current queue.', ephemeral: true });
        }
        break;
      }

      case 'remove': {
        music.removeTrack(interaction.options.getInteger('track') - 1);
        await interaction.reply(`Removed item ${interaction.options.getInteger('track')} from the queue.`);
        break;
      }

      case 'loop': {
        const status = music.toggleLoop();
        if (status == true) {
          await interaction.reply({ content:'Enabled Queue Loop.' });
        } else {await interaction.reply({ content:'Disabled Queue Loop.' });}
        break;
      }

      default: {
        console.log('OH NO SOMETHING\'S FUCKED');
        await interaction.reply({ content:'Something broke. Please try again', ephemeral: true });
      }

      }
    } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
  },
};