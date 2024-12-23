import * as db from '../../database.js';
import * as utils from '../../utils.js';
import { ButtonInteraction, InteractionUpdateOptions, InteractionDeferUpdateOptions } from 'discord.js';
import youtube from '../../workers/acquire/youtube.js';

export const name = 'remap';

export async function execute(interaction:ButtonInteraction, which:string): Promise<void> { // button selection function
  await interaction.deferUpdate({ ephemeral: true } as InteractionDeferUpdateOptions);
  switch (which) {

    case 'db': {
      const match = interaction.message.embeds[0].footer!.text.match(/([\w-]{11})([0-3])/);
      const result = await db.switchAlternate(match![1], Number(match![2]) + 1);
      if (result) {
        const reply = {
          embeds: [
            {
              color: 0xd64004,
              author: { name: 'Confirmed:', icon_url: utils.pickPride('fish') },
              fields: [{ name: 'Track Remapped.', value: '** **' }],
              image: { url: 'attachment://combined.png', height: 0, width: 0 },
            },
          ],
          components:[],
        };
        await interaction.editReply(reply as InteractionUpdateOptions);
      } else {
        const reply = {
          embeds: [
            {
              color: 0xd64004,
              author: { name: 'Failure:', icon_url: utils.pickPride('fish') },
              fields: [{ name: 'Something went wrong;', value: 'please try again.' }],
              image: { url: 'attachment://combined.png', height: 0, width: 0 },
            },
          ],
          components:[],
        };
        await interaction.editReply(reply as InteractionUpdateOptions);
      }
      break;
    }

    case 'new': {
      const match = interaction.message.embeds[0].footer!.text.match(/([\w-]{11})([\w-]{11})/);
      const track = await db.getTrack({ 'audioSource.youtube.0.id': match![1] });
      if (typeof track === 'undefined') {
        await interaction.editReply({ content:'We don\'t appear to have that track.', ephemeral: true } as InteractionUpdateOptions);
        return;
      }
      // const newtrack = await fetch(`https://www.youtube.com/watch?v=${match[2]}`, interaction.id);
      const newtrack = await db.getTrack({ 'audioSource.youtube.0.id': match![2] });
      let newtube:TrackYoutubeSource;
      if (typeof track === 'undefined') {
        newtube = newtrack!.audioSource.youtube![0];
      } else {
        try {
          newtube = await youtube.fromId(match![2]);
        } catch (error:any) {
          await interaction.editReply({ content:`Error remapping: ${error.message}`, ephemeral: true } as InteractionUpdateOptions);
          return;
        }
      }
      await db.switchAlternate(match![1], newtube);

      const reply = {
        embeds: [
          {
            color: 0xd64004,
            author: { name: 'Remapped:', icon_url: utils.pickPride('fish') },
            fields: [
              { name: 'From:', value: `[${track!.audioSource.youtube![0].name}](https://youtube.com/watch?v=${track!.audioSource.youtube![0].id}) - ${new Date(track!.audioSource.youtube![0].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
              { name: 'To:', value: `[${newtube.name}](https://youtube.com/watch?v=${newtube.id}) - ${new Date(newtube.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
            ],
            image: { url: 'attachment://combined.png', height: 0, width: 0 },
          },
        ],
        components:[],
        files: [],
      };
      await interaction.editReply(reply as InteractionUpdateOptions);
      break;
    }

    case 'no': {
      const reply = {
        embeds: [
          {
            color: 0xd64004,
            author: { name: 'Cancelled remap.', icon_url: utils.pickPride('fish') },
            image: { url: 'attachment://combined.png', height: 0, width: 0 },
          },
        ],
        components:[],
      };
      await interaction.editReply(reply as InteractionUpdateOptions);
      break;
    }

    default:
      break;
  }
}