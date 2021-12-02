const { SlashCommandBuilder } = require('@discordjs/builders');
const { logLine } = require('../logger.js');
const { sanitize } = require('../regexes.js');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('remap')
    .setDescription('remap incorrect tracks')
    .addStringOption(option =>
      option.setName('track').setDescription('track to remap').setRequired(true)),


  async execute(interaction) {
    logLine('command',
      ['Recieved command from ',
        interaction.member.displayName,
        'with name ',
        interaction.commandName,
        'track ',
        interaction.options.getString('track')?.replace(sanitize, '')]);

    if (interaction.member.roles.cache.some(role => role.name === 'DJ')) {
      await interaction.deferReply({ ephemeral: true });
      const reply = {
        content: 'Test Message',
        components:
      [
        {
          'type': 1,
          'components': [
            {
              'type': 3,
              'custom_id': 'selectalt',
              'options':[
                {
                  'label': 'Alternative 1',
                  'value': '0',
                  'description': 'track.alternates[0].name',
                },
                {
                  'label': 'Alternative 2',
                  'value': '1',
                  'description': 'track.alternates[1].name',
                },
                {
                  'label': 'Alternative 3',
                  'value': '2',
                  'description': 'track.alternates[2].name',
                },
                {
                  'label': 'Alternative 4',
                  'value': '3',
                  'description': 'track.alternates[3].name',
                },
                {
                  'label': 'Something else',
                  'value': '4',
                  'description': 'none of these are correct',
                },
              ],
              'placeholder': 'Select track...',
            },
          ],
        },
      ] };

      await interaction.followUp(reply);

    } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
  },

};