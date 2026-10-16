# ROMA 470 — Gladiators: The Unbroken v0.3.0

Six fighters based on the approved ROMA 470 body: Freed Rebel, Retiarius,
Thraex, Murmillo, Secutor and Rebel Champion. This local release adds animation
polish and a playable integration example on the path to v1.0.

## Start here

- Open **index.html** for the animation catalogue.
- Open **CombatDemo/index.html** for a playable, isolated combat workshop.
  Pick a fighter, appearance, opponent and training mode. It supports walking,
  charging, attacks, blocking, dodging, defeat and an actual thrown net.
- For a game, start with **Directional/** PNG and JSON pairs; read IMPORT_GUIDE.md.
- Edit the native **Characters/Source**, **Variants/Source** and **Effects/Source**
  Aseprite files. These are the source artwork, not flattened PNG imports.

## Contents

- Ten actions in four authored views: Idle, Walk, Hold, Attack, Hit, Death,
  Charge, Block, BlockHit and Dodge. Retiarius additionally has NetCast.
- 1,888 base character frames / 244 base clips. Five characters have 308
  frames / 40 clips each; Retiarius has 348 frames / 44 clips.
- 24 additional complete appearances, four per fighter. Four skin palettes,
  four hair colours, eight hairstyles across unhelmeted fighters, and four
  cloth/shield palettes. Curated combinations, not every possible permutation.
  Hair is excluded beneath helmets.
- Two independent net effects: flight/unfolding and landing, 16 frames total.
- 32 native Aseprite files: 30 characters/appearances and two effects.
  Characters retain 24 named editable layers. 9,456 unique exported source frames
  and 1,222 source animation clips, including appearances and effects.
- Transparent 128 × 128 frames, PNG sheets and JSON. Whole-character sheets remain
  available; 120 per-direction sheets provide the same frames in smaller textures.
  Another 20 directional sheets show Retiarius without the thrown net.
  These alternate layouts/states are not new fighters or additional unique clips.
- Per-frame hand and foot anchors, foot-contact flags, suggested combat events,
  and recommended locomotion speed for the left/right profile views.
- Dependency-free JavaScript reference demo and automated checks.

All artwork is drawn into native Aseprite cels through AI-assisted Lua authoring.
PNGs and preview GIFs are exports of those sources. Personal and commercial use
under LICENSE.txt; future updates to this same product are included.

This pack does not include terrain, a horse, sound, an engine project, automatic
equipment swapping or production-ready combat AI. It does not require the main
pack. The faction is a deliberately anachronistic Spartacus-inspired addition.

## Editing and rebuilding

Aseprite is sold separately. `Authoring/build.lua` assembles the pixel authoring
modules. Run:

```
Aseprite --batch --script-param root=<package folder> --script <package folder>/Authoring/build.lua
```

After editing a module, regenerate build.lua by concatenating base.lua,
equipment.lua and animation.lua after `local root=assert(app.params.root)`.
Run Authoring/audit.lua with the same root parameter to verify native exports.
Regenerate catalog-data.js after changing metadata before using the HTML previews.
The demo's reference code and tests are in CombatDemo/. With Node installed:

```
node CombatDemo/combat-tests.js <package folder>
```

NATIVE_VALIDATION.json records the native/export audit; Validation/COMBAT_TESTS.json
records simulation checks. See V1_RELEASE_CHECKLIST.md for outstanding release gates.
