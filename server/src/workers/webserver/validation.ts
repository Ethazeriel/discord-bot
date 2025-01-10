import Joi from 'joi';
import { napsterPattern, spotifyPattern, youtubePattern, youtubePlaylistPattern, sanitize } from '../../regexes.js';
import subsonic from '../acquire/subsonic.js';

// if we match one of these, it's something we know about in acquire
export const acquireRegexSchema = Joi.alternatives().match('one').try(
  Joi.string().regex(spotifyPattern),
  Joi.string().regex(subsonic.searchRegex),
  Joi.string().regex(youtubePattern),
  Joi.string().regex(youtubePlaylistPattern),
  Joi.string().regex(napsterPattern)
);

// same as above, but also allow any string after feeding through sanitize
export const acquireSafeSchema = Joi.alternatives().match('one').try(
  Joi.string().regex(spotifyPattern),
  Joi.string().regex(subsonic.searchRegex),
  Joi.string().regex(youtubePattern),
  Joi.string().regex(youtubePlaylistPattern),
  Joi.string().regex(napsterPattern),
  Joi.string().normalize().replace(sanitize, '').trim()
);

export const playerQueueSchema = Joi.object({
  action: Joi.string().regex(/^(get|slowmode|prev|next|jump|seek|togglePause|toggleLoop|pendingIndex|move|remove|empty|shuffle|failedIndex)$/).required(),
  parameter: Joi.alternatives().conditional(Joi.ref('action'), [
    { is: 'jump', then: Joi.number().integer().min(0) },
    { is: 'seek', then: Joi.string() },
    { is: 'togglePause', then: Joi.boolean() },
    { is: 'pendingIndex', then: Joi.object({ index: Joi.number().integer().min(0).required(), query: acquireRegexSchema.required() }) },
    { is: 'move', then: Joi.object({ from: Joi.number().integer().min(0).required(), to: Joi.number().integer().min(0).required(), UUID: Joi.string().uuid().required() }) },
    { is: 'remove', then: Joi.number().integer().min(0) },
    { is: 'shuffle', then: Joi.boolean() },
    { is: 'failedIndex', then: Joi.object({ UUID: Joi.string().uuid().required(), query: acquireSafeSchema.required() }) }
  ])
});
