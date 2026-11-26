# Smart Editor — AI-Assisted Video Editing Pipeline

Analyzes a source video and produces a structured **edit plan** you can review
before rendering: automatic silence cuts, scene/highlight markers, timestamped
captions (`.srt`/`.vtt`), timeline markers (`.edl`/`.csv`), and a ready-to-run
FFmpeg render script. The original media is never modified — this is the
"smart cuts + manual polish" loop: generate a rough cut, then fine-tune in
your editor.

## Requirements

- **Node.js ≥ 18**
- **ffmpeg + ffprobe** on `PATH` (or set `FFMPEG_PATH` / `FFPROBE_PATH`)
- Optional transcription:
  - `OPENAI_API_KEY` → OpenAI Whisper API (best quality)
  - `WHISPER_CLI` → local [whisper.cpp](https://github.com/ggerganov/whisper.cpp) binary
  - neither → analysis still works; captions will be empty

## Setup

```bash
cd smart-editor
cp .env.example .env        # then edit values
npm install                 # no runtime deps, but keeps npm scripts working
```

## Usage (CLI)

```bash
# Full analysis → edit-plan.json + captions + markers + render.sh
node src/cli.js analyze ./my-video.mp4 --preset presets/default.json --out ./out

# Captions only
node src/cli.js captions ./my-video.mp4 --out ./out

# Regenerate render script from an existing plan
node src/cli.js render ./out/my-video/edit-plan.json --input ./my-video.mp4
```

Or via npm:

```bash
npm run analyze -- ./my-video.mp4
npm run captions -- ./my-video.mp4
npm run render   -- ./out/my-video/edit-plan.json
```

## Outputs (in `--out` dir)

| File               | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `edit-plan.json`   | Full structured plan: cuts, keeps, highlights, captions, transitions |
| `captions.srt`     | Subtitles — import into any editor or burn into video |
| `captions.vtt`     | WebVTT subtitles                                      |
| `markers.edl`      | CMX3600 EDL for Premiere / Resolve / DaVinci          |
| `markers.csv`      | Marker list (id, start, end, label, type, score)      |
| `render.sh`        | FFmpeg concat-cut + subtitle render + preview script  |

## Review → adjust → render loop

1. Run `analyze` and open `edit-plan.json`.
2. Edit `cuts` / `keeps` / `captions` as needed (it's plain JSON).
3. Re-run `render` to regenerate `render.sh`, then `bash render.sh`.
4. `smart-cut.mp4` is the rough cut; `preview.mp4` is a fast low-res check.
5. Fine-tune pacing/audio/visuals in your NLE using `markers.edl` + `captions.srt`.

## VS Code

Run tasks from **Terminal → Run Task** (`Ctrl+Shift+P` → "Tasks: Run Task"):

- `Smart Edit: Analyze video…` — pick a file, produces the full plan
- `Smart Edit: Captions only…` — transcription → `.srt`/`.vtt`
- `Smart Edit: Render from plan…` — regenerate `render.sh` for a plan

## Environment variables

See `.env.example`. Key ones:

- `FFMPEG_PATH`, `FFPROBE_PATH` — binary locations
- `SILENCE_NOISE`, `SILENCE_MIN_DURATION`, `SILENCE_PADDING` — cut sensitivity
- `SCENE_THRESHOLD` — highlight detection sensitivity (0–1)
- `TRANSCRIBE_PROVIDER` — `openai` | `whispercpp` | `none`
- `OPENAI_API_KEY`, `WHISPER_CLI`, `WHISPER_MODEL`
- `RENDER_CRF`, `RENDER_PRESET`, `RENDER_BURN_SUBTITLES`
