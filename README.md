# VR Heatwave HUD

This repo contains a lightweight WebXR prototype for a Continuum-style thermal HUD on Quest 3. It is built as a static site with `index.html`, `app.js`, and `styles.css`.

## What It Is

- A Continuum-style thermal HUD mockup.
- Runs in desktop browsers for preview.
- Runs in Quest Browser with `Enter VR`.
- Ready to publish as-is to GitHub Pages.
- Includes desktop movement controls and spectrum switching for laptop preview.

## Fastest Way To Use It

1. Push this repo to GitHub.
2. Enable GitHub Pages for the repo root.
3. Open the published URL in Quest Browser.
4. Tap `Enter VR`.

## Local Testing

Open a simple static server from this folder, for example:

```bash
cd "/Users/{your_name}/Documents/GitHub/VR-Heatwave-HUD"
python3 -m http.server 8000
```

Then open `http://localhost:8000` on your computer, or use your machine's local IP from Quest if both are on the same network.

## Desktop Controls

- Drag with the mouse to look around.
- Use `W`, `A`, `S`, `D` to move.
- Use `R` and `F` to move up and down.
- Hold `Shift` to move faster.
- Press `P` to cycle thermal spectrum modes.
- Press `H` to hide or show the desktop help panel.

## Important Limitation

This build is a VR scene, not true passthrough mixed reality. If you want the HUD floating over Quest 3 passthrough, the next step is:

1. Keep these art assets and layout ideas.
2. Rebuild the HUD in Unity UI or world-space canvases.
3. Use Meta XR / Passthrough inside Unity.

That is the correct route for a real CMR-style MR headset experience. This WebXR version is the fast prototype route.
