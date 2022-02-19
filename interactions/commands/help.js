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
          { name: 'Show', value: 'Summons an embed that displays the current queue, including navigation buttons and the ability to activate looping and shuffle. This embed will auto-update with changes for as long as possible; Discord imposes a hard 15-minute limit on updating embeds, so to receive updates beyond that point you must summon a new embed or refresh the current one with a button press.' },
          { name: 'Prev', value: 'Moves the playhead back one song to play the previous song in the queue.' },
          { name: 'Next', value: 'Moves the playhead up one song to play the next song in the queue.' },
          { name: 'Jump', value: 'Accepts an integer position to move to; jumps to any track in the queue.' },
          { name: 'Seek', value: 'Accepts an integer (number of seconds) to seek to; seeks within the current track to a timestamp.' },
          { name: 'Play-Pause', value: 'Acts as a toggle, pausing/playing the current track based on its\' current state. Can also be done using the play/pause button on the player embed.' },
          { name: 'Loop', value: 'Toggles looping on and off. This can also be done using the loop button on the queue embed.' },
          { name: 'Shuffle', value: 'When invoked, shuffles the queue. By default, this uses a pseudo-random algorithm to shuffle all tracks after the playhead (ie. it will not shuffle things that have already played). If looping is turned on, this will shuffle the entire queue and place you at the beginning. Optionally, select "Yes" in the "album-aware" argument to run an album-aware shuffle algorithm that will keep whole albums together and randomly shuffle those instead of individual tracks.' },
          { name: 'Remove', value: 'Removes a track from the queue. If no additional argument is specified, removes the current track; Optionally specify an integer to remove the track at that position in the queue.' },
          { name: 'Empty', value: 'Completely removes everything from the queue, returning it to an empty state.' },
        ];
        break;

      case 'voice':
        name = 'Voice command';
        fields = [
          { name: 'Overview', value: 'Requires the DJ role. Mainly provides functionality for manipulating the bots\' voice connection.' },
          { name: 'NowPlaying', value: 'Summons an embed to display the currently playing track.' },
          { name: 'Join', value: 'Forces the bot to join you in a voice channel. Most likely this isn\'t something you\'ll actually want to do; use the play command instead.' },
          { name: 'Leave', value: 'Forces the bot to leave voice, for those times when you really, really need it gone like right now please.' },
        ];
        break;

      case 'remap':
        name = 'Remap command';
        fields = [
          { name: 'Overview', value: 'Requires the DJ role. If you\'ve queue\'d something and the thing that starts playing isn\'t what you wanted, the remap command helps fix that if you queue the same thing again in the future.' },
          { name: 'Usage', value: 'To remap the currently playing track, invoke the remap command and specify "current". If you want to remap something other than the current track (eg. the next song), invoke the remap command and specify the youtube link of the thing you want to remap; you can check the queue embed for youtube links. \n \nThe bot will generate an embed with a list of alternative tracks (the next four options youtube\'s search returned). If any of those are correct, use the dropdown box to select the correct track; If none of those seem right, you can select "none of these" in the drop down for further instructions.' },
          { name: 'Why?', value: 'When we receive a request to fetch a track for the first time, we grab a bunch of data about it and store that for reference. This is safe with youtube requests, but when we try a text search or a spotify link youtube\'s api likes to return instrumentals, covers, and other things that aren\'t actually what we\'re looking for. The remap command provides a method to fix incorrect mappings.' },
        ];
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
