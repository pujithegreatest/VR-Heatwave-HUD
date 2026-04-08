import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VRButton } from "three/addons/webxr/VRButton.js";

const canvas = document.querySelector("#app");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030612);
scene.fog = new THREE.FogExp2(0x050612, 0.05);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.xr.enabled = true;

const xrButton = VRButton.createButton(renderer, {
  optionalFeatures: ["local-floor"],
});
document.body.appendChild(xrButton);

renderer.xr.addEventListener("sessionstart", () => {
  document.body.classList.add("is-xr");
});

renderer.xr.addEventListener("sessionend", () => {
  document.body.classList.remove("is-xr");
});

const camera = new THREE.PerspectiveCamera(
  68,
  window.innerWidth / window.innerHeight,
  0.01,
  120
);
camera.position.set(0, 1.65, 3.75);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableZoom = false;
controls.target.set(0, 1.6, -5.5);
controls.minPolarAngle = Math.PI * 0.2;
controls.maxPolarAngle = Math.PI * 0.8;
controls.update();

const clock = new THREE.Clock();
const textureLoader = new THREE.TextureLoader();
const worldPosition = new THREE.Vector3();
const worldDirection = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const tempDisplay = {
  center: 33.2,
  max: 36.9,
  min: 29.4,
  signal: 94,
  lock: "SEARCHING",
};

const thermalTargets = [];
const thermalMaterials = [];
const hudTextures = [];
const updateables = [];

scene.add(new THREE.HemisphereLight(0x72d8ff, 0x120312, 1.4));

const rimLight = new THREE.PointLight(0x4fe5ff, 14, 28, 2);
rimLight.position.set(0, 5.5, 2);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0xff4281, 7, 18, 2);
fillLight.position.set(2.5, 2.2, -8);
scene.add(fillLight);

const backdrop = createBackdrop();
scene.add(backdrop);
scene.add(createFloor());
scene.add(createTunnel());
scene.add(createParticles());
scene.add(createPulseBeacon());

[
  { id: "TARGET-01", label: "CIV-182004", position: [-1.45, 0, -5.6], temp: 36.3, tilt: 0.2 },
  { id: "TARGET-02", label: "CIV-254876", position: [0, 0, -8.4], temp: 37.2, tilt: -0.15 },
  { id: "TARGET-03", label: "CIV-758426", position: [1.65, 0, -11.6], temp: 36.9, tilt: -0.28 },
].forEach((config) => {
  const target = createThermalTarget(config);
  thermalTargets.push(target);
  scene.add(target.root);
  scene.add(target.tag);
});

const scanFrame = createScanFrame();
scene.add(scanFrame);

const hud = createHud();
camera.add(hud.root);

window.addEventListener("resize", onResize);

renderer.setAnimationLoop(render);

function render() {
  const elapsed = clock.getElapsedTime();
  if (!renderer.xr.isPresenting) {
    controls.update();
  }

  backdrop.material.uniforms.uTime.value = elapsed;
  hud.scanMaterial.uniforms.uTime.value = elapsed;
  hud.reticle.material.color.set(hud.lockedTarget ? 0xb3ff4b : 0x6fe6ff);
  hud.reticle.scale.setScalar(hud.lockedTarget ? 1.04 : 1);

  worldPulse(elapsed);
  updateLock(elapsed);
  updateHud(elapsed);

  renderer.render(scene, camera);
}

function updateLock(elapsed) {
  const activeCamera = renderer.xr.isPresenting
    ? renderer.xr.getCamera(camera)
    : camera;
  activeCamera.getWorldPosition(worldPosition);
  activeCamera.getWorldDirection(worldDirection);
  raycaster.set(worldPosition, worldDirection);

  const hits = raycaster.intersectObjects(
    thermalTargets.flatMap((target) => target.hitMeshes),
    false
  );

  const lockedTarget = hits[0]?.object.userData.scanTarget ?? null;
  hud.lockedTarget = lockedTarget;

  for (const target of thermalTargets) {
    const isLocked = target === lockedTarget;
    target.material.uniforms.uSelected.value = isLocked ? 1 : 0;
    target.tag.material.opacity = isLocked ? 1 : 0.44;
    target.tag.scale.setScalar(isLocked ? 1.08 : 1);

    const sway = Math.sin(elapsed * 0.9 + target.phase) * 0.025;
    target.root.position.y = sway;
    target.tag.position.set(
      target.root.position.x,
      2.62 + sway,
      target.root.position.z
    );
  }

  if (lockedTarget) {
    tempDisplay.center = mix(tempDisplay.center, targetReading(lockedTarget, elapsed), 0.12);
    tempDisplay.max = mix(tempDisplay.max, tempDisplay.center + 1.05, 0.08);
    tempDisplay.min = mix(tempDisplay.min, tempDisplay.center - 4.1, 0.08);
    tempDisplay.signal = Math.round(mix(tempDisplay.signal, 99, 0.08));
    tempDisplay.lock = lockedTarget.id;

    scanFrame.visible = true;
    scanFrame.material.color.set(0xb3ff4b);
    scanFrame.material.opacity = 0.78 + Math.sin(elapsed * 8) * 0.08;
    scanFrame.position.set(
      lockedTarget.root.position.x,
      1.42 + Math.sin(elapsed * 1.6 + lockedTarget.phase) * 0.025,
      lockedTarget.root.position.z + 0.02
    );
    scanFrame.lookAt(worldPosition);
  } else {
    tempDisplay.center = mix(tempDisplay.center, 32.4 + Math.sin(elapsed * 0.7) * 0.4, 0.08);
    tempDisplay.max = mix(tempDisplay.max, 35.6, 0.06);
    tempDisplay.min = mix(tempDisplay.min, 28.1, 0.06);
    tempDisplay.signal = Math.round(mix(tempDisplay.signal, 91, 0.06));
    tempDisplay.lock = "SEARCHING";
    scanFrame.visible = false;
  }
}

function updateHud(elapsed) {
  drawPanel(hud.leftPanel.ctx, hud.leftPanel.canvas, elapsed);
  drawStatus(hud.rightPanel.ctx, hud.rightPanel.canvas, elapsed);
  drawTicker(hud.ticker.ctx, hud.ticker.canvas, elapsed);

  for (const texture of hudTextures) {
    texture.needsUpdate = true;
  }

  const alphaPulse = 0.82 + Math.sin(elapsed * 2.4) * 0.08;
  hud.iconMaterials.forEach((material, index) => {
    material.opacity = alphaPulse - index * 0.08;
  });
}

function drawPanel(ctx, canvasRef, elapsed) {
  ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
  drawRoundedPanel(ctx, canvasRef.width, canvasRef.height);

  ctx.strokeStyle = "rgba(118, 232, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, 72);
  ctx.lineTo(canvasRef.width - 32, 72);
  ctx.stroke();

  ctx.fillStyle = "#e7fbff";
  ctx.font = '600 34px "HeatwaveText", sans-serif';
  ctx.fillText("CMR / HEATWAVE", 30, 46);

  ctx.fillStyle = "rgba(196, 244, 255, 0.82)";
  ctx.font = '600 20px "HeatwaveText", sans-serif';
  ctx.fillText("THERMAL LOCK SEQUENCE", 30, 102);
  ctx.fillText(`LOCK: ${tempDisplay.lock}`, 30, 132);

  ctx.font = '600 42px "HeatwaveText", sans-serif';
  ctx.fillStyle = "#f5ffcc";
  ctx.fillText(`${tempDisplay.center.toFixed(1)} C`, 30, 202);

  ctx.fillStyle = "rgba(215, 247, 255, 0.88)";
  ctx.font = '600 26px "HeatwaveText", sans-serif';
  ctx.fillText(`CEN  ${tempDisplay.center.toFixed(1)}`, 30, 256);
  ctx.fillText(`MAX  ${tempDisplay.max.toFixed(1)}`, 30, 292);
  ctx.fillText(`MIN  ${tempDisplay.min.toFixed(1)}`, 30, 328);

  const graphY = 360;
  ctx.strokeStyle = "rgba(96, 228, 255, 0.65)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 26; i += 1) {
    const x = 30 + i * 15;
    const value =
      Math.sin(elapsed * 2.4 + i * 0.48) * 14 +
      Math.sin(elapsed * 1.1 + i * 0.18) * 10;
    const y = graphY + value;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function drawStatus(ctx, canvasRef, elapsed) {
  ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
  drawRoundedPanel(ctx, canvasRef.width, canvasRef.height);

  ctx.fillStyle = "#e7fbff";
  ctx.font = '600 28px "HeatwaveText", sans-serif';
  ctx.fillText("BODY TEMPERATURE", 26, 42);

  ctx.fillStyle = hud.lockedTarget ? "#baff59" : "#70e5ff";
  ctx.font = '600 70px "HeatwaveText", sans-serif';
  ctx.fillText(`${tempDisplay.center.toFixed(1)}`, 24, 124);

  ctx.fillStyle = "rgba(234, 248, 255, 0.72)";
  ctx.font = '600 22px "HeatwaveText", sans-serif';
  ctx.fillText("SIGNAL", 26, 162);
  ctx.fillText("MODE", 184, 162);
  ctx.fillStyle = "#eef9ff";
  ctx.fillText(`${tempDisplay.signal}%`, 26, 192);
  ctx.fillText(hud.lockedTarget ? "LOCKED" : "SWEEP", 184, 192);

  const barX = 24;
  const barY = 214;
  const segments = 8;
  for (let i = 0; i < segments; i += 1) {
    const width = 34;
    const gap = 8;
    const x = barX + i * (width + gap);
    const lit = i <= Math.floor((tempDisplay.signal / 100) * segments);
    ctx.fillStyle = lit
      ? `rgba(${90 + i * 18}, ${230 - i * 10}, 255, 0.92)`
      : "rgba(68, 102, 140, 0.28)";
    ctx.fillRect(x, barY, width, 10 + Math.sin(elapsed * 4 + i) * 2);
  }
}

function drawTicker(ctx, canvasRef, elapsed) {
  ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
  drawRoundedPanel(ctx, canvasRef.width, canvasRef.height, 0.52);

  ctx.fillStyle = "#dffbff";
  ctx.font = '600 28px "HeatwaveText", sans-serif';
  ctx.fillText("CAM 05", 26, 40);

  ctx.fillStyle = "rgba(210, 244, 255, 0.76)";
  ctx.font = '600 18px "HeatwaveText", sans-serif';
  ctx.fillText("BIOMETRIC IDENTIFICATION : ON", 26, 78);
  ctx.fillText("BODY TEMPERATURE DETECTION : ON", 470, 78);

  const date = new Date();
  const timestamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
  const time = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(":");

  ctx.fillStyle = "#edf9ff";
  ctx.font = '600 22px "HeatwaveText", sans-serif';
  ctx.fillText(`${timestamp}  ${time}`, 735, 40);

  ctx.strokeStyle = "rgba(108, 230, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 28; i += 1) {
    const x = 26 + i * 36;
    const y = 114 + Math.sin(elapsed * 3 + i * 0.42) * 8;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  ctx.fillStyle = hud.lockedTarget ? "#baff59" : "#8feaff";
  ctx.font = '600 18px "HeatwaveText", sans-serif';
  ctx.fillText(hud.lockedTarget ? `TRACKING ${hud.lockedTarget.id}` : "SCANNING ENVIRONMENT", 26, 134);
}

function drawRoundedPanel(ctx, width, height, opacity = 0.72) {
  const radius = 28;
  ctx.save();
  ctx.fillStyle = `rgba(6, 15, 31, ${opacity})`;
  ctx.strokeStyle = "rgba(112, 229, 255, 0.26)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  traceRoundedRect(ctx, 0, 0, width, height, radius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function createBackdrop() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorldPosition;

      void main() {
        vec3 dir = normalize(vWorldPosition);
        float horizon = smoothstep(-0.65, 0.75, dir.y + sin(uTime * 0.2 + dir.x * 5.0) * 0.08);
        float plume = 0.5 + 0.5 * sin(uTime * 0.35 + dir.x * 11.0 + dir.z * 9.0);
        float scan = 0.5 + 0.5 * sin((dir.y * 18.0 - uTime * 0.7) * 6.28318);

        vec3 cold = vec3(0.02, 0.04, 0.12);
        vec3 mid = vec3(0.12, 0.05, 0.28);
        vec3 warm = vec3(0.77, 0.11, 0.42);
        vec3 hot = vec3(0.98, 0.58, 0.16);

        vec3 color = mix(cold, mid, horizon);
        color = mix(color, warm, smoothstep(0.28, 0.84, horizon + plume * 0.1));
        color = mix(color, hot, smoothstep(0.64, 1.0, plume * 0.75 + horizon * 0.3));
        color += scan * 0.018;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  return new THREE.Mesh(new THREE.SphereGeometry(42, 48, 48), material);
}

function createFloor() {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshStandardMaterial({
      color: 0x06111e,
      emissive: 0x071428,
      emissiveIntensity: 1.3,
      roughness: 0.86,
      metalness: 0.12,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  group.add(floor);

  const grid = new THREE.GridHelper(34, 34, 0x73e9ff, 0x1a3663);
  grid.position.y = 0.01;
  grid.material.opacity = 0.2;
  grid.material.transparent = true;
  group.add(grid);

  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.65 + i * 0.28, 0.68 + i * 0.28, 48),
      new THREE.MeshBasicMaterial({
        color: i === 2 ? 0xff4d8e : 0x73e9ff,
        transparent: true,
        opacity: 0.16 - i * 0.03,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.02 + i * 0.002, -8.3);
    group.add(ring);
  }

  return group;
}

function createTunnel() {
  const group = new THREE.Group();
  const ringGeometry = new THREE.TorusGeometry(3.15, 0.03, 12, 96);

  for (let i = 0; i < 7; i += 1) {
    const color = new THREE.Color(i % 2 === 0 ? 0x53dcff : 0x9046ff);
    const ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.36 - i * 0.03,
      })
    );
    ring.position.set(0, 2.05, -3.9 - i * 2.7);
    group.add(ring);
  }

  for (const x of [-2.8, 2.8]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 2.8, 16),
      new THREE.MeshBasicMaterial({
        color: x < 0 ? 0x70e5ff : 0xff4d8e,
        transparent: true,
        opacity: 0.18,
      })
    );
    rail.position.set(x, 1.55, -9);
    group.add(rail);
  }

  return group;
}

function createParticles() {
  const geometry = new THREE.BufferGeometry();
  const particleCount = 900;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const color = new THREE.Color();

  for (let i = 0; i < particleCount; i += 1) {
    const offset = i * 3;
    positions[offset] = (Math.random() - 0.5) * 18;
    positions[offset + 1] = Math.random() * 8;
    positions[offset + 2] = -Math.random() * 28;

    color.setHSL(0.56 + Math.random() * 0.12, 0.85, 0.55);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      sizeAttenuation: true,
    })
  );

  updateables.push((elapsed) => {
    points.rotation.y = elapsed * 0.014;
    points.position.z = Math.sin(elapsed * 0.15) * 0.4;
  });

  return points;
}

function createPulseBeacon() {
  const group = new THREE.Group();
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff6a55,
      transparent: true,
      opacity: 0.82,
    })
  );
  beacon.position.set(0, 1.2, -8.3);
  group.add(beacon);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.42, 64),
    new THREE.MeshBasicMaterial({
      color: 0xff9a4d,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
    })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.set(0, 0.08, -8.3);
  group.add(halo);

  updateables.push((elapsed) => {
    const pulse = 0.82 + Math.sin(elapsed * 3.2) * 0.18;
    beacon.scale.setScalar(pulse);
    beacon.material.opacity = 0.6 + Math.sin(elapsed * 4.8) * 0.16;
    halo.scale.setScalar(1 + Math.sin(elapsed * 2.6) * 0.16);
  });

  return group;
}

function createThermalTarget({ id, label: bioId, position, temp, tilt }) {
  const material = createThermalMaterial(temp);
  thermalMaterials.push(material);

  const root = new THREE.Group();
  root.position.set(position[0], position[1], position[2]);
  root.rotation.y = tilt;

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.06, 10, 18), material);
  body.position.y = 1.08;
  root.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), material);
  head.position.y = 1.92;
  root.add(head);

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 2.5),
    new THREE.MeshBasicMaterial({
      color: 0x4ff0ff,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  plate.position.y = 1.25;
  plate.position.z = -0.02;
  root.add(plate);

  const tag = createTagSprite(id, bioId, temp);
  tag.position.set(position[0], 2.62, position[2]);
  tag.material.opacity = 0.44;

  body.userData.scanTarget = {
    id,
    bioId,
    temp,
    root,
    material,
    hitMeshes: [body, head],
    phase: Math.random() * Math.PI * 2,
    tag,
  };
  head.userData.scanTarget = body.userData.scanTarget;

  return body.userData.scanTarget;
}

function createThermalMaterial(temp) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHeat: { value: THREE.MathUtils.clamp((temp - 34) / 4.5, 0.25, 1) },
      uSelected: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPosition;

      void main() {
        vLocalPosition = position;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uHeat;
      uniform float uSelected;

      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPosition;

      vec3 palette(float t) {
        vec3 cold = vec3(0.03, 0.08, 0.46);
        vec3 mid = vec3(0.28, 0.06, 0.68);
        vec3 warm = vec3(0.98, 0.16, 0.38);
        vec3 hot = vec3(0.98, 0.86, 0.18);

        vec3 color = mix(cold, mid, smoothstep(0.0, 0.38, t));
        color = mix(color, warm, smoothstep(0.32, 0.7, t));
        color = mix(color, hot, smoothstep(0.72, 1.0, t));
        return color;
      }

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 2.0);
        float wave = sin(uTime * 3.2 + vWorldPosition.y * 4.6 + vWorldPosition.x * 3.2) * 0.08;
        float vertical = smoothstep(-1.0, 1.7, vLocalPosition.y * 0.95 + uHeat * 1.1 + wave);
        float thermal = clamp(vertical + fresnel * 0.18 + uSelected * 0.16, 0.0, 1.0);
        vec3 color = palette(thermal);
        color += vec3(0.08, 0.44, 0.65) * fresnel * 0.28;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

function createTagSprite(id, label, temp) {
  const canvasRef = document.createElement("canvas");
  canvasRef.width = 512;
  canvasRef.height = 144;
  const ctx = canvasRef.getContext("2d");

  ctx.fillStyle = "rgba(12, 24, 46, 0.66)";
  ctx.strokeStyle = "rgba(128, 236, 255, 0.34)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  traceRoundedRect(ctx, 4, 4, 504, 136, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#dffbff";
  ctx.font = '600 28px "HeatwaveText", sans-serif';
  ctx.fillText(id, 24, 42);

  ctx.fillStyle = "rgba(212, 242, 255, 0.7)";
  ctx.font = '600 18px "HeatwaveText", sans-serif';
  ctx.fillText(label, 24, 74);

  ctx.fillStyle = "#baff59";
  ctx.font = '600 40px "HeatwaveText", sans-serif';
  ctx.fillText(`${temp.toFixed(1)} C`, 24, 122);

  const texture = new THREE.CanvasTexture(canvasRef);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  return new THREE.Sprite(material);
}

function createScanFrame() {
  const width = 0.92;
  const height = 2.14;
  const corner = 0.17;
  const points = [];

  const addSegment = (x1, y1, x2, y2) => {
    points.push(new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0));
  };

  addSegment(-width / 2, height / 2, -width / 2 + corner, height / 2);
  addSegment(-width / 2, height / 2, -width / 2, height / 2 - corner);
  addSegment(width / 2, height / 2, width / 2 - corner, height / 2);
  addSegment(width / 2, height / 2, width / 2, height / 2 - corner);
  addSegment(-width / 2, -height / 2, -width / 2 + corner, -height / 2);
  addSegment(-width / 2, -height / 2, -width / 2, -height / 2 + corner);
  addSegment(width / 2, -height / 2, width / 2 - corner, -height / 2);
  addSegment(width / 2, -height / 2, width / 2, -height / 2 + corner);

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xb3ff4b,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });

  const frame = new THREE.LineSegments(geometry, material);
  frame.visible = false;
  return frame;
}

function createHud() {
  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  const leftPanel = makeCanvasPlane(540, 420, 0.58, 0.45);
  leftPanel.mesh.position.set(-0.62, 0.2, -1.42);
  root.add(leftPanel.mesh);

  const rightPanel = makeCanvasPlane(360, 250, 0.42, 0.29);
  rightPanel.mesh.position.set(0.55, 0.26, -1.38);
  root.add(rightPanel.mesh);

  const ticker = makeCanvasPlane(1024, 150, 0.84, 0.14);
  ticker.mesh.position.set(0, -0.44, -1.34);
  root.add(ticker.mesh);

  const heatBarTexture = textureLoader.load("./textures/ir-heat-bar.png");
  heatBarTexture.colorSpace = THREE.SRGBColorSpace;
  const heatBar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.52),
    new THREE.MeshBasicMaterial({
      map: heatBarTexture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
  );
  heatBar.position.set(0.83, 0.02, -1.36);
  root.add(heatBar);

  const reticle = createReticle();
  reticle.position.set(0, 0.02, -1.15);
  root.add(reticle);

  const scanPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.95, 1.15),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          float lines = sin((vUv.y * 180.0 - uTime * 55.0)) * 0.5 + 0.5;
          float sweep = smoothstep(0.0, 0.18, 1.0 - abs(vUv.y - fract(uTime * 0.18)));
          float edge = smoothstep(0.0, 0.24, vUv.x) * smoothstep(0.0, 0.24, 1.0 - vUv.x);
          edge *= smoothstep(0.0, 0.18, vUv.y) * smoothstep(0.0, 0.18, 1.0 - vUv.y);
          vec3 color = mix(vec3(0.0), vec3(0.42, 0.95, 1.0), lines * 0.08 + sweep * 0.18);
          gl_FragColor = vec4(color, (lines * 0.04 + sweep * 0.08) * edge);
        }
      `,
    })
  );
  scanPlane.position.set(0, 0, -1.48);
  root.add(scanPlane);

  const iconMaterials = [
    makeIcon("./textures/pc-icon.png", [-0.78, -0.47, -1.28], [0.07, 0.046]),
    makeIcon("./textures/battery-icon.png", [0.72, -0.43, -1.28], [0.072, 0.12]),
    makeIcon("./textures/sd card.png", [0.83, -0.43, -1.28], [0.074, 0.074]),
  ];

  iconMaterials.forEach(({ mesh }) => root.add(mesh));

  return {
    root,
    leftPanel,
    rightPanel,
    ticker,
    reticle,
    scanMaterial: scanPlane.material,
    iconMaterials: iconMaterials.map((entry) => entry.material),
    lockedTarget: null,
  };
}

function makeCanvasPlane(width, height, worldWidth, worldHeight) {
  const canvasRef = document.createElement("canvas");
  canvasRef.width = width;
  canvasRef.height = height;
  const ctx = canvasRef.getContext("2d");
  const texture = new THREE.CanvasTexture(canvasRef);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  hudTextures.push(texture);

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldWidth, worldHeight),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
  );

  return {
    canvas: canvasRef,
    ctx,
    texture,
    mesh,
  };
}

function createReticle() {
  const size = 0.085;
  const gap = 0.018;
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-size, 0, 0),
    new THREE.Vector3(-gap, 0, 0),
    new THREE.Vector3(size, 0, 0),
    new THREE.Vector3(gap, 0, 0),
    new THREE.Vector3(0, -size, 0),
    new THREE.Vector3(0, -gap, 0),
    new THREE.Vector3(0, size, 0),
    new THREE.Vector3(0, gap, 0),
    new THREE.Vector3(-gap, -gap, 0),
    new THREE.Vector3(-gap, gap, 0),
    new THREE.Vector3(gap, -gap, 0),
    new THREE.Vector3(gap, gap, 0),
  ]);

  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0x6fe6ff,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      depthTest: false,
    })
  );
}

function makeIcon(path, position, size) {
  const map = textureLoader.load(path);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map,
    color: 0xeefbff,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
  mesh.position.set(position[0], position[1], position[2]);
  return { mesh, material };
}

function targetReading(target, elapsed) {
  return target.temp + Math.sin(elapsed * 2.1 + target.phase) * 0.18;
}

function worldPulse(elapsed) {
  backdrop.material.uniforms.uTime.value = elapsed;

  for (const material of thermalMaterials) {
    material.uniforms.uTime.value = elapsed;
  }

  updateables.forEach((update) => update(elapsed));
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function mix(current, target, factor) {
  return current + (target - current) * factor;
}

function traceRoundedRect(ctx, x, y, width, height, radius) {
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function pad(value) {
  return String(value).padStart(2, "0");
}
