const { SlashCommandBuilder } = require('@discordjs/builders');

// const music = require('../../music.js');
const Player = require('../../player.js');
const utils = require('../../utils.js');
const { logLine, logDebug } = require('../../logger.js');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('queue related functions')
    .addSubcommand(subcommand => subcommand
      .setName('show')
      .setDescription('Prints the queue')
      .addIntegerOption(option => option
        .setName('page').setDescription('Page to show').setRequired(false)))
    .addSubcommand(subcommand => subcommand
      .setName('prev')
      .setDescription('Plays the previous song in the queue'))
    .addSubcommand(subcommand => subcommand
      .setName('next')
      .setDescription('Plays the next song in the queue'))
    .addSubcommand(subcommand => subcommand
      .setName('jump')
      .setDescription('Jumps to a position in the queue')
      .addIntegerOption(option => option
        .setName('position').setDescription('Position in queue').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('seek')
      .setDescription('Move to a time within the current track')
      .addIntegerOption(option => option
        .setName('time').setDescription('Position in queue').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('play-pause')
      .setDescription('Toggles pause'))
    .addSubcommand(subcommand => subcommand
      .setName('loop')
      .setDescription('Toggles looping'))
    .addSubcommand(subcommand => subcommand
      .setName('shuffle')
      .setDescription('Shuffles the queue')
      .addIntegerOption(option => option
        .setName('albums').setDescription('Should shuffle keep albums in order?')
        .addChoice('No', 0)
        .addChoice('Yes', 1)))
    .addSubcommand(subcommand => subcommand
      .setName('remove')
      .setDescription('Remove current or specified track from the queue')
      .addIntegerOption(option => option
        .setName('position').setDescription('Remove the current song, or go on to specify a position in the queue')))
    .addSubcommand(subcommand => subcommand
      .setName('empty')
      .setDescription('Empties the queue')),


  async execute(interaction) {

    if (interaction.member?.roles?.cache?.some(role => role.name === 'DJ')) {
      await interaction.deferReply({ ephemeral: true });

      const player = await Player.getPlayer(interaction);
      if (player) {
        switch (interaction.options.getSubcommand()) {
          case 'show': {
            if (player.getQueue().length) {
              const page = Math.abs(interaction.options.getInteger('page')) || 1;
              const message = await utils.generateQueueEmbed(player, 'Current Queue:', page);
              await interaction.followUp(message);
            } else { await interaction.followUp({ content: 'Queue is empty.' }); }
            break;
          }

          case 'prev': {
            if (player.getQueue().length) {
              const track = await player.prev();
              await interaction.followUp({ content: `Playing: ${(track.spotify.name || track.youtube.name)}` });
            } else { await interaction.followUp({ content: 'Queue is empty.' }); }
            break;
          }

          case 'next': {
            if (player.getQueue().length) {
              const track = await player.next();
              if (track) {
                await interaction.followUp({ content: `Playing: ${(track.spotify.name || track.youtube.name)}` });
              } else { await interaction.followUp({ content: 'Queue is over, and not set to loop.' }); }
            } else { await interaction.followUp({ content: 'Queue is empty.' }); }
            break;
          }

          case 'jump': {
            // player.remove(Math.abs(interaction.options.getInteger('track') - 1));
            if (player.getQueue().length) {
              const track = await player.jump(Math.abs((interaction.options.getInteger('position') || 1) - 1));
              await interaction.followUp({ content: `Playing: ${(track.spotify.name || track.youtube.name)}` });
            } else { await interaction.followUp({ content: 'Queue is empty.' }); }
            break;
          }

          case 'seek': {
            await interaction.followUp({ content: 'Not implemented yet.' });
            break;
          }

          case 'play-pause': {
            if (player.getQueue().length) {
              await interaction.followUp(player.togglePause());
            } else { await interaction.followUp({ content: 'Queue is empty.' }); }
            break;
          }

          case 'loop': {
            const looping = await player.toggleLoop();
            await interaction.followUp({ content: (looping) ? 'Enabled Queue Loop.' : 'Disabled Queue Loop.' });
            break;
          }

          case 'shuffle': {
            await interaction.followUp({ content: 'Not implemented yet.' });
            break;
          }

          case 'remove': {
            if (player.getQueue().length) { // TO DO: don\'t correct for input of 0, give error instead
              const removed = await player.remove(Math.abs((interaction.options.getInteger('position') || 1) - 1)); // was Math.abs(interaction.options.getInteger('track') - 1)
              await interaction.followUp({ content: (removed.length) ? `Removed: ${(removed[0].spotify.name || removed[0].youtube.name)}` : 'Remove failed. Most likely your input is too high.' });
            } else { await interaction.followUp({ content: 'Queue is empty.' }); }
            break;
          }

          case 'empty': {
            player.empty();
            await interaction.followUp({ content: 'Emptied Queue.' });
            break;
          }

          default: {
            logLine('error', ['OH NO SOMETHING\'S FUCKED']);
            await interaction.followUp({ content: 'Something broke. Please try again' });
          }

        }
      }
    } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
  },
};