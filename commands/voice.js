const { SlashCommandBuilder } = require('@discordjs/builders');
const music = require('../music.js');
const ytdl = require('ytdl-core');
const utils = require('../utils.js');

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
      .setDescription('skips the currently running song')),


  async execute(interaction) {

    switch (interaction.options.getSubcommand()) {

    case 'join': {
      music.createVoiceConnection(interaction);
      await interaction.reply(`Joined voice channel ${interaction.member.voice.channel}`);
      break;
    }

    case 'leave': {
      music.leaveVoice(interaction);
      await interaction.reply('Left voice channel (if I was in one).');
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
      utils.generateTrackReply(interaction, track, 'Added to Queue: ');
      break;
    }

    case 'nowplaying': {
      const track = music.getCurrentTrack();
      console.log(track);

      if (track != null) {
        utils.generateTrackReply(interaction, track, 'Now Playing: ');
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
      utils.generateTrackReply(interaction, track, 'Added to top of queue: ');
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
      utils.generateTrackReply(interaction, track, 'Playing Now: ');
      break;
    }

    case 'skip': {

      let track = null;

      track = {
        title: 'Silence',
        artist: 'placeholder artist',
        album: 'placeholder album',
        url: '../empty.mp3',
        albumart: 'testing/albumart.jpg',
      };

      music.createVoiceConnection(interaction);
      music.playLocalTrack(track);
      await interaction.reply({ content:'Skipped.' });
      break;
    }
    default: {
      console.log('OH NO SOMETHING\'S FUCKED');
      await interaction.reply({ content:'Something broke. Please try again', ephemeral: true });
    }

    }

  },
};