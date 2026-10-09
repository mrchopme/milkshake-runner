#!/bin/sh
# Compresses a generated GLB for the game: meshopt geometry, WebP textures at most 2048 px.
# Usage: npm run assets:optimize -- in.glb public/hifi/name.glb
set -e
npx gltf-transform optimize "$1" "$2" --compress meshopt --texture-compress webp --texture-size 2048
