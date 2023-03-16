import Player from '../../player.js';
import { logDebug } from '../../logger.js';
import { InteractionDeferUpdateOptions, ButtonInteraction } from 'discord.js';

export const name = 'media';

export async function execute(interaction:ButtonInteraction, which:string):Promise<void> {
  (which === 'showqueue') ? await interaction.deferReply({ ephemeral: true }) : await interaction.deferUpdate({ ephemeral: true } as InteractionDeferUpdateOptions);

  const player = await Player.getPlayer(interaction);
  if (player) {
    if (player.getQueue().length) {
      switch (which) {
        case 'refresh': {
          const mediaEmbed = await player.mediaEmbed(false);
          interaction.message = await interaction.editReply(mediaEmbed);
          player.register(interaction, 'media', mediaEmbed);
          break;
        }

        case 'prev': {
          await player.prev();
          const mediaEmbed = await player.mediaEmbed(false);
          const queueEmbed = await player.queueEmbed(undefined, undefined, false);
          await Promise.all([player.register(interaction, 'media', mediaEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
          break;
        }

        case 'pause': {
          await player.togglePause();
          const mediaEmbed = await player.mediaEmbed(false);
          const queueEmbed = await player.queueEmbed(undefined, undefined, false);
          await Promise.all([player.register(interaction, 'media', mediaEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
          break;
        }

        case 'next': {
          if (player.getCurrent()) {
            await player.next();
          } else { await player.jump(0); }
          const mediaEmbed = await player.mediaEmbed(false);
          const queueEmbed = await player.queueEmbed(undefined, undefined, false);
          await Promise.all([player.register(interaction, 'media', mediaEmbed), player.sync(interaction, 'media', queueEmbed, mediaEmbed)]);
          break;
        }

        case 'showqueue': {
          const queueEmbed = await player.queueEmbed(undefined, undefined, true);
          interaction.message = await interaction.editReply(queueEmbed);
          player.register(interaction, 'queue', queueEmbed);
          break;
        }

        default: logDebug(`media buttons—bad case: ${which}`); return;
      }
    } else { await player.decommission(interaction, 'media', await player.mediaEmbed(false), 'Queue is empty.'); }
  }
}