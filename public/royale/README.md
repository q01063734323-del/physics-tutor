# Physics Royale — original vector resources

All artwork in this directory was drawn as original SVG for Physics Tutor. No external images, fonts, copied game characters, trademarks or purchased assets are used. The fantasy archetypes are generic; the shield crests, armour, faces and scenery are original.

- `card-{id}.svg`: 256×320 card portraits. Names/energy/rarity should be rendered by the application for accessibility and localisation.
- `unit-{id}.svg`: 128×128 transparent sprites, anchor (64,116). `archers`, `skeletons`, `guardians` show one combatant in the unit sprite and a group in the card portrait. The game should spawn its configured troop count.
- `tower.svg`: 128×160, anchor (64,148).
- `castle.svg`: 160×192, anchor (80,178).
- `arena.svg`: 420×720 decorative vertical arena, river y=344–376, bridge centers x=110/310, playable bridge half-width 23 (matching the engine). It is only an image, not a source of gameplay collisions; the engine owns traversability.
- `crystal.svg` / `trophy.svg`: original 64×64 HUD resources.
- `manifest.json`: paths, labels, dimensions and anchors.

Palette: jade grass and dragon scales, slate-blue/ivory armour, amber metals, dusty violet cloth. Transparent sprites intentionally use neutral colours. Team identity belongs to a coloured base ring/outline in the renderer, keeping the exact same art usable on both sides. Load sprites once and cache rasterisation when drawing many units on Canvas. SVG shadows are baked into the image rasterisation, not updated by application animation.

All SVGs are self-contained XML, have fixed viewBox/dimensions and no scripts, external resources or data URLs. Shapes can be animated by translating/scaling/rotating their canvas image; no runtime SVG mutation is needed.
