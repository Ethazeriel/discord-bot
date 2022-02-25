import { SlashCommandBuilder } from '@discordjs/builders';
import Player from '../../player.js';
import { logLine } from '../../logger.js';

export const data = new SlashCommandBuilder()
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
      .setName('album-aware').setDescription('Should shuffle keep albums in order?')
      .addChoice('No', 0)
      .addChoice('Yes', 1)))
  .addSubcommand(subcommand => subcommand
    .setName('remove')
    .setDescription('Remove current or specified track from the queue')
    .addIntegerOption(option => option
      .setName('position').setDescription('Remove the current song, or go on to specify a position in the queue')))
  .addSubcommand(subcommand => subcommand
    .setName('empty')
    .setDescription('Empties the queue'));


export async function execute(interaction) {

  if (interaction.member?.roles?.cache?.some(role => role.name === 'DJ')) {
    await interaction.deferReply({ ephemeral: true });

    const player = await Player.getPlayer(interaction);
    if (player) {
      switch (interaction.options.getSubcommand()) {
        case 'show': {
          if (player.getQueue().length) {
            const page = Math.abs(interaction.options.getInteger('page')) || 1;
            const embed = await player.queueEmbed('Current Queue:', page);
            interaction.message = await interaction.followUp(embed);
            player.register(interaction, 'queue', embed);
          } else { await interaction.followUp({ content: 'Queue is empty.' }); }
          break;
        }

        case 'prev': {
          if (player.getQueue().length) {
            await player.prev();
            const embed = player.mediaEmbed();
            await Promise.all([player.register(interaction, 'media', embed), player.sync(interaction, 'media', embed)]);
          } else { await interaction.followUp({ content: 'Queue is empty.' }); }
          break;
        }

        case 'next': {
          const length = player.getQueue().length;
          if (length) {
            if (length == player.getPlayhead()) {
              await interaction.followUp({ content: 'Queue is over, and not set to loop.' });
              return;
            }
            await player.next();
            const embed = player.mediaEmbed();
            await Promise.all([player.register(interaction, 'media', embed), player.sync(interaction, 'media', embed)]);
          } else { await interaction.followUp({ content: 'Queue is empty.' }); }
          break;
        }

        case 'jump': {
          if (player.getQueue().length) {
            await player.jump(Math.abs((interaction.options.getInteger('position') || 1) - 1));
            const embed = player.mediaEmbed();
            await Promise.all([player.register(interaction, 'media', embed), player.sync(interaction, 'media', embed)]);
          } else { await interaction.followUp({ content: 'Queue is empty.' }); }
          break;
        }

        case 'seek': {
          await interaction.followUp({ content: 'Not implemented yet.' });
          break;
        }

        case 'play-pause': {
          const length = player.getQueue().length;
          if (length) {
            if (length == player.getPlayhead()) {
              await interaction.followUp({ content: 'Queue is over.' });
              return;
            }
            player.togglePause();
            const embed = player.mediaEmbed();
            await Promise.all([player.register(interaction, 'media', embed), player.sync(interaction, 'media', embed)]);
          } else { await interaction.followUp({ content: 'Queue is empty.' }); }
          break;
        }

        case 'loop': {
          await player.toggleLoop();
          await Promise.all([player.register(interaction, 'queue'), player.sync(interaction, 'queue')]);
          break;
        }

        case 'shuffle': {
          const length = player.getQueue().length;
          if (length) {
            if (length == player.getPlayhead()) {
              await interaction.followUp({ content: 'Queue is over.' });
              return;
            }
            const embed = await player.queueEmbed('Current Queue:', Math.ceil((player.getPlayhead() + 1) / 10));
            player.shuffle({ albumAware: (interaction.options.getInteger('album-aware') == 1) });
            await Promise.all([player.register(interaction, 'queue', embed), player.sync(interaction, 'queue')]);
          } else { await interaction.followUp({ content: 'Queue is empty.' }); }
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
}