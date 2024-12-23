import { SlashCommandBuilder } from '@discordjs/builders';
import Player from '../../player.js';
import { chooseAudioSource } from '../../utils.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { log, logDebug } from '../../logger.js';
import * as db from '../../database.js';
import { seekTime as seekRegex } from '../../regexes.js';
import validator from 'validator';
import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import { ChatInputCommandInteraction, GuildMemberRoleManager, Message } from 'discord.js';
const { discord } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));
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
      .addChoices({ name:'No', value:0 }, { name:'Yes', value:1 })))
  .addSubcommand(subcommand => subcommand
    .setName('move') // TODO: probably remove this when done testing
    .setDescription('for testing. move track from position to position (1 indexed)')
    .addIntegerOption(option => option
      .setName('from').setDescription('move from position #').setRequired(true))
    .addIntegerOption(option => option
      .setName('to').setDescription('move to position #').setRequired(true)))
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


export async function execute(interaction:ChatInputCommandInteraction & { message?: Message<boolean> }) {

  if ((interaction.member?.roles as GuildMemberRoleManager)?.cache?.some(role => role.name === roles.dj)) {
    await interaction.deferReply({ ephemeral: true });

    const { player, message } = await Player.getPlayer(interaction);
    if (player) {
      switch (interaction.options.getSubcommand()) {
        case 'show': {
          if (player.getQueue().length) {
            const page = Math.abs(Number(interaction.options.getInteger('page'))) || undefined;
            const queueEmbed = await player.queueEmbed(undefined, page);
            interaction.message = await interaction.editReply(queueEmbed) as Message;
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
            } else { await player.jump(0); }
            const mediaEmbed = await player.mediaEmbed();
            const queueEmbed = await player.queueEmbed();
            await player.register(interaction, 'media', mediaEmbed);
            player.sync(interaction, 'media', queueEmbed, mediaEmbed);
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
            const track = player.getCurrent() ? player.getCurrent() : (await player.prev(false), player.getCurrent());
            if (!track) {throw new Error('nothing playing and no ability to go back one');}
            const usrtime = validator.escape(validator.stripLow(interaction.options.getString('time') || '')).trim();
            if (!seekRegex.test(usrtime)) { await interaction.editReply({ content: 'That doesn\'t look like a valid timestamp.' }); } else {
              const match = usrtime.match(seekRegex);
              let time = Number(match![3]);
              if (match![1] && !match![2]) { match![2] = match![1], match![1] = '0'; }
              if (match![2]) {time = (Number(match![2]) * 60) + time;}
              if (match![1]) {time = (Number(match![1]) * 3600) + time;}

              if (time > chooseAudioSource(track).duration) { await interaction.editReply({ content: 'You can\'t seek beyond the end of a track.' });} else {
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
            } else { player.jump(0); }
            const mediaEmbed = await player.mediaEmbed();
            const queueEmbed = await player.queueEmbed();
            await player.register(interaction, 'media', mediaEmbed);
            player.sync(interaction, 'media', queueEmbed, mediaEmbed);
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

        case 'move': { // TODO: probably remove/ move this to the webserver parent when done testing
          const length = player.getQueue().length;
          if (length > 1) {
            const from = Math.abs((interaction.options.getInteger('from') || 1) - 1);
            let to = Math.abs((interaction.options.getInteger('to') || 1) - 1);
            // per below have decided destination values > length might be intended to be length, while not making any
            // assumptions about what was meant to be moved. but unless this is about to be rejected because from == to
            // (from < to) is true, so +1 below. so -1 here or this attempt to not reject for length rejects for length
            if (to > length) { to = length - 1; }

            // compatibility for browser using +1 to signal dragging below tracks; damps -1 in move with same condition;
            // allows command to also move to length, which is neat, but is mostly here just so the values aren't wrong
            if (from < to) { to++; }
            // eslint-disable-next-line no-shadow
            const { success, message } = player.move(from, to);
            if (success) {
              const queueEmbed = await player.queueEmbed();
              player.sync(interaction, 'queue', queueEmbed);
              interaction.editReply({ content: message });
            } else { interaction.editReply({ content: message }); }
          } else { interaction.editReply({ content: 'need 2+ things in queue to move one from one position to another' }); }
          break;
        }

        case 'remove': {
          if (player.getQueue().length) { // TODO: don\'t correct for input of 0, give error instead. also allow for removing range
            const position = Math.abs((interaction.options.getInteger('position') || 1) - 1);
            const removed = await player.remove(position);
            await interaction.editReply({ content: (removed.length) ? `Removed: ${(removed[0].goose.track.name)}` : 'Remove failed. Most likely your input is too high.' });

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
            if (result?.tracks.length) {
              await player.recall(result.tracks, result.playhead);
              const mediaEmbed = await player.mediaEmbed();
              const queueEmbed = await player.queueEmbed(`Recalled ${result.tracks.length} tracks:`, Math.ceil((player.getPlayhead() + 1) / 10));
              await Promise.all([player.register(interaction, 'queue', queueEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
            } else { await interaction.editReply({ content: 'Your stash is empty.' }); }
          } else { await interaction.editReply({ content: 'This command can only be called with an empty queue.' }); }
          break;
        }

        default: {
          log('error', ['OH NO SOMETHING\'S FUCKED']);
          await interaction.editReply({ content: 'Something broke. Please try again' });
        }

      }
    } else { interaction.editReply({ content: message }); }
  } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
}