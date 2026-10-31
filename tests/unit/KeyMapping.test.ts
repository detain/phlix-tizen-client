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
    // M-TIZEN-09 (review tizen__gameux M1): the repeatable set is the SEEK
    // ACCELERATORS ALONE. NEXT/PREVIOUS/VOLUME_* leave it — a held track-skip
    // or volume key repeating at the interval cadence was a 10 Hz action storm
    // into a default arm; one press is one discrete step (immediate, below).
    it('returns true for the seek-accelerator actions', () => {
      expect(KeyMapping.isRepeatable('FAST_FORWARD')).toBe(true);
      expect(KeyMapping.isRepeatable('REWIND')).toBe(true);
    });

    it('returns false for single-step and non-repeat actions', () => {
      expect(KeyMapping.isRepeatable('NEXT')).toBe(false);
      expect(KeyMapping.isRepeatable('VOLUME_UP')).toBe(false);
      expect(KeyMapping.isRepeatable('VOLUME_DOWN')).toBe(false);
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
      expect(KeyMapping.isImmediate('YELLOW')).toBe(true);
      expect(KeyMapping.isImmediate('MUTE')).toBe(true);
      // M-TIZEN-09: the transport taps join the immediate vocabulary — a lone
      // FF/REW press emits the bridge's already-designed ±10 s seek step
      // (repeatable AND immediate: hold still adds ±30 s steps).
      expect(KeyMapping.isImmediate('FAST_FORWARD')).toBe(true);
      expect(KeyMapping.isImmediate('REWIND')).toBe(true);
      expect(KeyMapping.isImmediate('NEXT')).toBe(true);
      expect(KeyMapping.isImmediate('VOLUME_UP')).toBe(true);
      expect(KeyMapping.isImmediate('VOLUME_DOWN')).toBe(true);
    });

    it('returns false for unclassified and retired actions', () => {
      // LEFT/ENTER stay spatial-nav/native-owned; RED/GREEN/BLUE/MENU/INFO/
      // TOOLS were RETIRED with their mappings (M-TIZEN-09) — the names can no
      // longer even be produced by mapKeyCode, and stay out of every set.
      expect(KeyMapping.isImmediate('LEFT')).toBe(false);
      expect(KeyMapping.isImmediate('ENTER')).toBe(false);
      expect(KeyMapping.isImmediate('RED')).toBe(false);
      expect(KeyMapping.isImmediate('GREEN')).toBe(false);
      expect(KeyMapping.isImmediate('BLUE')).toBe(false);
      expect(KeyMapping.isImmediate('MENU')).toBe(false);
      expect(KeyMapping.isImmediate('INFO')).toBe(false);
      expect(KeyMapping.isImmediate('TOOLS')).toBe(false);
    });
  });

  describe('isSilentAction — the M-TIZEN-01/M-TIZEN-32 one-set law', () => {
    it('names exactly the silent trio', () => {
      expect(KeyMapping.isSilentAction('DIGIT_COMMIT')).toBe(true);
      expect(KeyMapping.isSilentAction('CHANNEL_UP')).toBe(true);
      expect(KeyMapping.isSilentAction('CHANNEL_DOWN')).toBe(true);
    });

    it('refuses everything a viewer could believe was echoed', () => {
      // Immediate consumer actions:
      for (const key of ['PLAY', 'PAUSE', 'STOP', 'BACK', 'HOME', 'NEXT', 'VOLUME_UP', 'MUTE', 'FAST_FORWARD', 'REWIND']) {
        expect(KeyMapping.isSilentAction(key), key).toBe(false);
      }
      // Digits themselves are NOT silent (they are plain numeral input echoes
      // while typing is impossible… they never caption because RemoteManager
      // does not emit them as actions — the SILENT set covers the drain only):
      expect(KeyMapping.isSilentAction('DIGIT_5')).toBe(false);
      // Unknown mappings are not silent either (a future mapping must opt in
      // by name — the set is exhaustive-by-review, never by catch-all):
      expect(KeyMapping.isSilentAction('UNKNOWN_99999')).toBe(false);
    });

    it('every silent action still keeps a display row (vocabulary, not echo)', () => {
      expect(KeyMapping.getDisplayName('DIGIT_COMMIT')).toBe('Digits');
      expect(KeyMapping.getDisplayName('CHANNEL_UP')).toBe('Channel Up');
      expect(KeyMapping.getDisplayName('CHANNEL_DOWN')).toBe('Channel Down');
    });

    it('the channel pair stays immediate+handled — silencing the caption did not change the swallow', () => {
      for (const key of ['CHANNEL_UP', 'CHANNEL_DOWN']) {
        expect(KeyMapping.isImmediate(key), key).toBe(true);
        expect(KeyMapping.isHandled(key), key).toBe(true);
      }
    });
  });

  describe('isHandled', () => {    it('returns true for handled actions (union of repeatable and immediate)', () => {
      // From repeatable
      expect(KeyMapping.isHandled('FAST_FORWARD')).toBe(true);
      expect(KeyMapping.isHandled('REWIND')).toBe(true);
      // From immediate (M-TIZEN-09: volume + next are immediate now)
      expect(KeyMapping.isHandled('VOLUME_UP')).toBe(true);
      expect(KeyMapping.isHandled('NEXT')).toBe(true);
      expect(KeyMapping.isHandled('MUTE')).toBe(true);
      expect(KeyMapping.isHandled('PLAY')).toBe(true);
      expect(KeyMapping.isHandled('BACK')).toBe(true);
    });

    it('returns false for unhandled actions (arrows, enter, retired keys)', () => {
      expect(KeyMapping.isHandled('LEFT')).toBe(false);
      expect(KeyMapping.isHandled('UP')).toBe(false);
      expect(KeyMapping.isHandled('RIGHT')).toBe(false);
      expect(KeyMapping.isHandled('DOWN')).toBe(false);
      expect(KeyMapping.isHandled('ENTER')).toBe(false);
      // Retired by M-TIZEN-09: no longer mapped AND no longer swallowed —
      // their codes reach the webview/system unhandled (honest pass-through).
      expect(KeyMapping.isHandled('RED')).toBe(false);
      expect(KeyMapping.isHandled('MENU')).toBe(false);
      expect(KeyMapping.isHandled('INFO')).toBe(false);
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
      expect(KeyMapping.getDisplayName('YELLOW')).toBe('Yellow');
      expect(KeyMapping.getDisplayName('VOLUME_UP')).toBe('Volume Up');
      expect(KeyMapping.getDisplayName('VOLUME_DOWN')).toBe('Volume Down');
      expect(KeyMapping.getDisplayName('MUTE')).toBe('Mute');
      expect(KeyMapping.getDisplayName('PLAY_PAUSE')).toBe('Play/Pause');
    });

    // M-TIZEN-09: retired vocabulary has NO display row — the names fall
    // through to the raw-token arm, and the KEY_MAP pins below prove no key
    // can even produce them. A caption for a dead key was part of the lie.
    it('has no display rows for the retired M-TIZEN-09 actions', () => {
      for (const dead of ['PREVIOUS', 'RED', 'GREEN', 'BLUE', 'MENU', 'INFO', 'TOOLS']) {
        expect(KeyMapping.getDisplayName(dead)).toBe(dead);
      }
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
      expect(keys).toContain('425'); // NEXT
      // Color buttons — YELLOW only after M-TIZEN-09
      expect(keys).toContain('405'); // YELLOW
      // Volume
      expect(keys).toContain('1028'); // VOLUME_UP
      expect(keys).toContain('1029'); // VOLUME_DOWN
      expect(keys).toContain('1025'); // MUTE
      // Digits
      expect(keys).toContain('48'); // 0
      expect(keys).toContain('49'); // 1
      expect(keys).toContain('57'); // 9
      // Tizen specific
      expect(keys).toContain('66'); // PLAY_PAUSE
    });

    // M-TIZEN-09 (review tizen__gameux M1) — the dead half of the vocabulary
    // is ABSENT from the map: a mapping with zero consumers on both sides of
    // the bridge is a lie in code. These codes now resolve to UNKNOWN_* and
    // pass through RemoteManager unhandled (native/system behavior).
    it('drops the dead-key codes from KEY_MAP (dead mapping = lie in code)', () => {
      const keys = Object.keys(KeyMapping.KEY_MAP);
      expect(keys).not.toContain('424'); // PREVIOUS — no store seam both-sides
      expect(keys).not.toContain('403'); // RED
      expect(keys).not.toContain('404'); // GREEN
      expect(keys).not.toContain('406'); // BLUE
      expect(keys).not.toContain('10282'); // MENU — TV system surface, not ours to swallow
      expect(keys).not.toContain('18'); // INFO (also desktop Alt)
      expect(keys).not.toContain('113'); // TOOLS (also desktop F2)
      expect(keys).not.toContain('79'); // OPTIONS — never emitted, never handled
      expect(KeyMapping.mapKeyCode(424)).toBe('UNKNOWN_424');
      expect(KeyMapping.mapKeyCode(403)).toBe('UNKNOWN_403');
      expect(KeyMapping.mapKeyCode(10282)).toBe('UNKNOWN_10282');
    });
  });

  // S509 (AD-1) — the media-transport codes still reachable via tvinputdevice
  // registration, and the named digit-key routing groundwork. M-TIZEN-09's
  // vocabulary audit KEPT the channel pair as the documented live-TV-zap
  // defensive swallow (re-pinned here as law, with its rationale).
  describe('S509 media + digit seams (M-TIZEN-09 amended)', () => {
    it('maps the 2020+ PLAY_PAUSE media code', () => {
      expect(KeyMapping.mapKeyCode(10252)).toBe('PLAY_PAUSE');
    });

    it('KEEPS the channel keys as the documented defensive swallow (M-TIZEN-09 audit)', () => {
      // Not a functional consumer — an ActionToast caption with no effect —
      // but the immediate+handled preventDefault IS the documented guard that
      // stops a registered channel press zapping the app to live TV
      // (DEVELOPER.md S509 prose). Registration + swallow stay by law; the
      // misleading caption is a reported MINOR residual, not an M1 lie.
      expect(KeyMapping.mapKeyCode(427)).toBe('CHANNEL_UP');
      expect(KeyMapping.mapKeyCode(428)).toBe('CHANNEL_DOWN');
      expect(KeyMapping.isImmediate('CHANNEL_UP')).toBe(true);
      expect(KeyMapping.isImmediate('CHANNEL_DOWN')).toBe(true);
      expect(KeyMapping.isHandled('CHANNEL_UP')).toBe(true);
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
      // S535 UPDATE-ASSERTS (never weakens) this pin to the live contract: the
      // commit buffer is a SEPARATE digit branch in RemoteManager, so digits
      // STILL never reach IMMEDIATE/HANDLED — that is precisely why typing-target
      // digits stay the byte-identical passthrough ("1984") and are never
      // preventDefaulted, on any focus.
      expect(KeyMapping.isImmediate('DIGIT_1')).toBe(false);
      expect(KeyMapping.isHandled('DIGIT_1')).toBe(false);
      expect(KeyMapping.isRepeatable('DIGIT_1')).toBe(false);
    });

    it('displays digits as their numeral', () => {
      expect(KeyMapping.getDisplayName('DIGIT_7')).toBe('7');
    });

    it('KEY_MAP contains the S509 codes (channel pair kept as the zap-guard)', () => {
      const keys = Object.keys(KeyMapping.KEY_MAP);
      expect(keys).toContain('10252');
      expect(keys).toContain('427');
      expect(keys).toContain('428');
    });
  });

  // S535 (AD-22) — the drain action joins the ONE vocabulary; digitValue is the
  // digit-char parse the buffer feed uses (keys and voice share it).
  describe('S535 digit-commit vocabulary', () => {
    it('exposes DIGIT_COMMIT as a named action (not a key code)', () => {
      expect(KeyMapping.DIGIT_COMMIT).toBe('DIGIT_COMMIT');
      expect(Object.values(KeyMapping.KEY_MAP)).not.toContain('DIGIT_COMMIT');
      // The drain is still not an immediate/handled key — it is emitted by the
      // buffer, never routed through those sets.
      expect(KeyMapping.isImmediate('DIGIT_COMMIT')).toBe(false);
      expect(KeyMapping.isHandled('DIGIT_COMMIT')).toBe(false);
      expect(KeyMapping.isDigit('DIGIT_COMMIT')).toBe(false);
    });

    it('digitValue parses DIGIT_0..9 to its numeral and refuses everything else', () => {
      for (let n = 0; n <= 9; n++) {
        expect(KeyMapping.digitValue(`DIGIT_${n}`)).toBe(String(n));
      }
      expect(KeyMapping.digitValue('PLAY')).toBeNull();
      expect(KeyMapping.digitValue('DIGIT_10')).toBeNull();
      expect(KeyMapping.digitValue('DIGIT_COMMIT')).toBeNull();
      expect(KeyMapping.digitValue('')).toBeNull();
    });

    it('captions the commit action with a real display name (toast surface need)', () => {
      // ActionToastOverlay captions EVERY action via getDisplayName — an unmapped
      // DIGIT_COMMIT would flash the raw token, so the display need is pinned.
      expect(KeyMapping.getDisplayName('DIGIT_COMMIT')).toBe('Digits');
      expect(KeyMapping.getDisplayName('DIGIT_COMMIT')).not.toBe('DIGIT_COMMIT');
    });
  });
});
