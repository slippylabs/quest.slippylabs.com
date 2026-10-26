// SlipKit music: the composer (pure) -- styles, theory, instruments as data.
// kit/audio/music.js plays a song; tools/music.mjs holds every style to the rules.
export * from './theory.js';
export { STYLES, STYLE_NAMES, GROOVES, FILLS } from './styles.js';
export { INSTRUMENTS, INSTRUMENT_NAMES, instrumentKind, DRUM } from './instruments.js';
export { compose, composeStinger, describeSong, resolveStyle, TIER_AT, tierOn } from './compose.js';
