const { SlashCommandBuilder } = require('@discordjs/builders');
const songlist = require('../songlist.js');
const utils = require('../utils.js');
const { logLine } = require('../logger.js');
const database = require('../database.js');
const music = require('../music.js');
const { sanitize } = require('../regexes.js');
const { fetch } = require('../acquire.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('functions related to internal playlists')
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
      .setDescription('adds something to the current working playlist')
      .addStringOption(option =>
        option.setName('track').setDescription('What to add (youtube url, spotify url, text search)').setRequired(true))
      .addIntegerOption(option =>
        option.setName('index').setDescription('where to start add operation at (1-indexed). Defaults to end of playlist').setRequired(false)))
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
      .setDescription('appends everything from the current workspace to the live queue'))
    .addSubcommand(subcommand => subcommand
      .setName('list')
      .setDescription('lists all internal playlists')),


  async execute(interaction) {
    logLine('command',
      ['Recieved command from ',
        interaction.member.displayName,
        'with name',
        interaction.commandName,
        'subcommand',
        interaction.options.getSubcommand(),
        'and options url:',
        interaction.options.getString('url')?.replace(sanitize, ''),
        'track:',
        interaction.options.getString('track')?.replace(sanitize, ''),
        'playlist:',
        interaction.options.getString('playlist')?.replace(sanitize, '')]);

    if (interaction.member.roles.cache.some(role => role.name === 'DJ')) {
      await interaction.deferReply({ ephemeral: true });
      switch (interaction.options.getSubcommand()) {

      case 'show': {
        const page = Math.abs(interaction.options.getInteger('page')) || 1;

        utils.generateListEmbed(interaction, songlist.list, 'Current Playlist:', page);
        break;
      }

      case 'remove': {
        songlist.removeTrack(Math.abs(interaction.options.getInteger('index') - 1));
        await interaction.followUp(`Removed item ${Math.abs(interaction.options.getInteger('index'))} from the playlist.`);
        break;
      }

      case 'add': {
        let tracks = null;
        const search = interaction.options.getString('track')?.replace(sanitize, '');
        const input = Math.abs(interaction.options.getInteger('index') ?? songlist.list.length);
        let index;
        if (input > songlist.list.length) {index = songlist.list.length;} else {
          index = input;
          if (index && (index != songlist.list.length)) {index--;}
        }// check if our index is non-zero and not the length of our songlist

        tracks = await fetch(search);
        if (!tracks) {
          await interaction.followUp({ content: `No result for '${search}'. Either be more specific or directly link a spotify/youtube resource.`, ephemeral: true });
        }
        if (tracks && tracks.length > 0) {
          songlist.addTracks(tracks, index);
          utils.generateListEmbed(interaction, songlist.list, 'Added: ', (Math.ceil(index / 10) || 1));
        }
        break;
      }

      case 'empty': {
        songlist.emptyList();
        await interaction.followUp({ content:'Emptied playlist.', ephemeral: true });
        break;
      }

      case 'save': {
        const listname = interaction.options.getString('playlist')?.replace(sanitize, '');
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
        const listname = interaction.options.getString('playlist')?.replace(sanitize, '');
        const result = await database.getPlaylist(listname);
        songlist.addTracks(result, (songlist.list.length - 1));
        interaction.followUp({ content:`Loaded playlist \`${listname}\` from the database: \`${result.length}\` items.`, ephemeral: true });
        break;
      }

      case 'move': {
        const fromindex = Math.abs(interaction.options.getInteger('from-index') - 1);
        const toindex = Math.abs(interaction.options.getInteger('to-index') - 1);
        const result = songlist.moveTrack(fromindex, toindex);
        interaction.followUp({ content:`Moved track ${result[0].title} from index ${fromindex} to index ${toindex}.`, ephemeral: true });
        break;
      }

      case 'play': {
        music.createVoiceConnection(interaction);
        await music.addToQueue(songlist.list);
        utils.generateListEmbed(interaction, songlist.list, 'Now Playing:', 1);
        break;
      }

      case 'list': {
        const lists = await database.listPlaylists();
        let listStr = '```';
        for (const list of lists) {
          const part = '\n' + list;
          listStr = listStr.concat(part);
        }
        listStr = listStr.concat('```');
        const listEmbed = {
          color: 0x3277a8,
          author: { name: '\u200b', icon_url: utils.pickPride('fish') },
          thumbnail: { url: utils.pickPride('dab') },
          fields: [{ name: 'Playlists:', value: listStr }],
        };
        try {
          await interaction.followUp({ embeds: [listEmbed] });
        } catch (error) {
          logLine('error', [error.stack]);
        }
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