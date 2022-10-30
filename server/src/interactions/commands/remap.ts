/* eslint-disable no-inner-declarations */
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, AttachmentBuilder, GuildMemberRoleManager } from 'discord.js';
import { sanitize, youtubePattern } from '../../regexes.js';
import * as db from '../../database.js';
import * as utils from '../../utils.js';
import Player from '../../player.js';
import youtube from '../../workers/acquire/youtube.js';
import fs from 'fs';
import { fileURLToPath, URL } from 'url';
// import Jimp from 'jimp';
const { discord } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));
const roles = discord.roles;

export const data = new SlashCommandBuilder()
  .setName('remap')
  .setDescription('remap incorrect tracks')
  .addStringOption(option => option.setName('track').setDescription('takes a youtube url or "current" for the currently playing track').setRequired(true))
  .addStringOption(option => option.setName('newtrack').setDescription('optional remap target'));


export async function execute(interaction:ChatInputCommandInteraction) {

  if ((interaction.member?.roles as GuildMemberRoleManager)?.cache?.some(role => role.name === roles.dj)) {
    await interaction.deferReply({ ephemeral: true });
    const search = interaction.options.getString('track')?.replace(sanitize, '')?.trim() || '';
    const replace = interaction.options.getString('newtrack')?.replace(sanitize, '')?.trim();
    if (youtubePattern.test(search) || search === 'current') {
      if (replace) {
        if (youtubePattern.test(replace)) {
          const match = search.match(youtubePattern);
          const track = await db.getTrack({ 'youtube.0.id': match![2] });
          if (!track) {
            await interaction.followUp({ content:'We don\'t appear to have that track.', ephemeral: true });
            return;
          }
          const match2 = replace.match(youtubePattern);
          const newtrack = await youtube.fromId(match2![2]);
          if (!newtrack) {
            await interaction.followUp({ content:'That new track doesn\'t appear to be valid', ephemeral: true });
            return;
          }
          // const image = await Jimp.read(960, 360);
          // const alt0 = await Jimp.read(track.youtube[0].art);
          // const alt1 = await Jimp.read(newtrack.art);
          // alt0.resize(480, 360);
          // alt1.resize(480, 360);
          // image.composite(alt0, 0, 0).composite(alt1, 480, 0);
          // const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
          // image.print(font, 15, 70, 'From').print(font, 500, 70, 'To');
          // const combined = new AttachmentBuilder(await image.getBufferAsync('image/png'), { name:'combined.png' });
          const reply = {
            embeds: [
              {
                color: 0xd64004,
                author: { name: 'Remapped:', icon_url: utils.pickPride('fish') as string },
                fields: [
                  { name: 'From:', value: `[${track.youtube[0].name}](https://youtube.com/watch?v=${track.youtube[0].id}) - ${new Date(track.youtube[0].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                  { name: 'To:', value: `[${newtrack.name}](https://youtube.com/watch?v=${newtrack.id}) - ${new Date(Number(newtrack.duration) * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                ],
                image: { url: 'attachment://combined.png' },
                footer: { text: `${track.youtube[0].id}${newtrack.id}` },
              },
            ],
            components: [
              {
                'type': 1,
                'components': [
                  { type: 2, custom_id:'remap-new', style:3, label:'Confirm' },
                  { type: 2, custom_id:'remap-no', style:4, label:'Cancel' },
                ],
              },
            ],
            // files: [combined],
          };
          await interaction.followUp(reply);

        } else { await interaction.followUp({ content:'Invalid newtrack URL', ephemeral: true });}
      } else {
        let track: Track | undefined;
        if (search === 'current') {
          const player = await Player.getPlayer(interaction);
          if (player) {
            track = player.getCurrent();
            if (typeof track === 'undefined') {
              await interaction.followUp({ content:'Unable to get the current track; Is something playing?', ephemeral: true });
              return;
            }
          } else {
            await interaction.followUp({ content:'Unable to get the current track; Is something playing?', ephemeral: true });
            return;
          }
        } else {
          const match = search.match(youtubePattern);
          track = await db.getTrack({ 'youtube.0.id': match![2] });
          if (typeof track === 'undefined') {
            await interaction.followUp({ content:'We don\'t appear to have that track.', ephemeral: true });
            return;
          }
        }
        // const canvas = Canvas.createCanvas(960, 720);
        // const context = canvas.getContext('2d');
        // function drawtext(text:string, x:number, y:number) {// this is ugly and terrible and stolen, but I don't caaaaaaaaare
        //   context.font = '80px Sans-serif';
        //   context.strokeStyle = 'black';
        //   context.lineWidth = 8;
        //   context.strokeText(text, x, y);
        //   context.fillStyle = 'white';
        //   context.fillText(text, x, y);
        // }
        // const alt0 = await Canvas.loadImage(track.youtube[1].art);
        // const alt1 = await Canvas.loadImage(track.youtube[2].art);
        // const alt2 = await Canvas.loadImage(track.youtube[3].art);
        // const alt3 = await Canvas.loadImage(track.youtube[4].art);
        // context.drawImage(alt0, 0, 0, 480, 360);
        // context.drawImage(alt1, 480, 0, 480, 360);
        // context.drawImage(alt2, 0, 360, 480, 360);
        // context.drawImage(alt3, 480, 360, 480, 360);
        // drawtext('1', 15, 70);
        // drawtext('2', 900, 70);
        // drawtext('3', 15, 705);
        // drawtext('4', 900, 705);
        // const combined = new AttachmentBuilder(canvas.toBuffer(), { name:'combined.png' });
        const reply = {
          embeds: [
            {
              color: 0xd64004,
              author: { name: 'Remap:', icon_url: utils.pickPride('fish') as string },
              fields: [
                { name: 'Spotify:', value: `${track.goose.artist.name || 'no artist'} - ${track.goose.track.name} - ${new Date(track.goose.track.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                { name: 'Current Youtube:', value: `[${track.youtube[0].name}](https://youtube.com/watch?v=${track.youtube[0].id}) - ${new Date(track.youtube[0].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                { name: '\u200b', value: '** **' },
                { name: 'Alternate 1:', value: `[${track.youtube[1].name}](https://youtube.com/watch?v=${track.youtube[1].id}) - ${new Date(track.youtube[1].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                { name: 'Alternate 2:', value: `[${track.youtube[2].name}](https://youtube.com/watch?v=${track.youtube[2].id}) - ${new Date(track.youtube[2].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                { name: 'Alternate 3:', value: `[${track.youtube[3].name}](https://youtube.com/watch?v=${track.youtube[3].id}) - ${new Date(track.youtube[3].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                { name: 'Alternate 4:', value: `[${track.youtube[4].name}](https://youtube.com/watch?v=${track.youtube[4].id}) - ${new Date(track.youtube[4].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
              ],
              image: { url: 'attachment://combined.png' },
              footer: { text: track.youtube[0].id },
            },
          ],
          components: [
            {
              'type': 1,
              'components': [
                {
                  'type': 3,
                  'custom_id': 'remap',
                  'options':[
                    { label: 'Alternative 1', value: '0', description: track.youtube[1].name },
                    { label: 'Alternative 2', value: '1', description: track.youtube[2].name },
                    { label: 'Alternative 3', value: '2', description: track.youtube[3].name },
                    { label: 'Alternative 4', value: '3', description: track.youtube[4].name },
                    { label: 'Something else', value: '4', description: 'none of these are correct' },
                  ],
                  'placeholder': 'Select track...',
                },
              ],
            },
          ],
          // files: [combined],
        };

        await interaction.followUp(reply);
      }
    } else { await interaction.followUp({ content:'Invalid track URL', ephemeral: true });}
  } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
}