const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dab')
    .setDescription('Sends a dab')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Dab type')
        .setRequired(true)
        .addChoice('Random', 'random')
        .addChoice('Pride', 'pride')
        .addChoice('Trans', 'trans')
        .addChoice('Agender', 'agender')
        .addChoice('Aromantic', 'aromantic')
        .addChoice('Asexual', 'asexual')
        .addChoice('Bigender', 'bigender')
        .addChoice('Demisexual', 'demisexual')
        .addChoice('Gay(men)', 'gaymen')
        .addChoice('Genderfluid', 'genderfluid')
        .addChoice('Genderqueer', 'genderqueer')
        .addChoice('Intersex', 'intersex')
        .addChoice('Lesbian', 'lesbian')
        .addChoice('Nonbinary', 'nonbinary')
        .addChoice('Pan', 'pan')
        .addChoice('Poly', 'poly')),
  async execute(interaction) {
    const dabChoice = interaction.options.getString('type');
    if (dabChoice == 'random') {
      const dabarray = ['agender', 'aromantic', 'asexual', 'bigender', 'bisexual', 'demisexual', 'gaymen', 'genderfluid', 'genderqueer', 'intersex', 'lesbian', 'nonbinary', 'pan', 'poly', 'pride', 'trans'];
      const randab = dabarray[Math.floor(Math.random() * dabarray.length)];
      const dabStr = 'https://ethazeriel.net/pride/sprites/dab_' + randab + '.png';
      const dabEmbed = new MessageEmbed()
        .setImage(dabStr);
      await interaction.reply({ embeds: [dabEmbed] });
    } else {
      const dabStr = 'https://ethazeriel.net/pride/sprites/dab_' + dabChoice + '.png';
      const dabEmbed = new MessageEmbed()
        .setImage(dabStr);
      await interaction.reply({ embeds: [dabEmbed] });
    }

  },

};