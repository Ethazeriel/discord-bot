const help = require('../commands/help.js');

module.exports = {
  name: 'help',

  async execute(interaction) { // dropdown selection function
    const choice = interaction.values[0];
    const result = help.helpEmbed(choice);
    await interaction.update(result);
  },
};