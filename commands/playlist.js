const { SlashCommandBuilder } = require('@discordjs/builders');
const songlist = require('../songlist.js');
const utils = require('../utils.js');
const { logLine } = require('../logger.js');
const database = require('../database.js');
const music = require('../music.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('functions related to internal playlists')
    .addSubcommand(subcommand => subcommand
      .setName('import')
      .setDescription('Imports a playlist from spotify')
      .addStringOption(option =>
        option.setName('url').setDescription('Spotify URL').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('show')
      .setDescription('Prints the current working playlist')
      .addIntegerOption(option =>
        option.setName('page').setDescription('Page to show').setRequired(false)))
    .addSubcommand(subcommand => subcommand
      .setName('remove')
      .setDescription('remove a track from the current working playlist')
      .addIntegerOption(option =>
        option.setName('index').setDescription('index to remove').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('add')
      .setDescription('adds a track to the current working playlist')
      .addStringOption(option =>
        option.setName('track').setDescription('Track to add (youtube url, spotify url, text search)').setRequired(true))
      .addIntegerOption(option =>
        option.setName('index').setDescription('index to add track at').setRequired(false)))
    .addSubcommand(subcommand => subcommand
      .setName('empty')
      .setDescription('Empties the current working playlist'))
    .addSubcommand(subcommand => subcommand
      .setName('save')
      .setDescription('Saves the current working playlist')
      .addStringOption(option =>
        option.setName('playlist').setDescription('Name to save this playlist as').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('copy')
      .setDescription('copies the currently playing queue into the playlist workspace'))
    .addSubcommand(subcommand => subcommand
      .setName('load')
      .setDescription('loads a playlist from the database')
      .addStringOption(option =>
        option.setName('playlist').setDescription('Name of the list to load').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('move')
      .setDescription('moves a track from one index to another')
      .addIntegerOption(option =>
        option.setName('from-index').setDescription('Index to move from').setRequired(true))
      .addIntegerOption(option =>
        option.setName('to-index').setDescription('Index to move to').setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('play')
      .setDescription('appends everything from the current workspace to the live queue')),


  async execute(interaction) {
    logLine('command',
      ['Recieved command from ',
        interaction.member.displayName,
        'with name',
        interaction.commandName,
        'subcommand',
        interaction.options.getSubcommand(),
        'and options url:',
        interaction.options.getString('url'),
        'track:',
        interaction.options.getString('track'),
        'playlist:',
        interaction.options.getString('playlist')]);

    if (interaction.member.roles.cache.some(role => role.name === 'DJ')) {
      await interaction.deferReply({ ephemeral: true });
      switch (interaction.options.getSubcommand()) {

      case 'import': {
        // TODO
        // waiting on acquire code
        break;
      }

      case 'show': {
        let page = interaction.options.getInteger('page');
        if (page == null) {page = 1;}

        utils.generateListEmbed(interaction, songlist.list, 'Current Playlist:', page);
        break;
      }

      case 'remove': {
        songlist.removeTrack(interaction.options.getInteger('index') - 1);
        await interaction.followUp(`Removed item ${interaction.options.getInteger('index')} from the playlist.`);
        break;
      }

      case 'add': {
        // TODO
        // mostly waiting on acquire code
        break;
      }

      case 'empty': {
        songlist.emptyList();
        await interaction.followUp({ content:'Emptied playlist.', ephemeral: true });
        break;
      }

      case 'save': {
        const listname = interaction.options.getString('playlist');
        const result = await database.addPlaylist(songlist.list, listname);
        if (result) {
          interaction.followUp({ content:result, ephemeral: true });
        } else {
          interaction.followUp({ content:`Saved ${listname} to the database.`, ephemeral: true });
        }
        break;
      }

      case 'copy': {
        songlist.importQueue();
        interaction.followUp({ content:`Copied ${songlist.list.length} items from the play queue to the workspace`, ephemeral: true });
        break;
      }

      case 'load': {
        const listname = interaction.options.getString('playlist');
        const result = await database.getPlaylist(listname);
        songlist.addTracks(result);
        interaction.followUp({ content:`Loaded playlist ${listname} from the database: ${result.length} items.`, ephemeral: true });
        break;
      }

      case 'move': {
        const fromindex = interaction.options.getInteger('from-index') - 1;
        const toindex = interaction.options.getInteger('to-index') - 1;
        const result = songlist.moveTrack(fromindex, toindex);
        interaction.followUp({ content:`Moved track ${result[0].title} from index ${fromindex} to index ${toindex}.`, ephemeral: true });
        break;
      }

      case 'play': {
        music.createVoiceConnection(interaction);
        await music.addMultipleToQueue(songlist.list);
        utils.generateListEmbed(interaction, songlist.list, 'Now Playing:', 1);
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