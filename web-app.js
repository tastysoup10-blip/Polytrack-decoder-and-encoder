const PYODIDE_VERSION = "0.27.7";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const input = document.querySelector("#input-text");
const output = document.querySelector("#output-text");
const fileInput = document.querySelector("#file-input");
const convertButton = document.querySelector("#convert-button");
const convertLabel = document.querySelector("#convert-label");
const downloadButton = document.querySelector("#download-button");
const statusText = document.querySelector("#status-text");
const statusDot = document.querySelector("#status-dot");
const inputLabel = document.querySelector("#input-label");
const inputHint = document.querySelector("#input-hint");
const outputLabel = document.querySelector("#output-label");
const outputHint = document.querySelector("#output-hint");
const inputCount = document.querySelector("#input-count");
const outputCount = document.querySelector("#output-count");

let mode = "encode";
let pyodide = null;
let outputFilename = "converted.track";

function setStatus(message, state = "normal") {
  statusText.textContent = message;
  statusDot.className = "status-dot" + (state === "ready" ? " ready" : state === "error" ? " error" : "");
}

function updateCounts() {
  inputCount.textContent = `${input.value.length.toLocaleString()} characters`;
  outputCount.textContent = `${output.value.length.toLocaleString()} characters`;
}

function setMode(nextMode) {
  mode = nextMode;
  const encoding = mode === "encode";
  document.querySelector("#encode-mode").classList.toggle("active", encoding);
  document.querySelector("#decode-mode").classList.toggle("active", !encoding);
  document.querySelector("#encode-mode").setAttribute("aria-selected", String(encoding));
  document.querySelector("#decode-mode").setAttribute("aria-selected", String(!encoding));

  inputLabel.textContent = encoding ? "Input JSON" : "Input TRACK code";
  inputHint.textContent = encoding
    ? "Paste your decoded PolyTrack JSON here, or choose a .json file."
    : "Paste a PolyTrack2 code or choose a .track file.";
  outputLabel.textContent = encoding ? "TRACK output" : "JSON output";
  outputHint.textContent = encoding
    ? "Your encoded track code will appear here."
    : "Your decoded track data will appear here.";
  input.placeholder = encoding ? "Paste JSON here…" : "Paste PolyTrack2 code here…";
  convertLabel.textContent = encoding ? "Encode JSON to TRACK" : "Decode TRACK to JSON";
  fileInput.accept = encoding ? ".json,.txt,application/json,text/plain" : ".track,.txt,text/plain";
  output.value = "";
  downloadButton.disabled = true;
  outputFilename = encoding ? "converted.track" : "converted.json";
  updateCounts();
}

async function initializePython() {
  try {
    setStatus("Downloading browser Python runtime…");
    pyodide = await loadPyodide({ indexURL: PYODIDE_BASE });

    setStatus("Loading encoder and decoder…");
    const [encoderResponse, decoderResponse] = await Promise.all([
      fetch("./polytrack_encoder.py"),
      fetch("./polytrack_decoder.py")
    ]);
    if (!encoderResponse.ok || !decoderResponse.ok) {
      throw new Error("Could not load the Python encoder/decoder files from this site.");
    }

    pyodide.FS.writeFile("/home/pyodide/polytrack_encoder.py", await encoderResponse.text());
    pyodide.FS.writeFile("/home/pyodide/polytrack_decoder.py", await decoderResponse.text());

    await pyodide.runPythonAsync(`
import sys
import json
sys.path.insert(0, "/home/pyodide")
import polytrack_encoder
import polytrack_decoder

def web_encode(json_text):
    data = json.loads(json_text)
    encoded = polytrack_encoder.encode_polytrack2(data)
    return encoded.decode("ascii")

def web_decode(track_text):
    raw = track_text.strip()
    if not raw.startswith("PolyTrack2"):
        raise ValueError("This does not look like a PolyTrack2 track code.")
    with open("/tmp/polytrack-browser-input.track", "wb") as track_file:
        track_file.write(raw.encode("ascii"))
    result = polytrack_decoder.decode_polytrack2("/tmp/polytrack-browser-input.track")
    return json.dumps(result, indent=2, ensure_ascii=False)
`);

    convertButton.disabled = false;
    convertLabel.textContent = mode === "encode" ? "Encode JSON to TRACK" : "Decode TRACK to JSON";
    setStatus("Converter ready. Files stay in your browser.", "ready");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not initialize the converter.", "error");
    convertLabel.textContent = "Converter unavailable";
  }
}

async function convert() {
  if (!pyodide) return;
  const raw = input.value.trim();
  if (!raw) {
    setStatus("Add some input before converting.", "error");
    return;
  }

  convertButton.disabled = true;
  convertLabel.textContent = "Converting…";
  setStatus("Converting locally…");
  output.value = "";
  downloadButton.disabled = true;

  try {
    let result;
    if (mode === "encode") {
      pyodide.globals.set("polytrack_json_input", raw);
      result = await pyodide.runPythonAsync("web_encode(polytrack_json_input)");
      outputFilename = "converted.track";
    } else {
      pyodide.globals.set("polytrack_track_input", raw);
      result = await pyodide.runPythonAsync("web_decode(polytrack_track_input)");
      outputFilename = "converted.json";
    }

    output.value = result;
    downloadButton.disabled = false;
    setStatus("Conversion complete.", "ready");
    updateCounts();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Conversion failed. Check the input format.", "error");
  } finally {
    pyodide.globals.delete("polytrack_json_input");
    pyodide.globals.delete("polytrack_track_input");
    convertButton.disabled = false;
    convertLabel.textContent = mode === "encode" ? "Encode JSON to TRACK" : "Decode TRACK to JSON";
  }
}

async function copyText(text) {
  if (!text) {
    setStatus("There is nothing to copy.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied to clipboard.", "ready");
  } catch {
    setStatus("Clipboard access was blocked by the browser. Select and copy the text manually.", "error");
  }
}

function downloadResult() {
  if (!output.value) return;
  const blob = new Blob([output.value], {
    type: mode === "encode" ? "text/plain;charset=utf-8" : "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = outputFilename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

document.querySelector("#encode-mode").addEventListener("click", () => setMode("encode"));
document.querySelector("#decode-mode").addEventListener("click", () => setMode("decode"));
convertButton.addEventListener("click", convert);
downloadButton.addEventListener("click", downloadResult);
input.addEventListener("input", updateCounts);
output.addEventListener("input", updateCounts);

document.querySelector("#clear-button").addEventListener("click", () => {
  input.value = "";
  output.value = "";
  downloadButton.disabled = true;
  updateCounts();
  setStatus("Input and output cleared.", pyodide ? "ready" : "normal");
});
document.querySelector("#copy-input-button").addEventListener("click", () => copyText(input.value));
document.querySelector("#copy-output-button").addEventListener("click", () => copyText(output.value));
document.querySelector("#paste-button").addEventListener("click", async () => {
  try {
    input.value = await navigator.clipboard.readText();
    updateCounts();
    setStatus("Pasted from clipboard.", "ready");
  } catch {
    setStatus("Clipboard reading is unavailable. Use Ctrl+V in the input box.", "error");
    input.focus();
  }
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  try {
    input.value = await file.text();
    updateCounts();
    setStatus(`Loaded ${file.name}.`, pyodide ? "ready" : "normal");
  } catch (error) {
    setStatus(`Could not read file: ${error.message}`, "error");
  }
});

setMode("encode");
initializePython();
