const { SlashCommandBuilder } = require('@discordjs/builders');
const music = require('../../music.js');
const utils = require('../../utils.js');
// const playlists = require('../playlists.js');
const { logLine } = require('../../logger.js');
const database = require('../../database.js');
const { fetch } = require('../../acquire.js');
const { youtubePattern, spotifyPattern, sanitize, sanitizePlaylists } = require('../../regexes.js');

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play something!')
    .addStringOption(option =>
      option.setName('search').setDescription('search term/youtube url/spotify uri/playlist name').setRequired(true))
    .addStringOption(option =>
      option.setName('when').setDescription('Where in the queue should this go?')
        .addChoice('Play Now', 'now')
        .addChoice('Play Next', 'next')
        .addChoice('Play Last', 'last'))
    .addStringOption(option =>
      option.setName('what').setDescription('Flag as internal playlist, not external search')
        .addChoice('Internal bot playlist', 'playlist')),

  async execute(interaction) {
    const search = interaction.options.getString('search')?.replace(sanitize, '');
    const when = interaction.options.getString('when') || 'last';
    const what = interaction.options.getString('what') || null;


    if (interaction.member?.roles?.cache?.some(role => role.name === 'DJ')) {
      await interaction.deferReply({ ephemeral: true });

      if (!search) {
        await interaction.followUp({ content: 'Search can\'t be blank.', ephemeral: true });
        return;
      }

      let tracks = null;

      if (what) {
        if ((spotifyPattern.test(search) || youtubePattern.test(search))) {
          await interaction.followUp({ content: 'Omit playlist flag for external resources. See /help play or /help playlist for usage and interrelationship.', ephemeral: true });
        } else {
          search.replace(sanitizePlaylists, '');
          tracks = await database.getPlaylist(search);
          if (tracks.length == 0) {
            logLine('error', [`No playlist exists by name '${search}'`]);
            await interaction.followUp({ content: `No playlist exists by name '${search}'. See /playlist list or /playlist help.`, ephemeral: true });
          }
        }
      } else {
        try {
          tracks = await fetch(search);
          if (!tracks || tracks.length == 0) {
            await interaction.followUp({ content: `No result for '${search}'. Either be more specific or directly link a spotify/youtube resource.`, ephemeral: true });
          }
        } catch (error) {
          await interaction.followUp({ content: `OH NO SOMETHING'S FUCKED. Error: ${error.message}`, ephemeral: true });
        }
      }

      if (tracks && tracks.length > 0) {
        music.createVoiceConnection(interaction);

        switch (when) {
        case 'now': {
          music.addToQueueSkip(tracks);
          if (tracks.length == 1) {
            const message = await utils.generateTrackEmbed(tracks[0], 'Playing Now: ');
            await interaction.followUp(message);
          } else {
            const message = await utils.generateQueueEmbed(tracks[0], music.queue, 'Playing Now: ', 1);
            await interaction.followUp(message);
          }
          break;
        }
        case 'next': {
          music.addToQueueTop(tracks);
          await sleep(500);
          if (tracks.length == 1) {
            const message = await utils.generateTrackEmbed(tracks[0], 'Playing Next: ');
            await interaction.followUp(message);
          } else {
            const message = await utils.generateQueueEmbed(music.getCurrentTrack(), music.queue, 'Playing Next: ', 1);
            await interaction.followUp(message);
          }
          break;
        }
        case 'last': {
          const length = music.addToQueue(tracks);
          if (tracks.length == 1) {
            const message = await utils.generateTrackEmbed(tracks[0], `Queued at position ${length}:`);
            await interaction.followUp(message);
          } else {

            const message = await utils.generateListEmbed(music.queue, 'Queued: ', (Math.ceil((length - (tracks.length - 1)) / 10) || 1));
            await interaction.followUp(message);
          }
          break;
        }
        default: {
          logLine('error', ['OH NO SOMETHING\'S FUCKED']);
          await interaction.followUp({ content:'Something broke. Please try again', ephemeral: true });
        }
        }
      }
    } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
  },
};