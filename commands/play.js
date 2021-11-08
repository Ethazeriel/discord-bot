const { SlashCommandBuilder } = require('@discordjs/builders');
const music = require('../music.js');
const ytdl = require('ytdl-core');
const utils = require('../utils.js');
// const playlists = require('../playlists.js');
const { logLine } = require('../logger.js');
const database = require('../database.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play something!')
    .addStringOption(option =>
      option.setName('search').setDescription('search term/youtube url/spotify uri/playlist name').setRequired(true))
    .addStringOption(option =>
      option.setName('type').setDescription('play type')
        .addChoice('End of queue', 'end')
        .addChoice('Top of queue', 'top')
        .addChoice('Skip current', 'skip')
        .addChoice('Playlist', 'playlist')),


  async execute(interaction) {
    logLine('command',
      ['Recieved command from',
        interaction.member.displayName,
        'with name',
        interaction.commandName,
        'and options url:',
        interaction.options.getString('search'),
        'type: ',
        interaction.options.getString('type')]);

    if (interaction.member.roles.cache.some(role => role.name === 'DJ')) {
      let type = interaction.options.getString('type');
      if (type == null) { type = 'end';}

      await interaction.deferReply({ ephemeral: true });

      switch (type) {

      case 'end': {
        const reqstr = interaction.options.getString('search');

        let trackInfo = null;
        let track = null;
        try {
        // handle direct youtube urls
          trackInfo = await ytdl.getInfo(reqstr);
          track = {
            name: trackInfo.videoDetails.title,
            artist: { name:'placeholder artist' },
            album: { name:'placeholder album' },
            youtube: { id:trackInfo.videoDetails.video_url },
            spotify: { art:'albumart/albumart.jpg' },
          };
        } catch (error) {
          logLine('error', ['Error parsing youtube string:', reqstr, '. Stacktrace:', error.stack]);
          await interaction.followUp({ content:`Error parsing youtube string: ${reqstr}`, ephemeral: true });
        }

        music.createVoiceConnection(interaction);
        const length = music.addToQueue(track);
        if (length == 0) {
          utils.generateTrackEmbed(interaction, track, 'Playing Now: ');
        } else {
          utils.generateTrackEmbed(interaction, track, `Added to queue at position ${length}:`);
        }
        break;
      }

      case 'top': {
        const reqstr = interaction.options.getString('search');

        let trackInfo = null;
        let track = null;
        try {
        // handle direct youtube urls
          trackInfo = await ytdl.getInfo(reqstr);
          track = {
            name: trackInfo.videoDetails.title,
            artist: { name:'placeholder artist' },
            album: { name:'placeholder album' },
            youtube: { id:trackInfo.videoDetails.video_url },
            spotify: { art:'albumart/albumart.jpg' },
          };
        } catch (error) {
          logLine('error', ['Error parsing youtube string:', reqstr, '. Stacktrace:', error.stack]);
          await interaction.followUp({ content:`Error parsing youtube string: ${reqstr}`, ephemeral: true });
        }

        music.createVoiceConnection(interaction);
        music.addToQueueTop(track);
        utils.generateTrackEmbed(interaction, track, 'Added to top of queue: ');
        break;
      }

      case 'skip': {
        const reqstr = interaction.options.getString('search');

        let trackInfo = null;
        let track = null;
        try {
        // handle direct youtube urls
          trackInfo = await ytdl.getInfo(reqstr);
          track = {
            name: trackInfo.videoDetails.title,
            artist: { name:'placeholder artist' },
            album: { name:'placeholder album' },
            youtube: { id:trackInfo.videoDetails.video_url },
            spotify: { art:'albumart/albumart.jpg' },
          };
        } catch (error) {
          logLine('error', ['Error parsing youtube string: ', reqstr, '. Stacktrace: ', error.stack]);
          await interaction.followUp({ content:`Error parsing youtube string: ${reqstr}`, ephemeral: true });
        }

        music.createVoiceConnection(interaction);
        music.addToQueueSkip(track);
        utils.generateTrackEmbed(interaction, track, 'Playing Now: ');
        break;
      }

      case 'playlist': {
        music.createVoiceConnection(interaction);
        const listname = interaction.options.getString('search');
        const result = await database.getPlaylist(listname);
        await music.addMultipleToQueue(result);
        utils.generateListEmbed(interaction, result, `Queued ${listname}:`, 1);
        break;
      }

      default: {
        logLine('error', ['OH NO SOMETHING\'S FUCKED']);
        await interaction.followUp({ content:'Something broke. Please try again', ephemeral: true });
      }

      }
    } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
  },
};