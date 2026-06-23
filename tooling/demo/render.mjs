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

// Playback speed-up applied to both outputs (trims dead time, keeps the file light).
const SPEED = Number(process.env.DEMO_SPEED || 1.3);
const speed = `setpts=PTS/${SPEED}`;

// MP4 (web-friendly h264)
run(['-y', '-i', webm, '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
  '-vf', `${speed},scale=1280:-2`, '-c:v', 'libx264', '-crf', '24', path.join(DOCS, 'demo.mp4')]);

// GIF (2-pass palette — 760px, 8fps, sped up: keeps it light for the README)
const gifVf = `${speed},fps=8,scale=760:-1:flags=lanczos`;
const pal = path.join(OUT, 'palette.png');
run(['-y', '-i', webm, '-vf', `${gifVf},palettegen=stats_mode=diff`, pal]);
run(['-y', '-i', webm, '-i', pal, '-lavfi',
  `${gifVf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
  path.join(DOCS, 'demo.gif')]);

console.log('Wrote docs/demo.gif and docs/demo.mp4');
