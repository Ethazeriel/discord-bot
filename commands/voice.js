const { SlashCommandBuilder } = require('@discordjs/builders');
const music = require('../music.js');
const ytdl = require('ytdl-core');
const utils = require('../utils.js');
const playlists = require('../playlists.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('music related functions')
    .addSubcommand(subcommand => subcommand
      .setName('join')
      .setDescription('joins you in voice'))
    .addSubcommand(subcommand => subcommand
      .setName('leave')
      .setDescription('forces the bot to leave voice'))
    .addSubcommand(subcommand => subcommand
      .setName('play')
      .setDescription('adds a song to the queue')
      .addStringOption(option =>
        option.setName('source').setDescription('Song source').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('nowplaying')
      .setDescription('Gets the current track'))
    .addSubcommand(subcommand => subcommand
      .setName('playtop')
      .setDescription('adds a song to the top of the queue')
      .addStringOption(option =>
        option.setName('source').setDescription('Song source').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('playskip')
      .setDescription('adds a song to the top of the queue, and plays it immediately')
      .addStringOption(option =>
        option.setName('source').setDescription('Song source').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('skip')
      .setDescription('skips the currently running song'))
    .addSubcommand(subcommand => subcommand
      .setName('showqueue')
      .setDescription('Prints the current queue')
      .addIntegerOption(option =>
        option.setName('page').setDescription('Page to show').setRequired(false)))
    .addSubcommand(subcommand => subcommand
      .setName('playtest')
      .setDescription('TRAINSONG'))
    .addSubcommand(subcommand => subcommand
      .setName('remove')
      .setDescription('remove a track from the queue')
      .addIntegerOption(option =>
        option.setName('track').setDescription('Track to remove').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('loop')
      .setDescription('Toggles queue looping')),


  async execute(interaction) {

    switch (interaction.options.getSubcommand()) {

    case 'join': {
      music.createVoiceConnection(interaction);
      await interaction.reply({ content:`Joined voice channel ${interaction.member.voice.channel}`, ephemeral: true });
      break;
    }

    case 'leave': {
      music.leaveVoice(interaction);
      await interaction.reply({ content:'Left voice channel (if I was in one).', ephemeral: true });
      break;
    }

    case 'play': {
      const reqstr = interaction.options.getString('source');

      let trackInfo = null;
      let track = null;
      try {
        // handle direct youtube urls
        trackInfo = await ytdl.getInfo(reqstr);
        track = {
          title: trackInfo.videoDetails.title,
          artist: 'placeholder artist',
          album: 'placeholder album',
          url: trackInfo.videoDetails.video_url,
          albumart: 'testing/albumart.jpg',
        };
      } catch (error) {
        console.error('Error parsing youtube string:', reqstr, '. Stacktrace:', error);
        await interaction.reply({ content:`Error parsing youtube string: ${reqstr}`, ephemeral: true });
      }

      music.createVoiceConnection(interaction);
      music.addToQueue(track);
      utils.generateTrackEmbed(interaction, track, 'Added to Queue: ');
      break;
    }

    case 'nowplaying': {
      const track = music.getCurrentTrack();
      // console.log(track);

      if (track != null) {
        utils.generateTrackEmbed(interaction, track, 'Now Playing: ');
      } else {
        await interaction.reply({ content:'unable to get the current track.', ephemeral: true });
      }
      break;
    }

    case 'playtop': {
      const reqstr = interaction.options.getString('source');

      let trackInfo = null;
      let track = null;
      try {
        // handle direct youtube urls
        trackInfo = await ytdl.getInfo(reqstr);
        track = {
          title: trackInfo.videoDetails.title,
          artist: 'placeholder artist',
          album: 'placeholder album',
          url: trackInfo.videoDetails.video_url,
          albumart: 'testing/albumart.jpg',
        };
      } catch (error) {
        console.error('Error parsing youtube string:', reqstr, '. Stacktrace:', error);
        await interaction.reply({ content:`Error parsing youtube string: ${reqstr}`, ephemeral: true });
      }

      music.createVoiceConnection(interaction);
      music.addToQueueTop(track);
      utils.generateTrackEmbed(interaction, track, 'Added to top of queue: ');
      break;
    }

    case 'playskip': {
      const reqstr = interaction.options.getString('source');

      let trackInfo = null;
      let track = null;
      try {
        // handle direct youtube urls
        trackInfo = await ytdl.getInfo(reqstr);
        track = {
          title: trackInfo.videoDetails.title,
          artist: 'placeholder artist',
          album: 'placeholder album',
          url: trackInfo.videoDetails.video_url,
          albumart: 'testing/albumart.jpg',
        };
      } catch (error) {
        console.error('Error parsing youtube string:', reqstr, '. Stacktrace:', error);
        await interaction.reply({ content:`Error parsing youtube string: ${reqstr}`, ephemeral: true });
      }

      music.createVoiceConnection(interaction);
      music.addToQueueSkip(track);
      utils.generateTrackEmbed(interaction, track, 'Playing Now: ');
      break;
    }

    case 'skip': {

      let track = null;

      track = {
        title: 'Silence',
        artist: 'Eth',
        album: 'ethsound',
        url: '../empty.mp3',
        albumart: 'testing/albumart.jpg',
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

    case 'playtest': {
      music.createVoiceConnection(interaction);
      await music.addMultipleToQueue(playlists.trainsong);
      // utils.generateQueueEmbed(interaction, music.getCurrentTrack(), music.queue, 'Queued Trainsong:', 1);
      await interaction.reply({ content:'TRAINSONG' });
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

  },
};