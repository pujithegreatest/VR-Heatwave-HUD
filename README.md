# Heatwave CMR HUD

This folder now contains the easiest Quest-friendly version of the old Heatwave filter concept: a static WebXR prototype built with `index.html`, `app.js`, and `styles.css`.

## What It Is

- A Continuum-style thermal HUD mockup.
- Runs in desktop browsers for preview.
- Runs in Quest Browser with `Enter VR`.
- Ready to publish as-is to GitHub Pages.

## Fastest Way To Use It

1. Put this folder in a GitHub repo.
2. Enable GitHub Pages for the repo root.
3. Open the published URL in Quest Browser.
4. Tap `Enter VR`.

## Local Testing

Open a simple static server from this folder, for example:

```bash
cd "/Users/pujisan/Desktop/NOT STARTED/(s) Heatwave filter"
python3 -m http.server 8000
```

Then open `http://localhost:8000` on your computer, or use your machine's local IP from Quest if both are on the same network.

## Important Limitation

This build is a VR scene, not true passthrough mixed reality. If you want the HUD floating over Quest 3 passthrough, the next step is:

1. Keep these art assets and layout ideas.
2. Rebuild the HUD in Unity UI or world-space canvases.
3. Use Meta XR / Passthrough inside Unity.

That is the correct route for a real CMR-style MR headset experience. This WebXR version is the fast prototype route.
