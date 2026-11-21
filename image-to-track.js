const templateInput = document.querySelector("#template-file");
const framesInput = document.querySelector("#frame-files");
const thresholdInput = document.querySelector("#threshold");
const darkColorInput = document.querySelector("#dark-color");
const lightColorInput = document.querySelector("#light-color");
const invertInput = document.querySelector("#invert");
const flipXInput = document.querySelector("#flip-x");
const flipYInput = document.querySelector("#flip-y");
const convertButton = document.querySelector("#convert-button");
const statusText = document.querySelector("#status-text");
const statusDot = document.querySelector("#status-dot");
const progressLabel = document.querySelector("#progress-label");
const progressFill = document.querySelector("#progress-fill");
const preview = document.querySelector("#preview");
const previewCaption = document.querySelector("#preview-caption");

let templateData = null;
let templatePartsByPosition = null;
let xCoordinates = [];
let zCoordinates = [];
let selectedFrames = [];

function status(message, state = "normal") {
  statusText.textContent = message;
  statusDot.className = "status-dot" + (state === "ready" ? " ready" : state === "error" ? " error" : "");
}

function naturalCompare(a, b) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

function updateReadyState() {
  convertButton.disabled = !(templateData && selectedFrames.length && window.JSZip);
}

function parseTemplate(data) {
  if (data?.format !== "PolyTrack2" || !data?.track || !Array.isArray(data.track.parts)) {
    throw new Error("That file does not look like a decompiled PolyTrack2 JSON template.");
  }
  if (data.track.parts.length !== 432) {
    throw new Error(`Expected 432 blocks in the 24×18 template; found ${data.track.parts.length}.`);
  }

  const xs = [...new Set(data.track.parts.map(part => part.x))].sort((a,b) => a-b);
  const zs = [...new Set(data.track.parts.map(part => part.z))].sort((a,b) => a-b);
  if (xs.length !== 18 || zs.length !== 24) {
    throw new Error(`Template must have 18 X coordinates and 24 Z coordinates; found ${xs.length} and ${zs.length}.`);
  }

  const map = new Map();
  for (const part of data.track.parts) {
    if (part.partId !== 29) throw new Error("The template must contain Block parts (partId 29) only.");
    const key = `${part.x},${part.z}`;
    if (map.has(key)) throw new Error("The template contains duplicate block coordinates.");
    map.set(key, part);
  }
  if (map.size !== 432) throw new Error("The template is missing one or more grid positions.");

  templateData = data;
  templatePartsByPosition = map;
  xCoordinates = xs;
  zCoordinates = zs;
}

function getSettings() {
  const threshold = Number(thresholdInput.value);
  const dark = Number(darkColorInput.value);
  const light = Number(lightColorInput.value);
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 255) throw new Error("Threshold must be from 0 to 255.");
  if (!Number.isInteger(dark) || dark < 0 || dark > 255 || !Number.isInteger(light) || light < 0 || light > 255) {
    throw new Error("Color IDs must be whole numbers from 0 to 255.");
  }
  return { threshold, dark, light, invert: invertInput.checked, flipX: flipXInput.checked, flipY: flipYInput.checked };
}

async function rasterize(file, settings) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 18;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.save();
  if (settings.flipX || settings.flipY) {
    context.translate(settings.flipX ? 24 : 0, settings.flipY ? 18 : 0);
    context.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1);
  }
  context.drawImage(bitmap, 0, 0, 24, 18);
  context.restore();
  bitmap.close?.();

  const pixels = context.getImageData(0, 0, 24, 18).data;
  const grid = [];
  const imageData = context.createImageData(24, 18);
  for (let row = 0; row < 18; row++) {
    const line = [];
    for (let col = 0; col < 24; col++) {
      const i = (row * 24 + col) * 4;
      const luminance = Math.round(0.2126 * pixels[i] + 0.7152 * pixels[i+1] + 0.0722 * pixels[i+2]);
      let isLight = luminance >= settings.threshold;
      if (settings.invert) isLight = !isLight;
      line.push(isLight ? settings.light : settings.dark);
      const value = isLight ? 255 : 0;
      imageData.data[i] = value;
      imageData.data[i+1] = value;
      imageData.data[i+2] = value;
      imageData.data[i+3] = 255;
    }
    grid.push(line);
  }
  context.putImageData(imageData, 0, 0);
  return grid;
}

function makeFrameJson(grid, file, index) {
  const result = JSON.parse(JSON.stringify(templateData));
  const frameName = `frame_${String(index + 1).padStart(6, "0")}`;
  result.metadata = result.metadata || {};
  result.metadata.name = frameName;
  result.metadata.lastModified = new Date().toISOString();

  const parts = [];
  // Image rows map to increasing X; image columns map to increasing Z.
  for (let row = 0; row < 18; row++) {
    for (let col = 0; col < 24; col++) {
      const x = xCoordinates[row];
      const z = zCoordinates[col];
      const part = { ...templatePartsByPosition.get(`${x},${z}`) };
      part.color = grid[row][col];
      // User confirmed block rotation does not affect appearance.
      part.rotation = 0;
      part.rotationAxis = 0;
      if ("rotationAxisName" in part) part.rotationAxisName = "YPositive";
      parts.push(part);
    }
  }
  result.track.parts = parts;
  return result;
}

async function showPreview(file) {
  try {
    const settings = getSettings();
    const grid = await rasterize(file, settings);
    const ctx = preview.getContext("2d");
    ctx.clearRect(0, 0, 24, 18);
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 24; x++) {
        ctx.fillStyle = grid[y][x] === settings.light ? "#fff" : "#000";
        ctx.fillRect(x, y, 1, 1);
      }
    }
    previewCaption.textContent = `${file.name} · resized to 24 × 18 pixels`;
  } catch (error) {
    previewCaption.textContent = error.message;
  }
}

templateInput.addEventListener("change", async () => {
  const file = templateInput.files?.[0];
  if (!file) return;
  try {
    parseTemplate(JSON.parse(await file.text()));
    document.querySelector("#template-status").textContent = `Loaded ${file.name} · 432 blocks`;
    status("Template loaded. Choose image frames.", "ready");
  } catch (error) {
    templateData = null;
    templatePartsByPosition = null;
    document.querySelector("#template-status").textContent = "Template could not be loaded";
    status(error.message, "error");
  }
  updateReadyState();
});

framesInput.addEventListener("change", async () => {
  selectedFrames = [...(framesInput.files || [])].sort(naturalCompare);
  document.querySelector("#frames-status").textContent = selectedFrames.length
    ? `${selectedFrames.length.toLocaleString()} frame(s) selected`
    : "No frames selected";
  if (selectedFrames[0]) await showPreview(selectedFrames[0]);
  updateReadyState();
});

for (const control of [thresholdInput, darkColorInput, lightColorInput, invertInput, flipXInput, flipYInput]) {
  control.addEventListener("change", () => {
    if (selectedFrames[0]) showPreview(selectedFrames[0]);
  });
}

convertButton.addEventListener("click", async () => {
  if (!templateData || !selectedFrames.length) return;
  convertButton.disabled = true;
  progressFill.style.width = "0%";
  progressLabel.textContent = `0 / ${selectedFrames.length}`;
  try {
    if (!window.JSZip) throw new Error("ZIP library did not load. Refresh the page and try again.");
    const settings = getSettings();
    const zip = new JSZip();
    for (let index = 0; index < selectedFrames.length; index++) {
      const file = selectedFrames[index];
      status(`Processing ${file.name}…`);
      const grid = await rasterize(file, settings);
      const result = makeFrameJson(grid, file, index);
      const json = JSON.stringify(result);
      zip.file(`frame_${String(index + 1).padStart(6, "0")}.json`, json);
      const completed = index + 1;
      progressLabel.textContent = `${completed} / ${selectedFrames.length}`;
      progressFill.style.width = `${(completed / selectedFrames.length) * 100}%`;
      if (completed % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }

    status("Building ZIP archive…");
    const blob = await zip.generateAsync(
      { type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } },
      metadata => {
        progressFill.style.width = `${metadata.percent.toFixed(1)}%`;
      }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "polytrack_image_frames_24x18.zip";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status(`Done! Created ${selectedFrames.length} decompiled JSON files.`, "ready");
  } catch (error) {
    console.error(error);
    status(error.message || "Conversion failed.", "error");
  } finally {
    convertButton.disabled = false;
  }
});

updateReadyState();
