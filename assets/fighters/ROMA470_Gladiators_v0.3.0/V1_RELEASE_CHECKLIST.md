# v1.0 release gates

v0.3.0 is a local candidate. A version number alone does not certify completion.

## Completed in this iteration

- [x] Preserve six fighters and four appearances each; no new faction scope.
- [x] Match Attack/Hit/Dodge endpoints to Idle and BlockHit endpoints to Block.
- [x] Improve stance/swing leg timing and publish profile movement speeds.
- [x] Let dropped gear settle over several death frames.
- [x] Persist Retiarius' thrown-net state with native no-net directional exports.
- [x] Supply smaller sheets, consistent pivots, durations and combat event metadata.
- [x] Build isolated playable combat workshop from shipped exports.
- [x] Check collision direction/range, guard timing, dodge windows, net release,
      cooldown and capture, death persistence and frame-rate-independent timing.
- [x] Compare 32 native sources against full and directional exports.

## Still required before v1.0

- [ ] Artistic sign-off by the creator at actual game scale: profile/rear grip,
      heavy sword silhouette, locomotion-to-combat transitions and deaths.
      The automated audit cannot judge naturalness or appeal.
- [ ] Import the clean archive into at least one agreed target engine
      (Unity or Godot); verify clipping, pivots, pixel filtering, playback timing,
      event conversion and the persistent net state there.
- [ ] Have a second person follow the guide without assistance and report
      ambiguities/missing files. No external testing is claimed in this release.
- [ ] Resolve findings and lock the manifest, license, screenshots and claims.
- [ ] Synchronize the itch listing/download after release approval; the local
      build does not update the live product automatically.

Possible later additions, not requirements for v1.0: more fighters, arena props,
audio, eight directions, engine-specific controllers, competitive combat balance.
