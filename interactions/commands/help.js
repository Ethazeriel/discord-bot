const { SlashCommandBuilder } = require('@discordjs/builders');
const utils = require('../../utils.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Documentation!')
    .addStringOption(option =>
      option.setName('section')
        .setDescription('What do you want help with?')
        .addChoice('General', 'index')
        .addChoice('Stickers', 'stickers')
        .addChoice('Play command', 'play')
        .addChoice('Playlist command', 'playlist')
        .addChoice('Queue command', 'queue')
        .addChoice('Voice command', 'voice')
        .addChoice('Remap command', 'remap')
        .addChoice('Admin command', 'admin')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const which = interaction.options.getString('section') || 'index';
    const response = this.helpEmbed(which);
    await interaction.editReply(response);
  },

  helpEmbed(section) {
    let name = '\u200b';
    let fields = [];
    switch (section) {
      case 'index':
        name = 'General'; // TODO - make links correct once we have a public repo
        fields = [{ name: 'Overview', value: 'Goose is a bot designed to serve as a proud creature and noisemaker - pride and honking is why we\'re here. If you\'d like your own goose, you can find the code [on github](https://github.com/Ethazeriel/discord-bot) and setup instructions [here](https://github.com/Ethazeriel/discord-bot).' }];
        break;

      case 'stickers':
        name = 'Stickers:';
        fields = [ // TODO - fix license, links
          { name: 'Overview', value: 'The /dab, /fish, and /heart commands are definitely not a ripoff of discord\'s built in sticker functionality. The entire purpose of their existence certainly isn\'t to get around the arbitrary and low limit discord places on the number of stickers you can have; We would never do such a thing. Inclusivity shouldn\'t have a monthly pricetag.' },
          { name: 'Usage', value: 'To use, invoke any one of the /dab, /fish, or /heart commands. The single, required option specifies which pride-variant to display, or select the default random to have the bot pick for you.' },
          { name: 'Sources', value: 'The stickers used here are freely availiable under a [WHICHEVER LICENCE WE USE] license; they can be downloaded from [here](https://ethazeriel.net/pride/). Are we missing a flag that\'s important to you? Feel free to open an issue [here](https://github.com/Ethazeriel/discord-bot) and we\'ll see what we can do about adding them!' },
        ];
        break;

      case 'play':
        name = 'The Play Command:';
        fields = [
          { name: 'Overview', value: 'Requires the DJ role. Functions for playing music. You must be in a voice channel for this command to do anything. The play command accepts a search and several other optional arguments:' },
          { name: 'Search', value: 'Required. The thing you want the bot to play. Currently this can be a youtube link, spotify album/playlist/track link, internal bot playlist(see /help playlist), or a text search.' },
          { name: 'When', value: 'Optional, default "Play Last". Specifies where in the queue to place the thing you\'re searching for. "**Play Last**" is default and will append your search to the end of the queue; "**Play Next**" will append your search immediately after the currently playing track; "**Play Now**" will interrupt whatever\'s playing and start playing your new search immediately.' },
          { name: 'What', value: 'Optional, default "External search". Specifies what the search is for - either an internal bot playlist or external search. Defaults to external as that\'s most likely what you want to do.' },
          // { name: 'Shuffle', value: '' },
        ];
        break;

      case 'playlist':
        name = 'Playlist command';
        fields = [ // TODO - needs a rework along with the playlist thing in its entirety
          { name: 'Overview', value: 'Requires the DJ role. Functionality related to internal bot playlists. Goose offers its own playlist functionality to avoid the hassle of copying a spotify link every time you want to listen to a playlist. Subcommands:' },
          { name: 'List', value: 'Lists all the internal playlists we currently have in the database.' },
          { name: 'Show', value: 'Displays an embed with the current working playlist. Optionally, you can specify which page to display; or use the navigation buttons to scroll back and forth.' },
          { name: 'Add', value: 'Adds something to the current working playlist. Uses the same logic as the play command; Can be a youtube link, spotify link, or text search. Optionally, specify what position to add things at; if unspecified, defaults to appending to the end of the playlist.' },
          { name: 'Remove', value: 'Removes an entry from the working playlist. Requires specifying the index of the track to remove.' },
          { name: 'Empty', value: 'Removes everything from the working playlist, returning it to a clean slate.' },
          { name: 'Save', value: 'Saves the current working playlist to the database with the name specified. Does not allow overwriting existing playlists; to remove a playlist, see the Admin command.' },
          { name: 'Copy', value: 'Appends the queue from the voice channel you\'re in to the playlist workspace. You must be in a voice channel with an active queue for this to work.' },
          { name: 'Load', value: 'Loads a playlist from the database and appends it to the working playlist.' },
          { name: 'Move', value: 'Moves a track from one index to another. Specify the from-index first, and the to-index second.' },
          { name: 'Play', value: 'Appends everything from the current workspace to the live queue.' },
        ];
        break;

      case 'queue':
        name = 'Queue command';
        fields = [
          { name: 'Overview', value: 'Requires the DJ role. The queue command provides functionality for manipulating the active queue.' },
          { name: 'Show', value: '' },
          { name: 'Prev', value: '' },
          { name: 'Next', value: '' },
          { name: 'Jump', value: '' },
          { name: 'Seek', value: '' },
          { name: 'Play-Pause', value: '' },
          { name: 'Loop', value: '' },
          { name: 'Shuffle', value: '' },
          { name: 'Remove', value: '' },
          { name: 'Empty', value: '' },
        ];
        break;

      case 'voice':
        name = 'Voice command';
        fields = [
          { name: 'Overview', value: 'It\'s a bot!' },
          { name: 'NowPlaying', value: '' },
          { name: 'Join', value: '' },
          { name: 'Leave', value: '' },
        ];
        break;

      case 'remap':
        name = 'Remap command';
        fields = [{ name: 'Overview', value: 'It\'s a bot!' }];
        break;

      case 'admin':
        name = 'Admin command';
        fields = [
          { name: 'Overview', value: 'Requires the Admin role. The admin command provides functionality that you want to restrict to trusted users; at the moment, this is only removing tracks and playlists from the database.' },
          { name: 'RemovePlaylist', value: 'Removes the playlist with the specified name from the database. The returned message should tell you how many tracks were in the playlist before removal.' },
          { name: 'RemoveTrack', value: 'Accepts a youtube URL to remove from the database. Use with caution - could cause unintended effects if the specified track is currently in playlists or in a live queue.' },
        ];
        break;

      default:
        name = 'You shouldn\'t see this';
        fields = [{ name: 'well fuck', value: 'clearly something has gone wrong' }];
        break;
    }
    const embed = [{
      color: utils.randomHexColor(),
      author: {
        name: name,
        icon_url: utils.pickPride('fish'),
      },
      fields: fields,
    }];
    const dropdown = [
      {
        'type': 1,
        'components': [
          {
            'type': 3,
            'custom_id': 'help',
            'options':[
              {
                'label': 'General',
                'value': 'index',
                'description': 'Overall bot info',
              },
              {
                'label': 'Stickers',
                'value': 'stickers',
                'description': 'Info about pride stickers',
              },
              {
                'label': 'Play command',
                'value': 'play',
                'description': 'It plays music!',
              },
              {
                'label': 'Playlist command',
                'value': 'playlist',
                'description': 'Info about the playlist editor',
              },
              {
                'label': 'Queue command',
                'value': 'queue',
                'description': 'Info about queue functions',
              },
              {
                'label': 'Voice command',
                'value': 'voice',
                'description': 'It\'s an odd command, we know',
              },
              {
                'label': 'Remap command',
                'value': 'remap',
                'description': 'How to remap tracks in the database',
              },
              {
                'label': 'Admin command',
                'value': 'admin',
                'description': 'administrative functions',
              },
            ],
            'placeholder': 'Select section',
          },
        ],
      },
    ];
    return { components:dropdown, embeds:embed };
  },
};
