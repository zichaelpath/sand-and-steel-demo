# Changelog

## 0.3.0 — Local release candidate

- Murmillo/Secutor attacking forearms, hands and swords now pass in front of
  the shield during the strike.
- Fixed attack depth: dedicated forearm, weapon and grip layers;
  rear/profile torso and helmet occlusion are preserved in native attack cels.
- Matched Attack/Hit/Dodge endpoints to Idle; BlockHit now returns to the raised
  Block pose. Reference demo lowers Block by reversing its raising frames.
- Reworked stance/swing timing with profile speed/foot-contact metadata.
- Dropped weapons and shields settle through multiple death frames.
- Separated held-net layers and supplied persistent no-net Retiarius exports.
- Changed net flight to unfold once and hold its open form.
- Added 120 compact directional sheets plus 20 no-net sheets, all below 2048px.
- Added an offline playable combat workshop, 19 simulation checks and a native
  audit of directional exports, transition endpoints and planted-foot drift.
- Documented migration, event semantics and remaining v1.0 release gates.

## 0.2.0
- Reworked charge with push-off, lower knee lift, shoulder motion and torso lean.
- Articulated deaths: knees collapse, hips descend, torso folds, equipment settles.
- Differentiated six attack profiles, including high/low gladius thrusts.
- Added Block, BlockHit and Dodge to every fighter in all four views.
- Added Retiarius NetCast and separate net flight/landing effects.
- Added authored right/left profiles and corrected rear equipment depth.
- Added 24 complete appearance variants using four skin palettes, four hair
  colours, eight hairstyles and four outfit palettes; no hair beneath helmets.
- Added JSON hand anchors, suggested combat events and updated offline catalogue.

## 0.1.0
Six fighters, seven actions, front/rear views and editable native Aseprite sources.
