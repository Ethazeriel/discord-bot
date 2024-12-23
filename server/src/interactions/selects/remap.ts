import { StringSelectMenuInteraction } from 'discord.js';
import * as db from '../../database.js';
import * as utils from '../../utils.js';

export const name = 'remap';

export async function execute(interaction:StringSelectMenuInteraction) { // dropdown selection function
  const choice = Number(interaction.values[0]);
  if (choice < 4) {
    const track = await db.getTrack({ 'audioSource.youtube.0.id': interaction.message.embeds[0].footer!.text }) as Track;
    const reply = {
      embeds: [
        {
          color: 0xd64004,
          author: { name: 'Confirm remap:', icon_url: utils.pickPride('fish') as string },
          fields: [
            { name: 'From:', value: `[${track.audioSource.youtube![0].name}](https://youtube.com/watch?v=${track.audioSource.youtube![0].id}) - ${new Date(track.audioSource.youtube![0].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
            { name: 'To:', value: `[${track.audioSource.youtube![choice + 1].name}](https://youtube.com/watch?v=${track.audioSource.youtube![choice + 1].id}) - ${new Date(track.audioSource.youtube![choice + 1].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
          ],
          image: { url: 'attachment://combined.png', height: 0, width: 0 },
          footer: {
            text: interaction.message.embeds[0].footer!.text + choice,
          },
        },
      ],
      components: [
        {
          'type': 1,
          'components': [
            { type: 2, custom_id:'remap-db', style:3, label:'Confirm' },
            { type: 2, custom_id:'remap-no', style:4, label:'Cancel' },
          ],
        },
      ],
    };
    await interaction.update(reply);
  } else {
    const reply = {
      embeds: [
        {
          color: 0xd64004,
          author: { name: 'Manual remap:', icon_url: utils.pickPride('fish') as string },
          fields: [
            { name: 'For a manual remap, use:', value: `/remap track:https://youtube.com/watch?v=${interaction.message.embeds[0].footer!.text} newtrack:youtube_link_here` },
          ],
          image: { url: 'attachment://combined.png', height: 0, width: 0 },
        },
      ],
      components:[],
    };
    await interaction.update(reply);
  }
}