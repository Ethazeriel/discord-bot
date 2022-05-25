import { APIMessage } from 'discord-api-types';
import { embedPage } from '../../regexes.js';
import Workspace from '../../workspace.js';
import { ButtonInteraction, GuildMember, InteractionDeferUpdateOptions, WebhookEditMessageOptions } from 'discord.js';

export const name = 'list';

export async function execute(interaction:ButtonInteraction, which:string) {
  await interaction.deferUpdate({ ephemeral: true } as InteractionDeferUpdateOptions);
  const workspace = Workspace.getWorkspace((interaction.member as GuildMember).user.id);
  let match = interaction.message.embeds[0].fields?.[0]?.value?.match(embedPage);
  if (!match) { match = ['0', '1']; }
  const currentPage = Number(match[1]);
  let reply:string | WebhookEditMessageOptions = 'uhoh';
  switch (which) {
    case 'prev': reply = await workspace.makeEmbed('Current Playlist:', (currentPage - 1), false) as WebhookEditMessageOptions; break;
    case 'refresh': reply = await workspace.makeEmbed('Current Playlist:', currentPage, false) as WebhookEditMessageOptions; break;
    case 'next': reply = await workspace.makeEmbed('Current Playlist:', (currentPage + 1), false) as WebhookEditMessageOptions; break;
    default: reply = 'everything is fucked'; break;
  }
  await interaction.editReply(reply);
}