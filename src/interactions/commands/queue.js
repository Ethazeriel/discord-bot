import { SlashCommandBuilder } from '@discordjs/builders';
import Player from '../../player.js';
import { logLine } from '../../logger.js';
import * as db from '../../database.js';
import { seekTime as seekRegex } from '../../regexes.js';
import validator from 'validator';
import fs from 'fs';
const { discord } = JSON.parse(fs.readFileSync(new URL('../../../config.json', import.meta.url)));
const roles = discord.roles;

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
    .addStringOption(option => option
      .setName('time').setDescription('Time in track').setRequired(true)))
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
    .setDescription('Empties the queue'))
  .addSubcommand(subcommand => subcommand
    .setName('recall')
    .setDescription('Reloads the previous session'));


export async function execute(interaction) {

  if (interaction.member?.roles?.cache?.some(role => role.name === roles.dj)) {
    await interaction.deferReply({ ephemeral: true });

    const player = await Player.getPlayer(interaction);
    if (player) {
      switch (interaction.options.getSubcommand()) {
        case 'show': {
          if (player.getQueue().length) {
            const page = Math.abs(interaction.options.getInteger('page')) || undefined;
            const queueEmbed = await player.queueEmbed(undefined, page);
            interaction.message = await interaction.editReply(queueEmbed);
            player.register(interaction, 'queue', queueEmbed);
          } else { player.decommission(interaction, 'queue', await player.queueEmbed(undefined, undefined, false), 'Queue is empty.'); }
          break;
        }

        case 'prev': {
          if (player.getQueue().length) {
            await player.prev();
            const mediaEmbed = await player.mediaEmbed();
            const queueEmbed = await player.queueEmbed();
            await Promise.all([player.register(interaction, 'media', mediaEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
          } else { player.decommission(interaction, 'queue', await player.queueEmbed(undefined, undefined, false), 'Queue is empty.'); }
          break;
        }

        case 'next': {
          if (player.getQueue().length) {
            if (player.getCurrent()) {
              await player.next();
              const mediaEmbed = await player.mediaEmbed();
              const queueEmbed = await player.queueEmbed();
              await Promise.all([player.register(interaction, 'media', mediaEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
            } else { await interaction.editReply({ content: 'Queue is over, and not set to loop.' }); } // rework; next on ended queue should restart
          } else { player.decommission(interaction, 'queue', await player.queueEmbed(undefined, undefined, false), 'Queue is empty.'); }
          break;
        }

        case 'jump': {
          if (player.getQueue().length) {
            await player.jump(Math.abs((interaction.options.getInteger('position') || 1) - 1));
            const mediaEmbed = await player.mediaEmbed();
            const queueEmbed = await player.queueEmbed();
            await Promise.all([player.register(interaction, 'media', mediaEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
          } else { player.decommission(interaction, 'queue', await player.queueEmbed(undefined, undefined, false), 'Queue is empty.'); }
          break;
        }

        case 'seek': {
          if (player.getQueue().length) {
            const track = player.getCurrent();
            const usrtime = validator.escape(validator.stripLow(interaction.options.getString('time'))).trim();
            if (!seekRegex.test(usrtime)) { await interaction.editReply({ content: 'That doesn\'t look like a valid timestamp.' }); } else {
              const match = usrtime.match(seekRegex);
              let time = Number(match[3]);
              if (match[1] && !match[2]) { match[2] = match[1], match[1] = null; }
              if (match[2]) {time = (Number(match[2]) * 60) + time;}
              if (match[1]) {time = (Number(match[1]) * 3600) + time;}

              if (time > track.youtube.duration) { await interaction.editReply({ content: 'You can\'t seek beyond the end of a track.' });} else {
                await player.seek(time);
                const mediaEmbed = await player.mediaEmbed(true, 'Seeking...');
                const queueEmbed = await player.queueEmbed();
                await Promise.all([player.register(interaction, 'media', mediaEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
              }
            }
          } else { player.decommission(interaction, 'queue', await player.queueEmbed(undefined, undefined, false), 'Queue is empty.'); }
          break;
        }

        case 'play-pause': {
          if (player.getQueue().length) {
            if (player.getCurrent()) {
              player.togglePause();
              const mediaEmbed = await player.mediaEmbed();
              const queueEmbed = await player.queueEmbed();
              await Promise.all([player.register(interaction, 'media', mediaEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
            } else { await interaction.editReply({ content: 'Queue is over.' }); } // rework; play-pause on ended queue should restart
          } else { player.decommission(interaction, 'queue', await player.queueEmbed(undefined, undefined, false), 'Queue is empty.'); }
          break;
        }

        case 'loop': {
          if (player.getQueue().length) {
            if (player.getCurrent()) {
              await player.toggleLoop();
              const queueEmbed = await player.queueEmbed();
              await Promise.all([player.register(interaction, 'queue', queueEmbed), player.sync(interaction, 'queue', queueEmbed)]);
            } else {
              await player.toggleLoop();
              const mediaEmbed = await player.mediaEmbed();
              const queueEmbed = await player.queueEmbed();
              await Promise.all([player.register(interaction, 'queue', queueEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
            }
          } else { player.decommission(interaction, 'queue', await player.queueEmbed(undefined, undefined, false), 'Queue is empty.'); }
          break;
        }

        case 'shuffle': {
          if (player.getQueue().length) {
            if (player.getCurrent()) {
              player.shuffle({ albumAware: (interaction.options.getInteger('album-aware') == 1) });
              const queueEmbed = await player.queueEmbed();
              await Promise.all([player.register(interaction, 'queue', queueEmbed), player.sync(interaction, 'queue', queueEmbed)]);
            } else {
              player.shuffle({ albumAware: (interaction.options.getInteger('album-aware') == 1) });
              const mediaEmbed = await player.mediaEmbed();
              const queueEmbed = await player.queueEmbed();
              await Promise.all([player.register(interaction, 'queue', queueEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
            }
          } else { player.decommission(interaction, 'queue', await player.queueEmbed(undefined, undefined, false), 'Queue is empty.'); }
          break;
        }

        case 'remove': {
          if (player.getQueue().length) { // TO DO: don\'t correct for input of 0, give error instead
            const position = Math.abs((interaction.options.getInteger('position') || 1) - 1);
            const removed = await player.remove(position); // we'll be refactoring remove later
            await interaction.editReply({ content: (removed.length) ? `Removed: ${(removed[0].spotify.name || removed[0].youtube.name)}` : 'Remove failed. Most likely your input is too high.' });

            if (position == player.getPlayhead()) {
              const mediaEmbed = await player.mediaEmbed();
              const queueEmbed = await player.queueEmbed();
              player.sync(interaction, 'media', queueEmbed, mediaEmbed);
            } else {
              const queueEmbed = await player.queueEmbed();
              player.sync(interaction, 'queue', queueEmbed);
            }
          } else { player.decommission(interaction, 'queue', await player.queueEmbed(undefined, undefined, false), 'Queue is empty.'); }
          break;
        }

        case 'empty': {
          player.empty();
          await interaction.editReply({ content: 'Emptied Queue.' });

          const mediaEmbed = await player.mediaEmbed();
          const queueEmbed = await player.queueEmbed();
          player.sync(interaction, 'media', queueEmbed, mediaEmbed);
          break;
        }

        case 'recall': {
          if (!player.getQueue().length) {
            const result = await db.getStash(interaction.user.id);
            if (result.tracks.length) {
              player.queue.tracks = result.tracks;
              await player.jump(result.playhead);
              const mediaEmbed = await player.mediaEmbed();
              const queueEmbed = await player.queueEmbed(`Recalled ${result.tracks.length} tracks:`, Math.ceil((player.getPlayhead() + 1) / 10));
              await Promise.all([player.register(interaction, 'queue', queueEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
            } else { await interaction.editReply({ content: 'Your stash is empty.' }); }
          } else { await interaction.editReply({ content: 'This command can only be called with an empty queue.' }); }
          break;
        }

        default: {
          logLine('error', ['OH NO SOMETHING\'S FUCKED']);
          await interaction.editReply({ content: 'Something broke. Please try again' });
        }

      }
    }
  } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
}