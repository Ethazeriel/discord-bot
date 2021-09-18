const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageAttachment } = require('discord.js');
const Canvas = require('canvas');

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
    if (dabChoice == 'random') { // do this if we've selected random dabs
      const dabarray = ['agender', 'aromantic', 'asexual', 'bigender', 'bisexual', 'demisexual', 'gaymen', 'genderfluid', 'genderqueer', 'intersex', 'lesbian', 'nonbinary', 'pan', 'poly', 'pride', 'trans'];
      const randab = dabarray[Math.floor(Math.random() * dabarray.length)];
      const dabStr = 'https://ethazeriel.net/pride/sprites/dab_' + randab + '.png';

      // rendering with a canvas means we can control the image size
      const canvas = Canvas.createCanvas(160, 100);
      const context = canvas.getContext('2d');
      const dabimg = await Canvas.loadImage(dabStr);
      context.drawImage(dabimg, 0, 0, canvas.width, canvas.height);
      const attachment = new MessageAttachment(canvas.toBuffer(), 'dab-image.png');

      // push the message to chat
      await interaction.reply({ files: [attachment] });
    } else { // code for specific dabs
      const dabStr = 'https://ethazeriel.net/pride/sprites/dab_' + dabChoice + '.png';

      // rendering with a canvas means we can control the image size
      const canvas = Canvas.createCanvas(160, 100);
      const context = canvas.getContext('2d');
      const dabimg = await Canvas.loadImage(dabStr);
      context.drawImage(dabimg, 0, 0, canvas.width, canvas.height);
      const attachment = new MessageAttachment(canvas.toBuffer(), 'dab-image.png');

      // push the message to chat
      await interaction.reply({ files: [attachment] });
    }

  },

};