// Prints every bundled clip path + sentence as JSON for scripts/generate_audio.py.
import { audioManifest } from "../src/lib/early/audio-manifest";

process.stdout.write(JSON.stringify(audioManifest(), null, 2));
