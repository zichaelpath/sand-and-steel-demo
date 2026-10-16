/* SAND & STEEL — Phase 5 tests (P22 animation quality; P23 checklist support).
 * Run: node --test client/phase5.test.js
 *
 * P22: the full ROMA 470 vocabulary is tabled with pack-exact timing
 * (charge 700ms / netcast 850ms), the pack JSONs agree with every table
 * entry, charge loops, blockhit/netcast play once, and the thraex sprite
 * resolves to its frame-identical Variants sheet (no more 404).
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Clips = require('./clips.js');
const Sprites = require('./sprites.js');

const PNGDIR = path.join(__dirname, '..', 'assets', 'fighters',
  'ROMA470_Gladiators_v0.3.0', 'Characters', 'PNG');
const JSON_OF = {
  murmillo: 'murmillo', secutor: 'secutor', retiarius: 'retiarius',
  thraex: 'secutor', rebel_champion: 'rebel_champion',
};
const TAG2CLIP = {
  Idle: 'idle', Walk: 'walk', Hold: 'hold', Attack: 'attack', Hit: 'hit',
  Death: 'death', Charge: 'charge', Block: 'block', BlockHit: 'blockhit',
  Dodge: 'dodge', NetCast: 'netcast',
};

describe('P22 full ROMA 470 clip vocabulary', () => {
  it('every fighter/side tables charge at exactly 700ms', () => {
    for (const f of Object.keys(Clips.CLIPS)) {
      for (const side of ['right', 'left']) {
        assert.strictEqual(Clips.totalMs(f, side, 'charge'), 700, f + '.' + side);
      }
    }
  });

  it('retiarius tables netcast at exactly 850ms; others lack it', () => {
    for (const side of ['right', 'left']) {
      assert.strictEqual(Clips.totalMs('retiarius', side, 'netcast'), 850, side);
    }
    for (const f of ['murmillo', 'secutor', 'thraex', 'rebel_champion']) {
      assert.throws(() => Clips.get(f, 'right', 'netcast'), /unknown clip/);
    }
  });

  it('every table entry matches its pack JSON range + per-frame durations', () => {
    let checked = 0;
    for (const fighter of Object.keys(Clips.CLIPS)) {
      const pack = JSON.parse(fs.readFileSync(path.join(PNGDIR, JSON_OF[fighter] + '.json'), 'utf8'));
      for (const side of ['right', 'left']) {
        for (const tag of pack.meta.frameTags) {
          const [tagSide, ...rest] = tag.name.split('_');
          if (tagSide !== side) continue;
          const clip = TAG2CLIP[rest.join('_')];
          assert.ok(clip, 'known tag ' + tag.name);
          const got = Clips.CLIPS[fighter][side][clip];
          assert.ok(got, 'tabled ' + fighter + '.' + side + '.' + clip);
          assert.strictEqual(got.from, tag.from, fighter + '.' + side + '.' + clip + ' from');
          assert.strictEqual(got.to, tag.to, fighter + '.' + side + '.' + clip + ' to');
          const want = pack.frames.slice(tag.from, tag.to + 1).map(f => f.duration);
          assert.deepStrictEqual(got.durs, want, fighter + '.' + side + '.' + clip + ' durs');
          checked++;
        }
      }
    }
    assert.ok(checked >= 100, 'checked ' + checked + ' pack tags');
  });

  it('charge loops; blockhit and netcast play once', () => {
    const SP = Sprites.createPlayer(Clips);
    assert.strictEqual(SP.isLoop('charge'), true);
    assert.strictEqual(SP.isLoop('blockhit'), false);
    assert.strictEqual(SP.isLoop('netcast'), false);
    const f = SP.makeFighter('murmillo', 'right');
    SP.setClip(f, 'charge');
    SP.step(f, 100000);
    assert.strictEqual(f.done, false, 'charge never finishes');
    SP.setClip(f, 'blockhit');
    assert.strictEqual(SP.step(f, 100000), true, 'blockhit finishes');
    const r = SP.makeFighter('retiarius', 'right');
    SP.setClip(r, 'netcast');
    assert.strictEqual(SP.step(r, 100000), true, 'netcast finishes');
  });

  it('thraex sprite resolves to the Variants sheet, not a 404 Characters URL', () => {
    const url = Sprites.spriteUrl('thraex');
    assert.ok(url.includes('Variants/PNG/thraex_appearance_1.png'), url);
    assert.ok(!url.includes('Characters/PNG/thraex.png'), url);
    assert.ok(Sprites.spriteUrl('murmillo').includes('Characters/PNG/murmillo.png'));
  });
});
