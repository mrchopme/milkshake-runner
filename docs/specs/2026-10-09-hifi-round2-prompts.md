---
provenance: agent-generated
last-verified: never
---

# Milkshake Runner: HiFi round 2 prompt book

> Point-in-time snapshot. Written on 2026-10-13 against `hi-fi-city` (8a7b33a) from the round 2 plan's Task 3 brief, the
> shipped `src/palette.js` and `content/themes/*.js`. Nothing here has been run: no image has been generated from these
> prompts, so wording that reads well may still drift once GPT Image 2.5, Nano Banana Pro or Tripo meets it. Prices and
> model ids are the 2026-10-08 ones in the plan's Global Constraints. Read it as the plan's starting prompts, not as a
> proven recipe; patterns may have moved on since.

The main session pastes every fenced block below verbatim into Higgsfield (`generate_image_batch`, `generate_3d`), without
a `folder_id`. Nothing in this file has spent a credit. Every prompt obeys the round's content rule: no logos, no brand
names, no readable trademarks, no real landmarks, real teams or real people; sign words only from TAXI, PIZZA, DELI, HOTEL,
CAFE (and the `x2` token's "2×"). Skylines say generic towers and stepped spires.

## Jobs the waves will run

Model ids: `gpt_image_2_5`, `tripo_h3_1_multiview_to_3d` and `tripo_h3_1_image_to_3d` come from the sub-project 1 docs (the HiFi ledger). The ids for Nano Banana Pro and Nano Banana 2.1 are **unconfirmed** (the 2026-10-08 keyframes ran as `nano_banana_2`): the main session checks both with `models_explore` before the probe.

| Wave | Job | Count | Model | Settings | Price |
|---|---|---|---|---|---|
| 1 | Price probe: 2k medium square | 1 | `gpt_image_2_5` | 1:1, 2k, quality medium | read off `balance`, ceiling 2 |
| 1 | Price probe: 21:9 at 4k | 1 | `gpt_image_2_5` | 21:9, 4k | read off `balance`, ceiling 2 |
| 1 | Price probe: 8:1 at 4k | 1 | Nano Banana 2.1 | 8:1, 4k | read off `balance`, ceiling 2 |
| 1 | Style frames | 16 (4 per theme) | `gpt_image_2_5` | 16:9, 1k, quality low | 0.25 each = 4 |
| 1 | Hero style frames | 4 (1 per theme) | Nano Banana Pro | 16:9, 1k | 2 each = 8 |
| 1 | Concepts | 112 (28 models x 4) | `gpt_image_2_5` | 1:1, 1k, quality low | 0.25 each = 28 |
| 2 | Model views (multi-view models only) | 52 (13 x 4) | `gpt_image_2_5` | 1:1, 1k, quality low | 0.25 each = 13 |
| 2 | Facade tiles | 15 | `gpt_image_2_5` | 1:1, 2k, quality medium | priced by the probe |
| 2 | Storefront strips | 12 | `gpt_image_2_5` | 21:9, 2k, quality medium | priced by the probe |
| 2 | Party walls | 3 | `gpt_image_2_5` | 1:1, 2k, quality medium | priced by the probe |
| 2 | Trim sheets | 3 | `gpt_image_2_5` | 1:1, 2k, quality medium | priced by the probe |
| 2 | Posters | 12 | `gpt_image_2_5` | 16:9, 1k, quality low | 0.25 each = 3 |
| 2 | Blade signs | 6 | `gpt_image_2_5` | 2:3, 1k, quality low | 0.25 each = 1.5 |
| 2 | LED faces | 3 | `gpt_image_2_5` | 21:9, 1k, quality low | 0.25 each = 0.75 |
| 2 | Skylines | 8 (2 per theme) | `gpt_image_2_5` | 21:9, 2k, quality medium, `background: transparent` | priced by the probe |
| 3 | Models, multi-view | 13 | `tripo_h3_1_multiview_to_3d` | detailed, PBR, `face_limit` per asset | 18 each = 234 |
| 3 | Models, single image | 15 | `tripo_h3_1_image_to_3d` | detailed, PBR, `face_limit` per asset | 18 each = 270 |

Wave 1 comes to 6 (the three probe images at their ceiling) + 4 + 8 + 28 = 46 credits, as the plan quotes. Wave 2 is 114 images: 52 views plus 62 city images; the plan estimated 65 credits for the wave, and the probe settles the 2k and 21:9 prices. Wave 3 is 28 x 18 = 504. Wave 2's 2k quality is "medium" because the probe prices exactly that; fall back to "low" if the probe price is out of range and the window grids still read.

## Palette tokens

Source: `src/palette.js` (road #5a5c72, sidewalk #a3a0ab, lane #f2f2f2, dark #262733, taxi #f7c518, hazard #ff7a1a, metal #8a8f99, glass #8ccfe0, pigeon #d9dbe6, rider #e5484d, magnet #ff4fa3, shield #4dc3ff, x2 #8b5cf6, plaza #d9d4cc, jerseyB #2a5caa, lavender #b9a6e8, eye #1d1b26, spot #c8c8d0, cowWhite and jug #ffffff) and the themes in `content/themes/*.js`, with each theme's sky. The prompts name each colour as well as giving its hex.

Four tokens are **additions that are not in the shipped palette**, because the subject list asks for dark green furniture, a teal car, green trees and a green signal lens: street green #2f5a45, leaf green #5fae4e, signal green #3fbf6a and teal #2bb3a7. Caedon should look at them on board 16.

## The templates (from the brief; the facade wording changed, see below)

Concept (GPT Image 2.5, 1:1, quality low, `image_references`: the two teaser keyframe jobs `ed480a6e-19ce-48ff-8cf1-df1f86e16abd` (16:9) and `854c98cf-81b2-40f4-8022-ac87b5a89a06` (9:16) and the Milkshake-3D render job `97ba0692-9968-468c-8357-61e4bcd049ab`):

```text
A {subject}, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette {palette}, a slight clearcoat sheen. {details}. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text except {words}, no people.
```

View (GPT Image 2.5, 1:1, `image_references`: the picked concept job only; `{view}` in front, left side, rear, right side):

```text
The same {subject} as the reference image, with exactly the same design, colours, proportions and details, seen straight from the {view}, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

Facade tile (GPT Image 2.5, 2k, 1:1, `image_references`: the theme's picked style frame; the brief's "a {style} facade" became "{style}", with the article and the word "facade" inside the filled style, so every filled sentence reads cleanly):

```text
A flat orthographic front elevation of {style} in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette {palette}. No logos, no text, no people.
```

The other image sets (storefront strip, party wall, trim sheet, poster, blade sign, LED face, skyline, style frame) are described in the brief rather than given as fill-in templates; their filled prompts are in the image sets below.

### How the templates were filled (small departures, logged in the report)

- **No words.** Where the table says "none", "no readable text except none" would read as a contradiction, so the clause is "no readable text at all". For the `x2` token it stays "no readable text except 2×".
- **The toy rider.** The delivery bike's subject includes a toy rider, which "no people" would forbid, so that concept ends "no people other than the toy rider" and its four view prompts do the same.
- **Facade grammar.** The brief's "of a {style} facade" made "a art-deco facade" and "mullions facade", so the template says "of {style}" and each filled style carries its own article and the word "facade" ("an art-deco stone facade with tall vertical piers").
- **Milkshake's views** say "The same cow mascot as the reference image" (the concept's longer subject read badly in the view template, and only the picked concept is passed as the reference).
- **"NYC"** is left out of the cobra-head lamp's subject (a model could print the letters on the pole); the shape is unchanged.

Every concept is 1:1, resolution 1k, quality low, with the `image_references` named above, and is run four times in one call (GPT Image 2.5 returns a different variant each time). View prompts use the picked concept job as the only reference, with the same settings.

## Models

Tripo parameters for every model: `geometry_quality` "detailed", `texture_quality` "detailed", `pbr: true`, `face_limit` as given. Multi-view models send four images in the order front, left side, rear, right side, after the main session has checked each view (GPT Image can turn a requested front into a rear view). Single-image models send the picked concept.


### Furniture (12)

#### 1. `furniture/lamp.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 6000. Single image.
- **Palette:** street green #2f5a45 (addition), steel grey #8a8f99, taxi yellow #f7c518, night grey #262733.
- **Note:** Thin poles are Tripo's known risk: one of the three pilot models.

Concept (4 variants):

```text
A cobra-head street lamp post, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette street green #2f5a45, steel grey #8a8f99, taxi yellow #f7c518, night grey #262733, a slight clearcoat sheen. A thick-for-its-height dark green pole on a small round base, curving at the top into a long cobra-neck arm that carries a rounded lamp head, the lens under the head glowing warm yellow. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 2. `furniture/lamp_double.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 6000. Single image.
- **Palette:** street green #2f5a45 (addition), steel grey #8a8f99, taxi yellow #f7c518, night grey #262733.

Concept (4 variants):

```text
A twin-arm street lamp post, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette street green #2f5a45, steel grey #8a8f99, taxi yellow #f7c518, night grey #262733, a slight clearcoat sheen. A thick-for-its-height dark green pole on a small round base with two curved arms reaching out to opposite sides, each carrying a rounded lamp head with a glowing warm yellow lens, the arms level and symmetrical. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 3. `furniture/traffic_light.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 8000. Multi-view.
- **Palette:** taxi yellow #f7c518, signal red #e5484d, hazard orange #ff7a1a, signal green #3fbf6a (addition), night grey #262733, steel grey #8a8f99.
- **Note:** Signal lenses glow through emissive texels picked from their own colours.

Concept (4 variants):

```text
A traffic light on a pole, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette taxi yellow #f7c518, signal red #e5484d, hazard orange #ff7a1a, signal green #3fbf6a, night grey #262733, steel grey #8a8f99, a slight clearcoat sheen. A dark grey pole with a short arm reaching out at the top, carrying one yellow signal housing with three round glowing lenses stacked red, amber and green, each lens in a small hood. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same traffic light on a pole as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same traffic light on a pole as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same traffic light on a pole as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same traffic light on a pole as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

#### 4. `furniture/hydrant.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 4000. Single image.
- **Palette:** signal red #e5484d, steel grey #8a8f99, lane white #f2f2f2.
- **Note:** Thin parts at risk: one of the three pilot models.

Concept (4 variants):

```text
A fire hydrant, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette signal red #e5484d, steel grey #8a8f99, lane white #f2f2f2, a slight clearcoat sheen. A chunky red body with a rounded dome top, two side outlets and one front outlet with silver caps, a silver bolt on top and a short square base. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 5. `furniture/bench.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 6000. Single image.
- **Palette:** street green #2f5a45 (addition), brick brown #a3714f, steel grey #8a8f99.

Concept (4 variants):

```text
A slatted park bench, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette street green #2f5a45, brick brown #a3714f, steel grey #8a8f99, a slight clearcoat sheen. A green cast-iron frame with curled armrests and legs, a wooden seat and a wooden back made of separate slats. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 6. `furniture/bin.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 4000. Single image.
- **Palette:** street green #2f5a45 (addition), night grey #262733, steel grey #8a8f99.

Concept (4 variants):

```text
A round wire-mesh litter basket, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette street green #2f5a45, night grey #262733, steel grey #8a8f99, a slight clearcoat sheen. A green wire-mesh drum on a short post with a dark rim and a dark base, open at the top. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 7. `furniture/bin_box.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 4000. Single image.
- **Palette:** street green #2f5a45 (addition), night grey #262733, steel grey #8a8f99.

Concept (4 variants):

```text
A square public litter bin, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette street green #2f5a45, night grey #262733, steel grey #8a8f99, a slight clearcoat sheen. A dark green square box on short feet with a hinged lid that has a round opening. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 8. `furniture/planter.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 6000. Single image.
- **Palette:** plaza stone #d9d4cc, leaf green #5fae4e (addition), sidewalk grey #a3a0ab, magnet pink #ff4fa3.

Concept (4 variants):

```text
A concrete planter box, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette plaza stone #d9d4cc, leaf green #5fae4e, sidewalk grey #a3a0ab, magnet pink #ff4fa3, a slight clearcoat sheen. A low rectangular pale concrete box with rounded corners holding one round, bushy green shrub with a few tiny pink flowers. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 9. `furniture/tree.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 8000. Single image.
- **Palette:** leaf green #5fae4e (addition), brick brown #a3714f, night grey #262733, steel grey #8a8f99.
- **Note:** The leafy crown is the risk: one of the three pilot models.

Concept (4 variants):

```text
A street tree in a square iron tree guard, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette leaf green #5fae4e, brick brown #a3714f, night grey #262733, steel grey #8a8f99, a slight clearcoat sheen. A short thick brown trunk, a round crown of puffy clustered leaves, and a square dark iron tree guard around the base with soil inside. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 10. `furniture/newsstand.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 8000. Multi-view.
- **Palette:** deep blue #2a5caa, lane white #f2f2f2, hazard orange #ff7a1a, glass blue #8ccfe0, night grey #262733.

Concept (4 variants):

```text
A sidewalk newsstand kiosk, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette deep blue #2a5caa, lane white #f2f2f2, hazard orange #ff7a1a, glass blue #8ccfe0, night grey #262733, a slight clearcoat sheen. A small boxy kiosk with a striped awning over an open serving window and racks of colourful magazines on the sides; the magazine covers are plain colour blocks with no titles and no text. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same sidewalk newsstand kiosk as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same sidewalk newsstand kiosk as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same sidewalk newsstand kiosk as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same sidewalk newsstand kiosk as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

#### 11. `furniture/bus_shelter.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 8000. Multi-view.
- **Palette:** glass blue #8ccfe0, steel grey #8a8f99, night grey #262733, lane white #f2f2f2.

Concept (4 variants):

```text
A glass bus shelter, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette glass blue #8ccfe0, steel grey #8a8f99, night grey #262733, lane white #f2f2f2, a slight clearcoat sheen. A slim flat roof on thin steel posts, glass panels on the back and both sides, a small bench inside; the glass panels are clear with no advertising and no text. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same glass bus shelter as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same glass bus shelter as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same glass bus shelter as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same glass bus shelter as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

#### 12. `furniture/subway.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 8000. Multi-view.
- **Palette:** street green #2f5a45 (addition), lane white #f2f2f2, sidewalk grey #a3a0ab, steel grey #8a8f99.
- **Note:** The rear view must show the same railings and posts, not the stairs from above.

Concept (4 variants):

```text
A subway stair entrance, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette street green #2f5a45, lane white #f2f2f2, sidewalk grey #a3a0ab, steel grey #8a8f99, a slight clearcoat sheen. A stairway going down from the pavement between two green railings, two tall posts each topped by a plain white globe lamp; no signs and no text. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same subway stair entrance as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same subway stair entrance as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same subway stair entrance as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same subway stair entrance as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```


### Hero assets (13)

#### 13. `barrier_low.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 12000. Multi-view.
- **Palette:** hazard orange #ff7a1a, lane white #f2f2f2, sidewalk grey #a3a0ab.
- **Note:** Tripo may lay the long axis along x.

Concept (4 variants):

```text
A jersey barrier, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette hazard orange #ff7a1a, lane white #f2f2f2, sidewalk grey #a3a0ab, a slight clearcoat sheen. An orange-and-white road barrier with a stepped profile (wide base, a step, a narrow flat top) and two white stripes running along its length. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same jersey barrier as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same jersey barrier as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same jersey barrier as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same jersey barrier as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

#### 14. `delivery_bike.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 15000. Multi-view.
- **Palette:** signal red #e5484d, taxi yellow #f7c518, night grey #262733, steel grey #8a8f99, lane white #f2f2f2.
- **Note:** The only concept with a figure (a toy rider): its concept and view prompts end "no people other than the toy rider". Check every view still shows the same rider.

Concept (4 variants):

```text
A delivery bicycle with a front cargo box, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette signal red #e5484d, taxi yellow #f7c518, night grey #262733, steel grey #8a8f99, lane white #f2f2f2, a slight clearcoat sheen. A sturdy bicycle with a big square cargo box sitting over a small front wheel, and a small vinyl toy rider in a cap pedalling. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people other than the toy rider.
```

View, front:

```text
The same delivery bicycle with a front cargo box as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people other than the toy rider.
```

View, left side:

```text
The same delivery bicycle with a front cargo box as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people other than the toy rider.
```

View, rear:

```text
The same delivery bicycle with a front cargo box as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people other than the toy rider.
```

View, right side:

```text
The same delivery bicycle with a front cargo box as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people other than the toy rider.
```

#### 15. `hot_dog_cart.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 15000. Multi-view.
- **Palette:** steel grey #8a8f99, signal red #e5484d, taxi yellow #f7c518, lane white #f2f2f2, night grey #262733.

Concept (4 variants):

```text
A hot-dog cart, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette steel grey #8a8f99, signal red #e5484d, taxi yellow #f7c518, lane white #f2f2f2, night grey #262733, a slight clearcoat sheen. A steel cart body on two wheels with a push handle, a hinged steaming-tray lid, and a striped umbrella on a pole above; no labels and no text anywhere. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same hot-dog cart as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same hot-dog cart as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same hot-dog cart as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same hot-dog cart as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

#### 16. `manhole_steam.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 4000. Single image.
- **Palette:** night grey #262733, steel grey #8a8f99, road violet-grey #5a5c72.
- **Note:** Steam is added in code.

Concept (4 variants):

```text
A round cast-iron manhole cover, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette night grey #262733, steel grey #8a8f99, road violet-grey #5a5c72, a slight clearcoat sheen. A flat dark disc with a raised grid pattern and a slightly raised rim, set into a short square patch of road; no lettering on the cover. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 17. `pigeon.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 4000. Single image.
- **Palette:** pigeon grey #d9dbe6, light grey #c8c8d0, lavender #b9a6e8, glass blue #8ccfe0, signal red #e5484d, ink black #1d1b26.
- **Note:** Instanced into a flock; the wing flap is added in the shader.

Concept (4 variants):

```text
A plump city pigeon, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette pigeon grey #d9dbe6, light grey #c8c8d0, lavender #b9a6e8, glass blue #8ccfe0, signal red #e5484d, ink black #1d1b26, a slight clearcoat sheen. One chunky grey bird standing, wings folded, a glossy iridescent neck in lavender and glass blue, a small round ink-black eye and short coral feet. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 18. `scaffold_beam.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 15000. Multi-view.
- **Palette:** steel grey #8a8f99, taxi yellow #f7c518, night grey #262733, hazard orange #ff7a1a.
- **Note:** The opening underneath must stay clear in every view.

Concept (4 variants):

```text
A sidewalk scaffold frame, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette steel grey #8a8f99, taxi yellow #f7c518, night grey #262733, hazard orange #ff7a1a, a slight clearcoat sheen. Grey steel uprights at the corners, crossed braces on the sides, a caution plank across the top at head height striped yellow and black, and open space underneath. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same sidewalk scaffold frame as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same sidewalk scaffold frame as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same sidewalk scaffold frame as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same sidewalk scaffold frame as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

#### 19. `jug.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 6000. Single image.
- **Palette:** white #ffffff, lavender #b9a6e8, glass blue #8ccfe0.
- **Note:** Glow comes from the bottle's own texels.

Concept (4 variants):

```text
A glowing milk bottle, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette white #ffffff, lavender #b9a6e8, glass blue #8ccfe0, a slight clearcoat sheen. A bottle with a rounded shoulder, a short neck and a lavender cap, made of milky white glass with a soft inner glow. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 20. `magnet.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 4000. Single image.
- **Palette:** magnet pink #ff4fa3, steel grey #8a8f99, lane white #f2f2f2.

Concept (4 variants):

```text
A horseshoe magnet, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette magnet pink #ff4fa3, steel grey #8a8f99, lane white #f2f2f2, a slight clearcoat sheen. A bright pink U-shaped magnet with silver tips on both ends, the open end facing up. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 21. `shield.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 4000. Single image.
- **Palette:** shield sky blue #4dc3ff, lane white #f2f2f2, deep blue #2a5caa.
- **Note:** The bubble Milkshake wears is a code shader, not this model.

Concept (4 variants):

```text
A rounded heater shield badge, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette shield sky blue #4dc3ff, lane white #f2f2f2, deep blue #2a5caa, a slight clearcoat sheen. A heater-shaped shield, slightly domed, with a sky blue face and a white rim, plain and without any emblem. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 22. `x2.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 4000. Single image.
- **Palette:** coin purple #8b5cf6, lavender #b9a6e8, white #ffffff.
- **Note:** The one prompt where text is allowed: "2×" only.

Concept (4 variants):

```text
A chunky coin token, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette coin purple #8b5cf6, lavender #b9a6e8, white #ffffff, a slight clearcoat sheen. A thick purple coin with a raised rim and a raised "2×" mark in the middle in lighter lavender, the mark clear and bold. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text except 2×, no people.
```

Views: single image: the picked concept is the input.

#### 23. `overpass.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 20000. Multi-view.
- **Palette:** steel grey #8a8f99, road violet-grey #5a5c72, sidewalk grey #a3a0ab, night grey #262733.
- **Note:** Tripo may lay the long axis along x.

Concept (4 variants):

```text
A short steel road overpass span, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette steel grey #8a8f99, road violet-grey #5a5c72, sidewalk grey #a3a0ab, night grey #262733, a slight clearcoat sheen. A flat grey deck with steel side girders and low parapets, carried on four round pillars, the underside of the deck visible between the pillars. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same short steel road overpass span as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same short steel road overpass span as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same short steel road overpass span as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same short steel road overpass span as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

#### 24. `railings.glb`

- **Tripo:** model `tripo_h3_1_image_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 4000. Single image.
- **Palette:** steel grey #8a8f99, night grey #262733, glass blue #8ccfe0.
- **Note:** Instanced along the run.

Concept (4 variants):

```text
A one 4 m section of bridge railing, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette steel grey #8a8f99, night grey #262733, glass blue #8ccfe0, a slight clearcoat sheen. A straight section with evenly spaced steel posts and two horizontal rails, simple and chunky. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

Views: single image: the picked concept is the input.

#### 25. `tunnel.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 20000. Multi-view.
- **Palette:** plaza stone #d9d4cc, taxi yellow #f7c518, night grey #262733, road violet-grey #5a5c72, deep blue #2a5caa.
- **Note:** The rear view shows the far portal with the same design.

Concept (4 variants):

```text
A rounded tiled tunnel portal with a 60 m tube behind it, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette plaza stone #d9d4cc, taxi yellow #f7c518, night grey #262733, road violet-grey #5a5c72, deep blue #2a5caa, a slight clearcoat sheen. A rounded arch faced with cream tiles around a dark road mouth, and a long tube receding behind it with tiled walls and a row of warm lamps along the ceiling. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same rounded tiled tunnel portal with a 60 m tube behind it as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same rounded tiled tunnel portal with a 60 m tube behind it as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same rounded tiled tunnel portal with a 60 m tube behind it as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same rounded tiled tunnel portal with a 60 m tube behind it as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```


### Vehicles (2)

#### 26. `vehicles/sedan.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 15000. Multi-view.
- **Palette:** teal #2bb3a7 (addition), glass blue #8ccfe0, night grey #262733, lane white #f2f2f2, taxi yellow #f7c518.
- **Note:** Tripo may lay the long axis along x (the taxi needed YAW = -pi/2).

Concept (4 variants):

```text
A compact toy sedan, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette teal #2bb3a7, glass blue #8ccfe0, night grey #262733, lane white #f2f2f2, taxi yellow #f7c518, a slight clearcoat sheen. A teal body with glass blue windows, round headlights, a rounded roof and chunky wheels; no licence plate and no badges. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same compact toy sedan as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same compact toy sedan as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same compact toy sedan as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same compact toy sedan as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

#### 27. `vehicles/van.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 15000. Multi-view.
- **Palette:** lane white #f2f2f2, deep blue #2a5caa, glass blue #8ccfe0, night grey #262733, taxi yellow #f7c518.
- **Note:** Tripo may lay the long axis along x.

Concept (4 variants):

```text
A boxy delivery van, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette lane white #f2f2f2, deep blue #2a5caa, glass blue #8ccfe0, night grey #262733, taxi yellow #f7c518, a slight clearcoat sheen. A white body with one deep blue stripe along each side, glass blue windows, a tall flat roof and chunky wheels; no lettering, no licence plate and no badges. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same boxy delivery van as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same boxy delivery van as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same boxy delivery van as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same boxy delivery van as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```


### Milkshake (1)

#### 28. `milkshake.glb`

- **Tripo:** model `tripo_h3_1_multiview_to_3d`, geometry quality "detailed", texture quality "detailed", `pbr: true`, `face_limit` 20000. Multi-view.
- **Palette:** white #ffffff, ink black #1d1b26, lavender #b9a6e8, light grey #c8c8d0.
- **Note:** Black spots use the ink token #1d1b26 (the shipped low-fi spot is light grey #c8c8d0, kept as a soft shading tone). Keep the T-pose identical in all four views: arms straight out, legs apart. After the model: re-measure the SKIN knobs.

Concept (4 variants):

```text
A Milkshake, the cow mascot of the reference images, as a glossy vinyl toy in the style of the reference images: chunky rounded proportions, soft bevels, bright clean colours from this palette white #ffffff, ink black #1d1b26, lavender #b9a6e8, light grey #c8c8d0, a slight clearcoat sheen. A friendly cartoon cow, white with black spots, a lavender muzzle, lavender hooves, lavender inner ears and two small lavender horn nubs, big round ink-black eyes, a short tail, standing upright in a neutral T-pose with the arms straight out to the sides and the legs apart, feet flat on the ground. Three-quarter view from the front left, the whole object in frame, centred, on a plain light grey background, even studio light. No logos, no brand names, no readable text at all, no people.
```

View, front:

```text
The same cow mascot as the reference image, with exactly the same design, colours, proportions and details, seen straight from the front, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, left side:

```text
The same cow mascot as the reference image, with exactly the same design, colours, proportions and details, seen straight from the left side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, rear:

```text
The same cow mascot as the reference image, with exactly the same design, colours, proportions and details, seen straight from the rear, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```

View, right side:

```text
The same cow mascot as the reference image, with exactly the same design, colours, proportions and details, seen straight from the right side, centred, the whole object in frame, on a plain light grey background, even studio light. No logos, no brand names, no other text, no people.
```


## Image sets

All image sets go to `generate_image_batch` without a `folder_id`. "Picked style frame" means the style frame Caedon picks for that theme on board 16; the main session passes its job id as the only `image_references` entry unless stated otherwise.

### Style frames

Per theme: four GPT Image 2.5 frames (16:9, 1k, quality low; `image_references`: the 16:9 teaser keyframe job `ed480a6e-19ce-48ff-8cf1-df1f86e16abd`, for the camera and the look) and one Nano Banana Pro hero frame (16:9, 1k; `image_references`: both teaser keyframe jobs `ed480a6e-19ce-48ff-8cf1-df1f86e16abd` and `854c98cf-81b2-40f4-8022-ac87b5a89a06`). Run each GPT prompt four times in one call.

#### downtown: GPT Image 2.5 style frame (x4)

```text
A wide cinematic view of a wide four-lane city avenue with wide sidewalks, a few street trees and lamp posts, from the camera of the reference image: a low camera behind and above the middle of the road, looking straight down the street to a vanishing point. Tall buildings line both sides, tall blue-grey glass and stone towers with some brick and limestone blocks between them, with shop fronts at street level and a distant skyline of generic towers and stepped spires at the end of the avenue. Light: a clear blue day, bright white-blue sun high in the upper right, crisp cool shadows, a clear blue sky. Glossy vinyl-toy look in the style of the reference: chunky rounded shapes, bright clean colours, a slight clearcoat sheen. Palette clear sky blue #9fd3f5, stone grey #8a8f9c, brick brown #a3714f, slate #5d6273, limestone #c2b8a3, road violet-grey #5a5c72, sidewalk grey #a3a0ab, lane white #f2f2f2. Shop signs may read only TAXI, PIZZA, DELI, HOTEL or CAFE, or have no words. No logos, no brand names, no real landmarks, no other readable text, no people.
```

#### downtown: Nano Banana Pro hero frame (x1)

```text
A wide cinematic view of a wide four-lane city avenue with wide sidewalks, a few street trees and lamp posts, from the camera of the reference image: a low camera behind and above the middle of the road, looking straight down the street to a vanishing point. Tall buildings line both sides, tall blue-grey glass and stone towers with some brick and limestone blocks between them, with shop fronts at street level and a distant skyline of generic towers and stepped spires at the end of the avenue. Light: a clear blue day, bright white-blue sun high in the upper right, crisp cool shadows, a clear blue sky. Glossy vinyl-toy look in the style of the reference: chunky rounded shapes, bright clean colours, a slight clearcoat sheen, richer detail and soft bloom on lit windows and signs, final key-art polish. Palette clear sky blue #9fd3f5, stone grey #8a8f9c, brick brown #a3714f, slate #5d6273, limestone #c2b8a3, road violet-grey #5a5c72, sidewalk grey #a3a0ab, lane white #f2f2f2. Shop signs may read only TAXI, PIZZA, DELI, HOTEL or CAFE, or have no words. No logos, no brand names, no real landmarks, no other readable text, no people.
```

#### midtown: GPT Image 2.5 style frame (x4)

```text
A wide cinematic view of a wide four-lane city avenue with wide sidewalks, a few street trees and lamp posts, from the camera of the reference image: a low camera behind and above the middle of the road, looking straight down the street to a vanishing point. Tall buildings line both sides, very tall glass slabs and stone setback towers, with shop fronts at street level and a distant skyline of generic towers and stepped spires at the end of the avenue. Light: a low orange sun late in the day, long warm light along the avenue, glowing orange haze, warm rim light on the towers. Glossy vinyl-toy look in the style of the reference: chunky rounded shapes, bright clean colours, a slight clearcoat sheen. Palette low-sun orange #f4b26a, blue-grey #9aa7b8, steel slate #6f7d8f, pale limestone #cfc6b4, tan brick #b0855f, road violet-grey #5a5c72, sidewalk grey #a3a0ab, lane white #f2f2f2. Shop signs may read only TAXI, PIZZA, DELI, HOTEL or CAFE, or have no words. No logos, no brand names, no real landmarks, no other readable text, no people.
```

#### midtown: Nano Banana Pro hero frame (x1)

```text
A wide cinematic view of a wide four-lane city avenue with wide sidewalks, a few street trees and lamp posts, from the camera of the reference image: a low camera behind and above the middle of the road, looking straight down the street to a vanishing point. Tall buildings line both sides, very tall glass slabs and stone setback towers, with shop fronts at street level and a distant skyline of generic towers and stepped spires at the end of the avenue. Light: a low orange sun late in the day, long warm light along the avenue, glowing orange haze, warm rim light on the towers. Glossy vinyl-toy look in the style of the reference: chunky rounded shapes, bright clean colours, a slight clearcoat sheen, richer detail and soft bloom on lit windows and signs, final key-art polish. Palette low-sun orange #f4b26a, blue-grey #9aa7b8, steel slate #6f7d8f, pale limestone #cfc6b4, tan brick #b0855f, road violet-grey #5a5c72, sidewalk grey #a3a0ab, lane white #f2f2f2. Shop signs may read only TAXI, PIZZA, DELI, HOTEL or CAFE, or have no words. No logos, no brand names, no real landmarks, no other readable text, no people.
```

#### uptown: GPT Image 2.5 style frame (x4)

```text
A wide cinematic view of a wide four-lane city avenue with wide sidewalks, a few street trees and lamp posts, from the camera of the reference image: a low camera behind and above the middle of the road, looking straight down the street to a vanishing point. Tall buildings line both sides, low and mid-rise brownstone, brick and stone buildings with lit windows, with shop fronts at street level and a distant skyline of generic towers and stepped spires at the end of the avenue. Light: purple dusk, a violet sky, warm light glowing in many lit windows, soft cool shadows on the street. Glossy vinyl-toy look in the style of the reference: chunky rounded shapes, bright clean colours, a slight clearcoat sheen. Palette dusk purple #c98bd8, brownstone #b07a5a, sandstone #c9a27e, dark brownstone #8c5d47, cream stone #d8c3a5, road violet-grey #5a5c72, sidewalk grey #a3a0ab, lane white #f2f2f2. Shop signs may read only TAXI, PIZZA, DELI, HOTEL or CAFE, or have no words. No logos, no brand names, no real landmarks, no other readable text, no people.
```

#### uptown: Nano Banana Pro hero frame (x1)

```text
A wide cinematic view of a wide four-lane city avenue with wide sidewalks, a few street trees and lamp posts, from the camera of the reference image: a low camera behind and above the middle of the road, looking straight down the street to a vanishing point. Tall buildings line both sides, low and mid-rise brownstone, brick and stone buildings with lit windows, with shop fronts at street level and a distant skyline of generic towers and stepped spires at the end of the avenue. Light: purple dusk, a violet sky, warm light glowing in many lit windows, soft cool shadows on the street. Glossy vinyl-toy look in the style of the reference: chunky rounded shapes, bright clean colours, a slight clearcoat sheen, richer detail and soft bloom on lit windows and signs, final key-art polish. Palette dusk purple #c98bd8, brownstone #b07a5a, sandstone #c9a27e, dark brownstone #8c5d47, cream stone #d8c3a5, road violet-grey #5a5c72, sidewalk grey #a3a0ab, lane white #f2f2f2. Shop signs may read only TAXI, PIZZA, DELI, HOTEL or CAFE, or have no words. No logos, no brand names, no real landmarks, no other readable text, no people.
```

#### bridge: GPT Image 2.5 style frame (x4)

```text
A wide cinematic view of a three-lane road deck on a bridge, with steel railings along both edges, from the camera of the reference image: a low camera behind and above the middle of the road, looking straight down the street to a vanishing point. Bridge towers and cables rise on both sides, with open water below and a low hazy waterfront city of generic towers across the water. Light: a clear blue day over open water, bright sun, sparkling water either side of the road. Glossy vinyl-toy look in the style of the reference: chunky rounded shapes, bright clean colours, a slight clearcoat sheen. Palette clear sky blue #9fd3f5, harbour blue-grey #a6c1d8, deep harbour blue #81a2bd, hazy blue #8eadc6, road violet-grey #5a5c72, sidewalk grey #a3a0ab, lane white #f2f2f2. No logos, no brand names, no real landmarks, no other readable text, no people.
```

#### bridge: Nano Banana Pro hero frame (x1)

```text
A wide cinematic view of a three-lane road deck on a bridge, with steel railings along both edges, from the camera of the reference image: a low camera behind and above the middle of the road, looking straight down the street to a vanishing point. Bridge towers and cables rise on both sides, with open water below and a low hazy waterfront city of generic towers across the water. Light: a clear blue day over open water, bright sun, sparkling water either side of the road. Glossy vinyl-toy look in the style of the reference: chunky rounded shapes, bright clean colours, a slight clearcoat sheen, richer detail and soft bloom on lit windows and signs, final key-art polish. Palette clear sky blue #9fd3f5, harbour blue-grey #a6c1d8, deep harbour blue #81a2bd, hazy blue #8eadc6, road violet-grey #5a5c72, sidewalk grey #a3a0ab, lane white #f2f2f2. No logos, no brand names, no real landmarks, no other readable text, no people.
```

### Facade tiles (15)

GPT Image 2.5, 1:1, resolution 2k, quality medium, `image_references`: the picked style frame for the facade's theme (downtown, midtown or uptown). The template is the one above, filled.

#### downtown-01: a blue glass curtain-wall facade with thin white mullions

```text
A flat orthographic front elevation of a blue glass curtain-wall facade with thin white mullions in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette glass blue #8ccfe0, clear sky blue #9fd3f5, lane white #f2f2f2, slate #5d6273. No logos, no text, no people.
```

#### downtown-02: a dark glass tower facade with slim steel mullions

```text
A flat orthographic front elevation of a dark glass tower facade with slim steel mullions in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette night grey #262733, slate #5d6273, steel grey #8a8f99, stone grey #8a8f9c. No logos, no text, no people.
```

#### downtown-03: a brick facade with punched windows

```text
A flat orthographic front elevation of a brick facade with punched windows in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette brick brown #a3714f, limestone #c2b8a3, slate #5d6273, night grey #262733. No logos, no text, no people.
```

#### downtown-04: a limestone facade with pilasters between the window bays

```text
A flat orthographic front elevation of a limestone facade with pilasters between the window bays in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette limestone #c2b8a3, stone grey #8a8f9c, slate #5d6273, plaza stone #d9d4cc. No logos, no text, no people.
```

#### downtown-05: a big-window loft facade with large steel-framed windows in brick

```text
A flat orthographic front elevation of a big-window loft facade with large steel-framed windows in brick in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette brick brown #a3714f, night grey #262733, glass blue #8ccfe0, steel grey #8a8f99. No logos, no text, no people.
```

#### midtown-01: an art-deco stone facade with tall vertical piers and recessed spandrels

```text
A flat orthographic front elevation of an art-deco stone facade with tall vertical piers and recessed spandrels in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette pale limestone #cfc6b4, blue-grey #9aa7b8, steel slate #6f7d8f, low-sun orange #f4b26a. No logos, no text, no people.
```

#### midtown-02: a glass slab facade with a regular grid of tinted windows

```text
A flat orthographic front elevation of a glass slab facade with a regular grid of tinted windows in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette blue-grey #9aa7b8, steel slate #6f7d8f, glass blue #8ccfe0, night grey #262733. No logos, no text, no people.
```

#### midtown-03: a limestone facade with deep ledge courses and recessed window bays

```text
A flat orthographic front elevation of a limestone facade with deep ledge courses and recessed window bays in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette pale limestone #cfc6b4, tan brick #b0855f, steel slate #6f7d8f, plaza stone #d9d4cc. No logos, no text, no people.
```

#### midtown-04: a prewar brick facade with stone window sills and lintels

```text
A flat orthographic front elevation of a prewar brick facade with stone window sills and lintels in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette tan brick #b0855f, pale limestone #cfc6b4, steel slate #6f7d8f, night grey #262733. No logos, no text, no people.
```

#### midtown-05: a mirrored glass facade with warm reflections

```text
A flat orthographic front elevation of a mirrored glass facade with warm reflections in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette blue-grey #9aa7b8, low-sun orange #f4b26a, steel slate #6f7d8f, night grey #262733. No logos, no text, no people.
```

#### uptown-01: a brownstone facade with tall arched windows

```text
A flat orthographic front elevation of a brownstone facade with tall arched windows in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette brownstone #b07a5a, dark brownstone #8c5d47, cream stone #d8c3a5, night grey #262733. No logos, no text, no people.
```

#### uptown-02: a brick walk-up facade with black iron fire escapes across the bays

```text
A flat orthographic front elevation of a brick walk-up facade with black iron fire escapes across the bays in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette dark brownstone #8c5d47, sandstone #c9a27e, night grey #262733, cream stone #d8c3a5. No logos, no text, no people.
```

#### uptown-03: a townhouse stone facade with carved window surrounds

```text
A flat orthographic front elevation of a townhouse stone facade with carved window surrounds in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette sandstone #c9a27e, cream stone #d8c3a5, dark brownstone #8c5d47, night grey #262733. No logos, no text, no people.
```

#### uptown-04: a pastel mid-rise facade with a regular window grid

```text
A flat orthographic front elevation of a pastel mid-rise facade with a regular window grid in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette cream stone #d8c3a5, lavender #b9a6e8, glass blue #8ccfe0, sandstone #c9a27e. No logos, no text, no people.
```

#### uptown-05: a warm-lit loft facade with large windows glowing warm yellow

```text
A flat orthographic front elevation of a warm-lit loft facade with large windows glowing warm yellow in the style of the reference: exactly two window bays wide and two floors tall, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight, so it repeats seamlessly left-right and up-down. Palette dark brownstone #8c5d47, low-sun orange #f4b26a, night grey #262733, cream stone #d8c3a5. No logos, no text, no people.
```

### Storefront strips (12)

GPT Image 2.5, 21:9, resolution 2k, quality medium, `image_references`: the picked style frame for the strip's theme. Sign words: DELI 2, CAFE 3, PIZZA 2, HOTEL 2, no words 3.

#### downtown-01: deli shop front with fruit crates stacked under a striped awning and a wide window

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor deli shop front with fruit crates stacked under a striped awning and a wide window: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. A sign above the door reads only "DELI". Awning and trim in this palette deep blue #2a5caa, lane white #f2f2f2, brick brown #a3714f, glass blue #8ccfe0. No logos, no brand names, no other text, no people.
```

#### downtown-02: cafe shop front with a big window and glass bistro doors under a hazard-orange awning

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor cafe shop front with a big window and glass bistro doors under a hazard-orange awning: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. A sign above the door reads only "CAFE". Awning and trim in this palette hazard orange #ff7a1a, slate #5d6273, glass blue #8ccfe0, lane white #f2f2f2. No logos, no brand names, no other text, no people.
```

#### downtown-03: hotel entrance with a glass door and a flat dark canopy

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor hotel entrance with a glass door and a flat dark canopy: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. A sign above the door reads only "HOTEL". Awning and trim in this palette limestone #c2b8a3, night grey #262733, taxi yellow #f7c518, glass blue #8ccfe0. No logos, no brand names, no other text, no people.
```

#### downtown-04: corner shop with one wide plain glass window and a shield-blue awning

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor corner shop with one wide plain glass window and a shield-blue awning: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. No sign words. Awning and trim in this palette shield sky blue #4dc3ff, stone grey #8a8f9c, glass blue #8ccfe0, night grey #262733. No logos, no brand names, no text, no people.
```

#### midtown-01: pizza slice shop with a wide window and a red-and-white striped awning

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor pizza slice shop with a wide window and a red-and-white striped awning: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. A sign above the door reads only "PIZZA". Awning and trim in this palette signal red #e5484d, lane white #f2f2f2, steel slate #6f7d8f, glass blue #8ccfe0. No logos, no brand names, no other text, no people.
```

#### midtown-02: hotel entrance with a revolving door under a long stone canopy

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor hotel entrance with a revolving door under a long stone canopy: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. A sign above the door reads only "HOTEL". Awning and trim in this palette pale limestone #cfc6b4, night grey #262733, taxi yellow #f7c518, glass blue #8ccfe0. No logos, no brand names, no other text, no people.
```

#### midtown-03: news and gift shop with a window full of colourful blank boxes and a deep blue awning

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor news and gift shop with a window full of colourful blank boxes and a deep blue awning: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. No sign words. Awning and trim in this palette deep blue #2a5caa, tan brick #b0855f, glass blue #8ccfe0, lane white #f2f2f2. No logos, no brand names, no text, no people.
```

#### midtown-04: cafe shop front with tall arched windows and a lavender awning

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor cafe shop front with tall arched windows and a lavender awning: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. A sign above the door reads only "CAFE". Awning and trim in this palette lavender #b9a6e8, steel slate #6f7d8f, low-sun orange #f4b26a, glass blue #8ccfe0. No logos, no brand names, no other text, no people.
```

#### uptown-01: deli shop front with a stack of produce boxes outside and a green-and-cream awning

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor deli shop front with a stack of produce boxes outside and a green-and-cream awning: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. A sign above the door reads only "DELI". Awning and trim in this palette signal green #3fbf6a, cream stone #d8c3a5, dark brownstone #8c5d47, glass blue #8ccfe0. No logos, no brand names, no other text, no people.
```

#### uptown-02: pizza shop with a warm lit window and a red awning

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor pizza shop with a warm lit window and a red awning: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. A sign above the door reads only "PIZZA". Awning and trim in this palette signal red #e5484d, sandstone #c9a27e, low-sun orange #f4b26a, glass blue #8ccfe0. No logos, no brand names, no other text, no people.
```

#### uptown-03: cafe with two small round tables outside and a cream awning

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor cafe with two small round tables outside and a cream awning: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. A sign above the door reads only "CAFE". Awning and trim in this palette cream stone #d8c3a5, brownstone #b07a5a, low-sun orange #f4b26a, glass blue #8ccfe0. No logos, no brand names, no other text, no people.
```

#### uptown-04: boutique with a large arched window and a lavender awning

```text
A flat orthographic front elevation, in the style of the reference, of a ground-floor boutique with a large arched window and a lavender awning: the shop front is 10 m wide and 4.3 m tall, filling the frame edge to edge, no sky, no pavement, no perspective, no shadows, even daylight. No sign words. Awning and trim in this palette lavender #b9a6e8, dark brownstone #8c5d47, sandstone #c9a27e, glass blue #8ccfe0. No logos, no brand names, no text, no people.
```

### Party walls (3)

GPT Image 2.5, 1:1, resolution 2k, quality medium, `image_references`: the picked style frame for the theme.

#### downtown-01: party wall

```text
A flat orthographic view, in the style of the reference, of the blank side wall of a tall building: weathered brick, no windows, with a few faded painted rectangles that carry no words, a vertical drain pipe, and a stepped parapet at the top edge, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight. Palette brick brown #a3714f, stone grey #8a8f9c, slate #5d6273, limestone #c2b8a3. No logos, no brand names, no text, no people.
```

#### midtown-01: party wall

```text
A flat orthographic view, in the style of the reference, of the blank side wall of a tall building: tan brick with pale stone bands, no windows, with a few faded painted rectangles that carry no words, a vertical drain pipe, and a stepped parapet at the top edge, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight. Palette tan brick #b0855f, steel slate #6f7d8f, pale limestone #cfc6b4, low-sun orange #f4b26a. No logos, no brand names, no text, no people.
```

#### uptown-01: party wall

```text
A flat orthographic view, in the style of the reference, of the blank side wall of a tall building: dark brownstone-coloured brick, no windows, with a few faded painted rectangles that carry no words, a vertical drain pipe, and a stepped parapet at the top edge, filling the frame edge to edge, no sky, no ground, no perspective, no shadows, even daylight. Palette dark brownstone #8c5d47, brownstone #b07a5a, cream stone #d8c3a5, sandstone #c9a27e. No logos, no brand names, no text, no people.
```

### Trim sheets (3)

GPT Image 2.5, 1:1, resolution 2k, quality medium, `image_references`: the picked style frame for the theme.

#### downtown-01: trim sheet

```text
One flat trim sheet in the style of the reference, laid out as four equal squares in a two by two grid on a plain light grey background, each drawn in flat orthographic front view with no perspective and no shadows: top left a cornice with stepped mouldings, top right a pilaster with a base and a capital, bottom left a window frame with a sill and a lintel, bottom right a striped shop awning. Palette limestone #c2b8a3, stone grey #8a8f9c, slate #5d6273, deep blue #2a5caa. No logos, no brand names, no text, no people.
```

#### midtown-01: trim sheet

```text
One flat trim sheet in the style of the reference, laid out as four equal squares in a two by two grid on a plain light grey background, each drawn in flat orthographic front view with no perspective and no shadows: top left a cornice with stepped mouldings, top right a pilaster with a base and a capital, bottom left a window frame with a sill and a lintel, bottom right a striped shop awning. Palette pale limestone #cfc6b4, tan brick #b0855f, steel slate #6f7d8f, signal red #e5484d. No logos, no brand names, no text, no people.
```

#### uptown-01: trim sheet

```text
One flat trim sheet in the style of the reference, laid out as four equal squares in a two by two grid on a plain light grey background, each drawn in flat orthographic front view with no perspective and no shadows: top left a cornice with stepped mouldings, top right a pilaster with a base and a capital, bottom left a window frame with a sill and a lintel, bottom right a striped shop awning. Palette cream stone #d8c3a5, brownstone #b07a5a, dark brownstone #8c5d47, lavender #b9a6e8. No logos, no brand names, no text, no people.
```

### Posters (12, shared by every theme)

GPT Image 2.5, 16:9, resolution 1k, quality low, `image_references`: the two teaser keyframe jobs `ed480a6e-19ce-48ff-8cf1-df1f86e16abd` and `854c98cf-81b2-40f4-8022-ac87b5a89a06`; they stand in as the flat-colour style reference.

#### poster-01

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: one large milk bottle, white with a lavender cap, on a shield-blue field with a deep blue band, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette lane white #f2f2f2, lavender #b9a6e8, shield sky blue #4dc3ff, deep blue #2a5caa. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### poster-02

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: one large five-point star, taxi yellow on a coin purple field, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette taxi yellow #f7c518, coin purple #8b5cf6, night grey #262733. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### poster-03

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: one large arrow pointing right, hazard orange on a night grey field, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette hazard orange #ff7a1a, night grey #262733, lane white #f2f2f2. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### poster-04

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: one large heart, magnet pink on a lavender field, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette magnet pink #ff4fa3, lavender #b9a6e8, lane white #f2f2f2. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### poster-05

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: a milk bottle beside a star, white and taxi yellow on a deep blue field, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette lane white #f2f2f2, taxi yellow #f7c518, deep blue #2a5caa. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### poster-06

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: three chevron arrows pointing right, white on a signal red field, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette lane white #f2f2f2, signal red #e5484d, night grey #262733. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### poster-07

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: a heart above a star, white on a coin purple field, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette lane white #f2f2f2, coin purple #8b5cf6, lavender #b9a6e8. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### poster-08

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: a milk bottle with three small drops, white on a glass blue field, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette lane white #f2f2f2, glass blue #8ccfe0, deep blue #2a5caa. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### poster-09

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: a starburst of rays around one star, taxi yellow on a hazard orange field, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette taxi yellow #f7c518, hazard orange #ff7a1a, night grey #262733. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### poster-10

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: one large arrow pointing up, glass blue on a night grey field, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette glass blue #8ccfe0, night grey #262733, lane white #f2f2f2. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### poster-11

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: a milk bottle with a magnet pink band, on a lane white field, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette magnet pink #ff4fa3, lane white #f2f2f2, night grey #262733. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### poster-12

```text
A bold flat billboard poster in the style of the reference, filling the frame edge to edge: a row of five small stars, lavender on a night grey field, simple flat colour blocks with crisp edges, no gradients, a thin dark border. Palette lavender #b9a6e8, night grey #262733, lane white #f2f2f2. No words, no letters, no numbers, no logos, no brand names, no people.
```

### Blade signs (6, shared by every theme)

GPT Image 2.5, 2:3, resolution 1k, quality low, `image_references`: the two teaser keyframe jobs `ed480a6e-19ce-48ff-8cf1-df1f86e16abd` and `854c98cf-81b2-40f4-8022-ac87b5a89a06`.

#### blade-01

```text
A flat front view, in the style of the reference, of a tall vertical shop blade sign face with rounded corners and a thin dark border, filling the frame edge to edge, showing a milk bottle as a simple pictogram in bold flat colour blocks, no gradients. Palette lane white #f2f2f2, lavender #b9a6e8, deep blue #2a5caa. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### blade-02

```text
A flat front view, in the style of the reference, of a tall vertical shop blade sign face with rounded corners and a thin dark border, filling the frame edge to edge, showing a five-point star as a simple pictogram in bold flat colour blocks, no gradients. Palette taxi yellow #f7c518, night grey #262733, coin purple #8b5cf6. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### blade-03

```text
A flat front view, in the style of the reference, of a tall vertical shop blade sign face with rounded corners and a thin dark border, filling the frame edge to edge, showing an arrow pointing up as a simple pictogram in bold flat colour blocks, no gradients. Palette hazard orange #ff7a1a, night grey #262733, lane white #f2f2f2. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### blade-04

```text
A flat front view, in the style of the reference, of a tall vertical shop blade sign face with rounded corners and a thin dark border, filling the frame edge to edge, showing a heart as a simple pictogram in bold flat colour blocks, no gradients. Palette magnet pink #ff4fa3, lane white #f2f2f2, lavender #b9a6e8. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### blade-05

```text
A flat front view, in the style of the reference, of a tall vertical shop blade sign face with rounded corners and a thin dark border, filling the frame edge to edge, showing a star above a heart as a simple pictogram in bold flat colour blocks, no gradients. Palette taxi yellow #f7c518, signal red #e5484d, deep blue #2a5caa. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### blade-06

```text
A flat front view, in the style of the reference, of a tall vertical shop blade sign face with rounded corners and a thin dark border, filling the frame edge to edge, showing a milk bottle above an arrow as a simple pictogram in bold flat colour blocks, no gradients. Palette lane white #f2f2f2, shield sky blue #4dc3ff, night grey #262733. No words, no letters, no numbers, no logos, no brand names, no people.
```

### LED faces (3, shared by every theme)

GPT Image 2.5, 21:9, resolution 1k, quality low, `image_references`: the two teaser keyframe jobs `ed480a6e-19ce-48ff-8cf1-df1f86e16abd` and `854c98cf-81b2-40f4-8022-ac87b5a89a06`.

#### led-01

```text
A flat front view, in the style of the reference, of a wide LED display panel face filling the frame edge to edge, made of a fine grid of square glowing pixels forming bold flat colour blocks: wide horizontal bands in a rising-sun pattern with one large star at the centre. Bright saturated colours on a dark background. Palette taxi yellow #f7c518, hazard orange #ff7a1a, signal red #e5484d, night grey #262733. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### led-02

```text
A flat front view, in the style of the reference, of a wide LED display panel face filling the frame edge to edge, made of a fine grid of square glowing pixels forming bold flat colour blocks: a repeating row of chunky chevron arrows pointing right across the whole panel. Bright saturated colours on a dark background. Palette shield sky blue #4dc3ff, lane white #f2f2f2, deep blue #2a5caa, night grey #262733. No words, no letters, no numbers, no logos, no brand names, no people.
```

#### led-03

```text
A flat front view, in the style of the reference, of a wide LED display panel face filling the frame edge to edge, made of a fine grid of square glowing pixels forming bold flat colour blocks: alternating hearts and milk bottles in a tiled row. Bright saturated colours on a dark background. Palette magnet pink #ff4fa3, lane white #f2f2f2, coin purple #8b5cf6, night grey #262733. No words, no letters, no numbers, no logos, no brand names, no people.
```

### Skylines (8)

GPT Image 2.5, 21:9, resolution 2k, quality medium, `background: transparent`, `image_references`: the picked style frame for the theme. The engine mirrors each strip into a seamless ring, so keep every tower clear of both side edges. The brief's clause naming two landmarks to avoid is shortened to "nothing that resembles any real landmark" (Task 3 fix round 1: naming a landmark in a negation can prime the model to draw it), and the palettes leave out the theme's sky colour because the sky is transparent. If any frame shows a spire that reads as a real building, regenerate it.

#### downtown-01: far haze

```text
A distant hazy skyline in the style of the reference, in a clear blue day with crisp cool shadows: a very pale, hazy blue-grey layer of distant generic towers and stepped spires, low contrast, fading into the haze. Ground line at the bottom tenth of the frame, transparent sky above, nothing that resembles any real landmark. Palette harbour blue-grey #a6c1d8, stone grey #8a8f9c, lane white #f2f2f2. No logos, no brand names, no text, no people.
```

#### downtown-02: nearer towers

```text
A distant hazy skyline in the style of the reference, in a clear blue day with crisp cool shadows: a nearer row of clearer generic towers and stepped spires with glass and stone faces, crisp cool shadows. Ground line at the bottom tenth of the frame, transparent sky above, nothing that resembles any real landmark. Palette stone grey #8a8f9c, slate #5d6273, glass blue #8ccfe0, limestone #c2b8a3. No logos, no brand names, no text, no people.
```

#### midtown-01: far haze

```text
A distant hazy skyline in the style of the reference, in low orange sunlight with a glowing orange haze: a soft layer of distant generic towers and stepped spires turned to warm orange-grey silhouettes by the haze. Ground line at the bottom tenth of the frame, transparent sky above, nothing that resembles any real landmark. Palette blue-grey #9aa7b8, steel slate #6f7d8f, tan brick #b0855f. No logos, no brand names, no text, no people.
```

#### midtown-02: nearer towers

```text
A distant hazy skyline in the style of the reference, in low orange sunlight with a glowing orange haze: a nearer row of generic towers and stepped spires, lit from the low orange sun with warm rim light and long shadows. Ground line at the bottom tenth of the frame, transparent sky above, nothing that resembles any real landmark. Palette blue-grey #9aa7b8, steel slate #6f7d8f, pale limestone #cfc6b4, taxi yellow #f7c518. No logos, no brand names, no text, no people.
```

#### uptown-01: far haze

```text
A distant hazy skyline in the style of the reference, in purple dusk with warm lit windows: a dim layer of distant generic towers and stepped spires in violet haze, a few tiny lit windows. Ground line at the bottom tenth of the frame, transparent sky above, nothing that resembles any real landmark. Palette lavender #b9a6e8, brownstone #b07a5a, dark brownstone #8c5d47. No logos, no brand names, no text, no people.
```

#### uptown-02: nearer towers

```text
A distant hazy skyline in the style of the reference, in purple dusk with warm lit windows: a nearer row of generic towers and stepped spires in dusk shade with many warm lit windows. Ground line at the bottom tenth of the frame, transparent sky above, nothing that resembles any real landmark. Palette brownstone #b07a5a, dark brownstone #8c5d47, cream stone #d8c3a5, taxi yellow #f7c518. No logos, no brand names, no text, no people.
```

#### bridge-01: far haze

```text
A distant hazy skyline in the style of the reference, in a clear blue day over open water: a very pale, hazy layer of distant generic towers across open water, low contrast, the waterline along the bottom. Ground line at the bottom tenth of the frame, transparent sky above, nothing that resembles any real landmark. Palette harbour blue-grey #a6c1d8, hazy blue #8eadc6, limestone #c2b8a3. No logos, no brand names, no text, no people.
```

#### bridge-02: nearer towers

```text
A distant hazy skyline in the style of the reference, in a clear blue day over open water: a clearer low waterfront city of generic towers and stepped spires standing on the far shore, the waterline along the bottom. Ground line at the bottom tenth of the frame, transparent sky above, nothing that resembles any real landmark. Palette harbour blue-grey #a6c1d8, deep harbour blue #81a2bd, hazy blue #8eadc6, limestone #c2b8a3. No logos, no brand names, no text, no people.
```

