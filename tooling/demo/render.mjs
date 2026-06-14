// Convert the recorded webm into docs/demo.gif and docs/demo.mp4.
import { execFileSync } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'ffmpeg-static';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'out');
const DOCS = path.join(__dirname, '..', '..', 'docs');

const webm = readdirSync(OUT).filter((f) => f.endsWith('.webm')).map((f) => path.join(OUT, f))[0];
if (!webm || !existsSync(webm)) {
  console.error('No recording found in out/. Run `node demo.mjs` first.');
  process.exit(1);
}
const run = (args) => execFileSync(ffmpeg, args, { stdio: 'inherit' });

// MP4 (web-friendly h264)
run(['-y', '-i', webm, '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
  '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-crf', '24', path.join(DOCS, 'demo.mp4')]);

// GIF (2-pass palette, 960px, 12fps)
const pal = path.join(OUT, 'palette.png');
run(['-y', '-i', webm, '-vf', 'fps=12,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff', pal]);
run(['-y', '-i', webm, '-i', pal, '-lavfi',
  'fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3',
  path.join(DOCS, 'demo.gif')]);

console.log('Wrote docs/demo.gif and docs/demo.mp4');
