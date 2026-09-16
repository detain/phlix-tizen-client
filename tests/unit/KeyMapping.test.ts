import { describe, it, expect } from 'vitest';
import KeyMapping from '@/remote/KeyMapping';

describe('KeyMapping', () => {
  describe('mapKeyCode', () => {
    it('maps known Samsung key codes to action names', () => {
      expect(KeyMapping.mapKeyCode(415)).toBe('PLAY');
      expect(KeyMapping.mapKeyCode(413)).toBe('STOP');
      expect(KeyMapping.mapKeyCode(19)).toBe('PAUSE');
      expect(KeyMapping.mapKeyCode(417)).toBe('FAST_FORWARD');
      expect(KeyMapping.mapKeyCode(412)).toBe('REWIND');
      expect(KeyMapping.mapKeyCode(10009)).toBe('BACK');
      expect(KeyMapping.mapKeyCode(36)).toBe('HOME');
      expect(KeyMapping.mapKeyCode(37)).toBe('LEFT');
      expect(KeyMapping.mapKeyCode(38)).toBe('UP');
      expect(KeyMapping.mapKeyCode(39)).toBe('RIGHT');
      expect(KeyMapping.mapKeyCode(40)).toBe('DOWN');
      expect(KeyMapping.mapKeyCode(13)).toBe('ENTER');
      expect(KeyMapping.mapKeyCode(1028)).toBe('VOLUME_UP');
      expect(KeyMapping.mapKeyCode(1029)).toBe('VOLUME_DOWN');
      expect(KeyMapping.mapKeyCode(1025)).toBe('MUTE');
    });

    it('returns UNKNOWN_{keyCode} for unknown key codes', () => {
      expect(KeyMapping.mapKeyCode(999)).toBe('UNKNOWN_999');
      expect(KeyMapping.mapKeyCode(0)).toBe('UNKNOWN_0');
      expect(KeyMapping.mapKeyCode(-1)).toBe('UNKNOWN_-1');
    });
  });

  describe('isRepeatable', () => {
    it('returns true for repeatable actions', () => {
      expect(KeyMapping.isRepeatable('FAST_FORWARD')).toBe(true);
      expect(KeyMapping.isRepeatable('REWIND')).toBe(true);
      expect(KeyMapping.isRepeatable('NEXT')).toBe(true);
      expect(KeyMapping.isRepeatable('PREVIOUS')).toBe(true);
      expect(KeyMapping.isRepeatable('VOLUME_UP')).toBe(true);
      expect(KeyMapping.isRepeatable('VOLUME_DOWN')).toBe(true);
    });

    it('returns false for non-repeatable actions', () => {
      expect(KeyMapping.isRepeatable('PLAY')).toBe(false);
      expect(KeyMapping.isRepeatable('PAUSE')).toBe(false);
      expect(KeyMapping.isRepeatable('STOP')).toBe(false);
      expect(KeyMapping.isRepeatable('BACK')).toBe(false);
      expect(KeyMapping.isRepeatable('HOME')).toBe(false);
      expect(KeyMapping.isRepeatable('LEFT')).toBe(false);
      expect(KeyMapping.isRepeatable('ENTER')).toBe(false);
    });
  });

  describe('isImmediate', () => {
    it('returns true for immediate actions', () => {
      expect(KeyMapping.isImmediate('PLAY')).toBe(true);
      expect(KeyMapping.isImmediate('PAUSE')).toBe(true);
      expect(KeyMapping.isImmediate('STOP')).toBe(true);
      expect(KeyMapping.isImmediate('BACK')).toBe(true);
      expect(KeyMapping.isImmediate('HOME')).toBe(true);
      expect(KeyMapping.isImmediate('PLAY_PAUSE')).toBe(true);
      expect(KeyMapping.isImmediate('RED')).toBe(true);
      expect(KeyMapping.isImmediate('GREEN')).toBe(true);
      expect(KeyMapping.isImmediate('YELLOW')).toBe(true);
      expect(KeyMapping.isImmediate('BLUE')).toBe(true);
      expect(KeyMapping.isImmediate('MUTE')).toBe(true);
      expect(KeyMapping.isImmediate('MENU')).toBe(true);
      expect(KeyMapping.isImmediate('INFO')).toBe(true);
      expect(KeyMapping.isImmediate('TOOLS')).toBe(true);
    });

    it('returns false for non-immediate actions', () => {
      expect(KeyMapping.isImmediate('FAST_FORWARD')).toBe(false);
      expect(KeyMapping.isImmediate('REWIND')).toBe(false);
      expect(KeyMapping.isImmediate('LEFT')).toBe(false);
      expect(KeyMapping.isImmediate('ENTER')).toBe(false);
      expect(KeyMapping.isImmediate('VOLUME_UP')).toBe(false);
    });
  });

  describe('isHandled', () => {
    it('returns true for handled actions (union of repeatable and immediate)', () => {
      // From repeatable
      expect(KeyMapping.isHandled('FAST_FORWARD')).toBe(true);
      expect(KeyMapping.isHandled('REWIND')).toBe(true);
      expect(KeyMapping.isHandled('VOLUME_UP')).toBe(true);
      // From immediate only
      expect(KeyMapping.isHandled('PLAY')).toBe(true);
      expect(KeyMapping.isHandled('BACK')).toBe(true);
      expect(KeyMapping.isHandled('RED')).toBe(true);
    });

    it('returns false for unhandled actions (arrows, enter)', () => {
      expect(KeyMapping.isHandled('LEFT')).toBe(false);
      expect(KeyMapping.isHandled('UP')).toBe(false);
      expect(KeyMapping.isHandled('RIGHT')).toBe(false);
      expect(KeyMapping.isHandled('DOWN')).toBe(false);
      expect(KeyMapping.isHandled('ENTER')).toBe(false);
    });
  });

  describe('getDisplayName', () => {
    it('returns display name for known actions', () => {
      expect(KeyMapping.getDisplayName('LEFT')).toBe('Left Arrow');
      expect(KeyMapping.getDisplayName('RIGHT')).toBe('Right Arrow');
      expect(KeyMapping.getDisplayName('UP')).toBe('Up Arrow');
      expect(KeyMapping.getDisplayName('DOWN')).toBe('Down Arrow');
      expect(KeyMapping.getDisplayName('ENTER')).toBe('OK');
      expect(KeyMapping.getDisplayName('BACK')).toBe('Back');
      expect(KeyMapping.getDisplayName('HOME')).toBe('Home');
      expect(KeyMapping.getDisplayName('PLAY')).toBe('Play');
      expect(KeyMapping.getDisplayName('STOP')).toBe('Stop');
      expect(KeyMapping.getDisplayName('PAUSE')).toBe('Pause');
      expect(KeyMapping.getDisplayName('FAST_FORWARD')).toBe('Fast Forward');
      expect(KeyMapping.getDisplayName('REWIND')).toBe('Rewind');
      expect(KeyMapping.getDisplayName('NEXT')).toBe('Next');
      expect(KeyMapping.getDisplayName('PREVIOUS')).toBe('Previous');
      expect(KeyMapping.getDisplayName('RED')).toBe('Red');
      expect(KeyMapping.getDisplayName('GREEN')).toBe('Green');
      expect(KeyMapping.getDisplayName('YELLOW')).toBe('Yellow');
      expect(KeyMapping.getDisplayName('BLUE')).toBe('Blue');
      expect(KeyMapping.getDisplayName('VOLUME_UP')).toBe('Volume Up');
      expect(KeyMapping.getDisplayName('VOLUME_DOWN')).toBe('Volume Down');
      expect(KeyMapping.getDisplayName('MUTE')).toBe('Mute');
      expect(KeyMapping.getDisplayName('MENU')).toBe('Menu');
      expect(KeyMapping.getDisplayName('INFO')).toBe('Info');
      expect(KeyMapping.getDisplayName('TOOLS')).toBe('Tools');
      expect(KeyMapping.getDisplayName('PLAY_PAUSE')).toBe('Play/Pause');
    });

    it('returns the action itself for unknown actions (lines 160-164)', () => {
      expect(KeyMapping.getDisplayName('CUSTOM_ACTION')).toBe('CUSTOM_ACTION');
      expect(KeyMapping.getDisplayName('UNKNOWN_123')).toBe('UNKNOWN_123');
      expect(KeyMapping.getDisplayName('FOO_BAR')).toBe('FOO_BAR');
    });
  });

  describe('KEY_MAP', () => {
    it('contains all expected key codes', () => {
      const keys = Object.keys(KeyMapping.KEY_MAP);
      // Navigation
      expect(keys).toContain('37'); // LEFT
      expect(keys).toContain('38'); // UP
      expect(keys).toContain('39'); // RIGHT
      expect(keys).toContain('40'); // DOWN
      expect(keys).toContain('13'); // ENTER
      expect(keys).toContain('10009'); // BACK
      expect(keys).toContain('36'); // HOME
      // Playback
      expect(keys).toContain('415'); // PLAY
      expect(keys).toContain('413'); // STOP
      expect(keys).toContain('19'); // PAUSE
      expect(keys).toContain('417'); // FF
      expect(keys).toContain('412'); // REW
      expect(keys).toContain('424'); // PREVIOUS
      expect(keys).toContain('425'); // NEXT
      // Color buttons
      expect(keys).toContain('403'); // RED
      expect(keys).toContain('404'); // GREEN
      expect(keys).toContain('405'); // YELLOW
      expect(keys).toContain('406'); // BLUE
      // Volume
      expect(keys).toContain('1028'); // VOLUME_UP
      expect(keys).toContain('1029'); // VOLUME_DOWN
      expect(keys).toContain('1025'); // MUTE
      // Menu
      expect(keys).toContain('10282'); // MENU
      expect(keys).toContain('18'); // INFO
      expect(keys).toContain('113'); // TOOLS
      // Digits
      expect(keys).toContain('48'); // 0
      expect(keys).toContain('49'); // 1
      expect(keys).toContain('57'); // 9
      // Tizen specific
      expect(keys).toContain('66'); // PLAY_PAUSE
      expect(keys).toContain('79'); // OPTIONS
    });
  });

  // S509 (AD-1) — the media-transport / channel codes now reachable via
  // tvinputdevice registration, and the named digit-key routing groundwork.
  describe('S509 media + channel + digit seams', () => {
    it('maps the 2020+ media / channel key codes', () => {
      expect(KeyMapping.mapKeyCode(10252)).toBe('PLAY_PAUSE');
      expect(KeyMapping.mapKeyCode(427)).toBe('CHANNEL_UP');
      expect(KeyMapping.mapKeyCode(428)).toBe('CHANNEL_DOWN');
    });

    it('treats channel keys as immediate (fire on keydown)', () => {
      expect(KeyMapping.isImmediate('CHANNEL_UP')).toBe(true);
      expect(KeyMapping.isImmediate('CHANNEL_DOWN')).toBe(true);
      expect(KeyMapping.isHandled('CHANNEL_UP')).toBe(true);
    });

    it('gives channel keys display names', () => {
      expect(KeyMapping.getDisplayName('CHANNEL_UP')).toBe('Channel Up');
      expect(KeyMapping.getDisplayName('CHANNEL_DOWN')).toBe('Channel Down');
    });

    it('names digit codes DIGIT_0..DIGIT_9 (routing groundwork)', () => {
      expect(KeyMapping.mapKeyCode(48)).toBe('DIGIT_0');
      expect(KeyMapping.mapKeyCode(49)).toBe('DIGIT_1');
      expect(KeyMapping.mapKeyCode(57)).toBe('DIGIT_9');
    });

    it('recognises digit actions via isDigit, and NOT digit actions otherwise', () => {
      expect(KeyMapping.isDigit('DIGIT_0')).toBe(true);
      expect(KeyMapping.isDigit('DIGIT_9')).toBe(true);
      for (const other of ['PLAY', 'ENTER', 'BACK', 'UNKNOWN_1', '0']) {
        expect(KeyMapping.isDigit(other)).toBe(false);
      }
    });

    it('keeps digits OUT of immediate/handled so text-input typing is untouched', () => {
      // The groundwork routes the token; it must not swallow the key (AD-22's
      // commit buffer would add handling — not this step).
      expect(KeyMapping.isImmediate('DIGIT_1')).toBe(false);
      expect(KeyMapping.isHandled('DIGIT_1')).toBe(false);
      expect(KeyMapping.isRepeatable('DIGIT_1')).toBe(false);
    });

    it('displays digits as their numeral', () => {
      expect(KeyMapping.getDisplayName('DIGIT_7')).toBe('7');
    });

    it('KEY_MAP contains the new S509 codes', () => {
      const keys = Object.keys(KeyMapping.KEY_MAP);
      expect(keys).toContain('10252');
      expect(keys).toContain('427');
      expect(keys).toContain('428');
    });
  });
});
