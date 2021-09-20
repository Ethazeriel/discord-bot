const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageAttachment } = require('discord.js');
const Canvas = require('canvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fish')
    .setDescription('Sends a Fish')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Fish type')
        .setRequired(true)
        .addChoice('Random', 'random')
        .addChoice('Pride', 'pride')
        .addChoice('Trans', 'trans')
        // .addChoice('Agender', 'agender')
        // .addChoice('Aromantic', 'aromantic')
        .addChoice('Asexual', 'asexual')
        .addChoice('Bigender', 'bigender')
        // .addChoice('Demisexual', 'demisexual')
        .addChoice('Gay(men)', 'gaymen')
        .addChoice('Genderfluid', 'genderfluid')
        .addChoice('Genderqueer', 'genderqueer')
        .addChoice('Intersex', 'intersex')
        .addChoice('Lesbian', 'lesbian')
        .addChoice('Nonbinary', 'nonbinary')
        .addChoice('Pan', 'pan'),
      // .addChoice('Poly', 'poly')
    ),
  async execute(interaction) {
    const fishChoice = interaction.options.getString('type');
    if (fishChoice == 'random') { // do this if we've selected random fishs
      const fisharray = ['agender', 'aromantic', 'asexual', 'bigender', 'bisexual', 'demisexual', 'gaymen', 'genderfluid', 'genderqueer', 'intersex', 'lesbian', 'nonbinary', 'pan', 'poly', 'pride', 'trans'];
      const ranfish = fisharray[Math.floor(Math.random() * fisharray.length)];
      const fishStr = 'https://ethazeriel.net/pride/sprites/fish_' + ranfish + '.png';

      // rendering with a canvas means we can control the image size
      const canvas = Canvas.createCanvas(160, 160);
      const context = canvas.getContext('2d');
      const fishimg = await Canvas.loadImage(fishStr);
      context.drawImage(fishimg, 0, 0, canvas.width, canvas.height);
      const attachment = new MessageAttachment(canvas.toBuffer(), 'fish-image.png');

      // push the message to chat
      await interaction.reply({ files: [attachment] });
    } else { // code for specific fishs
      const fishStr = 'https://ethazeriel.net/pride/sprites/fish_' + fishChoice + '.png';

      // rendering with a canvas means we can control the image size
      const canvas = Canvas.createCanvas(160, 160);
      const context = canvas.getContext('2d');
      const fishimg = await Canvas.loadImage(fishStr);
      context.drawImage(fishimg, 0, 0, canvas.width, canvas.height);
      const attachment = new MessageAttachment(canvas.toBuffer(), 'fish-image.png');

      // push the message to chat
      await interaction.reply({ files: [attachment] });
    }

  },

};
