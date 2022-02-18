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
        name = 'General';
        fields = [{ name: 'Overview', value: 'It\'s a bot!' }];
        break;

      case 'stickers':
        name = 'Stickers';
        fields = [{ name: 'Overview', value: 'It\'s a bot!' }];
        break;

      case 'play':
        name = 'Play command';
        fields = [{ name: 'Overview', value: 'Functions for playing music. Requires the DJ role. You must be in a voice channel for this command to do anything.' }];
        break;

      case 'playlist':
        name = 'Playlist command';
        fields = [{ name: 'Overview', value: 'It\'s a bot!' }];
        break;

      case 'queue':
        name = 'Queue command';
        fields = [{ name: 'Overview', value: 'It\'s a bot!' }];
        break;

      case 'voice':
        name = 'Voice command';
        fields = [{ name: 'Overview', value: 'It\'s a bot!' }];
        break;

      case 'remap':
        name = 'Remap command';
        fields = [{ name: 'Overview', value: 'It\'s a bot!' }];
        break;

      case 'admin':
        name = 'Admin command';
        fields = [{ name: 'Overview', value: 'It\'s a bot!' }];
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
