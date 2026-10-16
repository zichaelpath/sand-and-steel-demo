# Import guide — v0.3.0

## Choose an export

Use a PNG with its adjacent JSON from **Directional/**. All frames are 128 × 128,
transparent and untrimmed. Each sheet has eight columns. Each of the five standard
fighters has 77 frames per direction in a 1024 × 1280 texture. Retiarius has 87
frames in 1024 × 1408. All fit a 2048 texture limit without downsampling.

Characters/PNG and Variants/PNG also retain complete four-view sheets for existing
workflows: 1024 × 4992 or 1024 × 5632. They need a suitable texture-size limit
(often 8192). Effects/PNG sheets are 1024 × 128. Unused grid cells are transparent.

Use point/nearest filtering, no mipmaps and no lossy compression. Suggested ground
pivot is **(64,114)** in top-left pixels, or **(0.5,0.109375)** normalized from the
bottom left, at 72 pixels per unit. Net flight uses (64,64); landing uses (64,80).

`Characters/catalog.json` lists files, appearances and directional/no-net exports.
Tags and events in each directional JSON refer to that local sheet. Do not use
the full sheet's frame indices with a directional texture. `sourceFrameOffset`
maps local indices to the complete source: full index = local index + offset.

## Animation state and transitions

Read each frame's `duration` in milliseconds. Tag ranges are inclusive and
zero-based. Idle, Walk, Hold and Charge loop; all other character actions play
once. Effects also play once; hold the last flight frame while travelling and
hold the final landing frame as needed.

Attack, Hit and Dodge now begin/end in the first Idle pose. NetCast recovers to
the same body pose with its net absent. Death holds its final corpse pose.
Block raises the guard: hold its last frame while blocking. BlockHit starts and
ends in that same guard pose. To lower the guard, play Block backwards; this is
demonstrated as `BlockRelease` in the example code, not a separate source tag.
Hold remains an optional ready stance rather than the Block pose.

Changing view should preserve the equivalent action frame and elapsed frame
time. Four views preserve anatomical handedness using authored layer depth;
do not flip a finished sprite to substitute for its opposite view.

These source endpoints remove specific idle/one-shot jumps. Arbitrary action
cancellation, locomotion/guard transitions and hit interruption still require
the game to choose appropriate transition rules. The demo uses simple interrupt
rules and is a reference, not an animation-blending system.

## Movement and anchors

Frame `anchors` contains right_hand, left_hand, near_foot, far_foot and ground,
in top-left source pixels. Add actor position minus pivot, then apply scale.
`footContacts` marks stance frames in Walk/Charge. `rootMotion.x` is a recommended
per-frame horizontal displacement, not baked movement of the image; its
`profileOnly` flag restricts that recommendation to the left/right views.

Walk's profile stride is 48 pixels per 840ms cycle (~57.14px/s). Charge is 76
pixels per 700ms (~108.57px/s), or 60 per 700ms (~85.71px/s) for Murmillo/Secutor.
`tag.motion` records the stride and cycle. Move the actor uniformly at that speed;
do not apply both that speed and per-frame rootMotion. Native stance anchors
cancel the profile displacement to within one pixel of rounding. Front/rear
travel speed and projection remain the integrating game's choice.

## Combat events and net state

`meta.events` contains absolute zero-based frame indices within its JSON file.
Attack active start is local frame 5; active end is local frame 7. Dodge active
start/end are local frames 3/6. These are suggested hit/invulnerability windows.
The reference uses the start boundary inclusively, end boundary exclusively.
Process every entered frame, even when an update spans multiple frame durations.

Retiarius spawns its net on NetCast frame 6 at `anchors.left_hand`. The native
equipped net disappears on that frame. Move `net_projectile` toward the target;
switch to `net_landed` on impact. After release, switch the actor to the matching
**_no_net** directional PNG/JSON, preserving action progress. Continue using it
after recovery, while walking, fighting or dying, until the game restores the net.
Every original/appearance Retiarius has these complete no-net exports.

The editable held net now occupies dedicated `Far held net` and `Near held net`
layers, placed at the appropriate depth. No-net sheets are Aseprite renders with
both disabled. Shield and weapon layers are unaffected. This also removes the
dropped net in a no-net Death animation, avoiding a duplicate net at the corpse.

The workshop is deliberately simple: side-on collision, one hit per attack,
frontal guards, event-based dodge protection, a 1.6s net snare and a 4s net recovery.
Its values are examples, not a claim of combat balance. It requires no runtime
libraries or web services. It can also be served by any static local server.

## Migration and editing

Existing v0.2 tag names/counts remain; artwork, events and JSON fields changed.
Replace matching PNG/JSON pairs together. Native characters now have 24 layers
(19 in v0.2; 21 before the v0.3 attack-depth correction); edit by layer name rather than a hard-coded numeric index.
Both near/far equipment sets may require edits. Re-export from native sources
after changing bodies, colours, equipment or poses.

The package includes no Unity/Godot-specific importer or verified engine template.
A fresh import into at least one target game engine remains a v1.0 release gate.

Attack forearm, Attack weapon and Attack grip are dedicated strike-depth layers.
They are populated only for Attack frames 2–9. Far-side body/head occlusion is
authored in those cels; preserve layer order when editing and exporting.

Murmillo/Secutor attacking forearms, hands and swords pass in front of their
shields during the strike. Keep all three Attack layers above Shield.
