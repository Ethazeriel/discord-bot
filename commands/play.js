const { SlashCommandBuilder } = require('@discordjs/builders');
const music = require('../music.js');
const ytdl = require('ytdl-core');
const utils = require('../utils.js');
const playlists = require('../playlists.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play something!')
    .addStringOption(option =>
      option.setName('url').setDescription('Youtube URL').setRequired(true))
    .addStringOption(option =>
      option.setName('type').setDescription('play type')
        .addChoice('End of queue', 'end')
        .addChoice('Top of queue', 'top')
        .addChoice('Skip current', 'skip')
        .addChoice('Trainsong', 'trainsong')),


  async execute(interaction) {
    console.log(`Recieved command from ${interaction.member} with name ${interaction.commandName} and options url: ${interaction.options.getString('url')}, type: ${interaction.options.getString('type')}`);
    if (interaction.member.roles.cache.some(role => role.name === 'DJ')) {
      let type = interaction.options.getString('type');
      if (type == null) { type = 'end';}

      await interaction.deferReply({ ephemeral: true });

      switch (type) {

      case 'end': {
        const reqstr = interaction.options.getString('url');

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
            albumart: 'albumart/albumart.jpg',
          };
        } catch (error) {
          console.error('Error parsing youtube string:', reqstr, '. Stacktrace:', error);
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
        const reqstr = interaction.options.getString('url');

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
            albumart: 'albumart/albumart.jpg',
          };
        } catch (error) {
          console.error('Error parsing youtube string:', reqstr, '. Stacktrace:', error);
          await interaction.followUp({ content:`Error parsing youtube string: ${reqstr}`, ephemeral: true });
        }

        music.createVoiceConnection(interaction);
        music.addToQueueTop(track);
        utils.generateTrackEmbed(interaction, track, 'Added to top of queue: ');
        break;
      }

      case 'skip': {
        const reqstr = interaction.options.getString('url');

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
            albumart: 'albumart/albumart.jpg',
          };
        } catch (error) {
          console.error('Error parsing youtube string:', reqstr, '. Stacktrace:', error);
          await interaction.followUp({ content:`Error parsing youtube string: ${reqstr}`, ephemeral: true });
        }

        music.createVoiceConnection(interaction);
        music.addToQueueSkip(track);
        utils.generateTrackEmbed(interaction, track, 'Playing Now: ');
        break;
      }

      case 'trainsong': {
        music.createVoiceConnection(interaction);
        await music.addMultipleToQueue(playlists.trainsong);
        // utils.generateQueueEmbed(interaction, music.getCurrentTrack(), music.queue, 'Queued Trainsong:', 1);
        await interaction.followUp({ content:'TRAINSONG' });
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