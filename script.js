// Cần import strings từ lang.js trước
// Note: 'strings' object is assumed to be globally available from lang.js

// --- Global DOM Element Selectors ---
// Language Selector
const langSel = document.getElementById('langsel');

// Audio Controls
const modeEl = document.getElementById('mode');
const waveformEl = document.getElementById('waveform');
const freqEl = document.getElementById('freq');
const ampEl = document.getElementById('amp');
const durationEl = document.getElementById('duration');
const srEl = document.getElementById('samplerate'); // Sample Rate
const channelsEl = document.getElementById('channels');
const bitdepthEl = document.getElementById('bitdepth');
const normalizeEl = document.getElementById('normalize');

// Frequency-specific elements
const freqSliderEl = document.getElementById('freq_slider');
const freqDisplayEl = document.getElementById('freq_display');

// Control blocks
const singleCtrlEl = document.getElementById('singleCtrl');
const singlePresetEl = document.getElementById('singlePreset');
const multiCtrlEl = document.getElementById('multiCtrl');
const sweepCtrlEl = document.getElementById('sweepCtrl');

// Buttons
const playBtn = document.getElementById('play');
const stopBtn = document.getElementById('stop');
const downloadBtn = document.getElementById('download');

// --- Global Audio State Variables ---
let audioContext = null;
let currentOscillator = null; // Can be a single Osc, an array of Ocs, or a BufferSource (noise)
let gainNode = null;
let isPlaying = false;

// --- Helper Functions ---

/**
 * Updates a single element's text and tooltip based on language settings.
 * @param {string} id - The element's ID.
 * @param {object} s - The current language strings object.
 * @param {string} textKey - The key for the element's text content.
 * @param {string} tooltipKey - The key for the element's tooltip text.
 */
function updateElementText(id, s, textKey, tooltipKey) {
  const el = document.getElementById(id);
  if (el) {
    // For elements with a text node *and* a child element (e.g., icons, inputs)
    // The original script targets childNodes[0] to leave space/icons intact
    if (el.childNodes.length > 0 && el.id.includes('_label') || el.id === 'play' || el.id === 'stop' || el.id === 'download') {
      el.childNodes[0].textContent = s[textKey] + ' ';
    } else {
      // For simple text elements (title, description, static labels)
      el.innerText = s[textKey];
    }
    
    // Update tooltip if element exists and a tooltip key is provided
    if (tooltipKey) {
      const tooltipEl = document.getElementById(tooltipKey);
      if (tooltipEl) {
        tooltipEl.innerText = s[tooltipKey];
      }
    }
  }
}

/**
 * Updates frequency display text.
 * @param {number|string} value - The current frequency value.
 */
function updateFreqDisplay(value) {
  freqDisplayEl.innerText = Math.round(parseFloat(value) * 10) / 10 + ' Hz';
}


/**
 * Updates the title attribute (tooltip) for all options in a select element.
 * @param {string} selector - CSS selector for the options (e.g., '#waveform option').
 * @param {string} lang - The current language ('vi' or other, which defaults to 'en').
 */
function updateOptionTooltips(selector, lang) {
  const opts = document.querySelectorAll(selector);
  opts.forEach(opt => {
    const viTooltip = opt.getAttribute('data-tooltip-vi') || '';
    const enTooltip = opt.getAttribute('data-tooltip-en') || '';
    opt.title = (lang === 'vi') ? viTooltip : enTooltip;
  });
}


// --- Main Functions ---

/**
 * Sets the language for all text content on the page.
 * @param {string} lang - The language code (e.g., 'vi', 'en').
 */
function setLang(lang) {
  const s = strings[lang];
  if (!s) return;

  // 1. Update Main UI Texts (Title, Desc, Footer, Lang Label)
  document.getElementById('title').innerText = s.title;
  document.getElementById('desc').innerText = s.desc;
  document.getElementById('footer').innerText = s.footer;
  document.getElementById('langlabel').innerText = s.langlabel;
  
  // 2. Update Control Labels and Tooltips
  const controls = [
    { id: 'mode_label', text: 'mode_label', tooltip: 'mode_tooltip' },
    { id: 'waveform_label', text: 'waveform_label', tooltip: 'waveform_tooltip' },
    { id: 'freq_label', text: 'freq_label', tooltip: 'freq_tooltip' },
    { id: 'amp_label', text: 'amp_label', tooltip: 'amp_tooltip' },
    { id: 'dur_label', text: 'dur_label', tooltip: 'dur_tooltip' },
    { id: 'sr_label', text: 'sr_label', tooltip: 'sr_tooltip' },
    { id: 'channels_label', text: 'channels_label', tooltip: 'channels_tooltip' },
    { id: 'bitdepth_label', text: 'bitdepth_label', tooltip: 'bitdepth_tooltip' },
    { id: 'norm_label', text: 'norm_label', tooltip: 'norm_tooltip' },
    { id: 'play', text: 'play', tooltip: 'play_tooltip' },
    { id: 'stop', text: 'stop', tooltip: 'stop_tooltip' },
    { id: 'download', text: 'download', tooltip: 'download_tooltip' }
  ];

  controls.forEach(c => updateElementText(c.id, s, c.text, c.tooltip));

  // 3. Update Preset Labels and Tooltips
  document.getElementById('preset_title').innerText = s.preset_title;
  ['bass', 'mid', 'treble', 'special'].forEach(label => {
    const el = document.getElementById(`${label}_label`);
    if (el) el.innerText = s[`${label}_label`];
  });
  
  const presets = ['20', '35', '40', '60', '80', '100', '125', '250', '315', '500', '630', '1000', '1250', '2000', '2500', '4000', '5000', '8000', '10000', '12500', '16000', 'pinknoise', 'whitenoise'];
  
  presets.forEach(p => {
    const tooltipKey = `preset${p.includes('noise') ? '_' : ''}${p}_tooltip`;
    const elId = `preset${p.includes('noise') ? '_' : ''}${p}_tooltip`;
    const el = document.getElementById(elId);
    if (el && s[tooltipKey]) el.innerText = s[tooltipKey];
  });
  
  // 4. Update Select Option Tooltips (Waveform, Samplerate, Bitdepth)
  updateOptionTooltips('#waveform option', lang);
  updateOptionTooltips('#samplerate option', lang);
  updateOptionTooltips('#bitdepth option', lang);
}


/**
 * Handles the logic for playing audio based on the current mode and settings.
 */
function playAudio() {
  if (isPlaying) return;
  
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.error("Web Audio API is not supported in this browser.", e);
    alert("Web Audio API is required for this feature. Please use a modern browser.");
    return;
  }

  const mode = modeEl.value;
  const waveform = waveformEl.value;
  const amplitude = parseFloat(ampEl.value);

  // Setup gain node
  gainNode = audioContext.createGain();
  gainNode.connect(audioContext.destination);

  if (mode === 'single') {
    const frequency = parseFloat(freqEl.value);
    
    if (waveform === 'noise') {
      // Generate White Noise Buffer
      const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * amplitude;
      }
      currentOscillator = audioContext.createBufferSource();
      currentOscillator.buffer = buffer;
      currentOscillator.loop = true;
      currentOscillator.connect(gainNode);
      currentOscillator.start();
      
    } else {
      // Tone (Sine, Square, Triangle, Sawtooth)
      currentOscillator = audioContext.createOscillator();
      currentOscillator.type = waveform;
      currentOscillator.frequency.value = frequency;
      gainNode.gain.value = amplitude;
      currentOscillator.connect(gainNode);
      currentOscillator.start();
    }
    
  } else if (mode === 'multiple') {
    const freqInput = document.getElementById('multiFreq').value;
    const freqs = freqInput.split(',').map(x => parseFloat(x.trim())).filter(x => x > 0);
    
    if (!freqs.length) { alert('Enter valid frequencies for Multiple mode'); return; }
    
    // Distribute amplitude across multiple tones to prevent clipping
    const individualAmplitude = amplitude / Math.sqrt(freqs.length); 
    gainNode.gain.value = individualAmplitude; 
    
    currentOscillator = []; // Store multiple oscillators
    freqs.forEach(f => {
      const osc = audioContext.createOscillator();
      // Use sine wave for multiple mode if noise is selected, as standard noise is not combinable like tones
      osc.type = (waveform === 'noise') ? 'sine' : waveform; 
      osc.frequency.value = f;
      osc.connect(gainNode);
      osc.start();
      currentOscillator.push(osc);
    });
    
  } else if (mode === 'sweep') {
    const startFreq = parseFloat(document.getElementById('sweepStart').value);
    const endFreq = parseFloat(document.getElementById('sweepEnd').value);
    const sweepType = document.getElementById('sweepType').value;
    const duration = parseFloat(durationEl.value);
    
    currentOscillator = audioContext.createOscillator();
    currentOscillator.type = (waveform === 'noise') ? 'sine' : waveform;
    gainNode.gain.value = amplitude;
    
    // Apply sweep
    if (sweepType === 'log') {
      currentOscillator.frequency.setValueAtTime(startFreq, audioContext.currentTime);
      currentOscillator.frequency.exponentialRampToValueAtTime(endFreq, audioContext.currentTime + duration);
    } else { // Linear
      currentOscillator.frequency.setValueAtTime(startFreq, audioContext.currentTime);
      currentOscillator.frequency.linearRampToValueAtTime(endFreq, audioContext.currentTime + duration);
    }
    
    currentOscillator.connect(gainNode);
    currentOscillator.start();
    currentOscillator.stop(audioContext.currentTime + duration);
  }
  
  isPlaying = true;
}

/**
 * Stops any playing audio and cleans up resources.
 */
function stopAudio() {
  if (!isPlaying) return;
  
  try {
    if (Array.isArray(currentOscillator)) {
      currentOscillator.forEach(o => { 
        try { o.stop(); o.disconnect(); } catch (e) { } 
      }); 
    } else if (currentOscillator) { 
      try { currentOscillator.stop(); currentOscillator.disconnect(); } catch (e) { } 
    }
    if (gainNode) { 
      try { gainNode.disconnect(); } catch (e) { } 
    }
    if (audioContext) { 
      try { audioContext.close(); } catch (e) { } 
    }
  } catch (e) { 
    console.error("Error stopping audio:", e);
  }
  
  currentOscillator = null; 
  gainNode = null; 
  audioContext = null; 
  isPlaying = false;
}

/**
 * Utility to convert raw Float32Array audio buffers into a downloadable WAV Blob.
 * This is left mostly as-is due to the complexity of the WAV format header creation.
 * It's a standard implementation for WAV file generation.
 * * @param {Float32Array[]} buffers - Array of Float32Arrays for each channel.
 * @param {number} sampleRate - Sample rate (e.g., 44100).
 * @param {number} channels - Number of channels (1 for mono, 2 for stereo).
 * @param {number} bitDepth - Bit depth (e.g., 16, 24, 32).
 * @param {boolean} normalize - Whether to normalize the signal before saving.
 * @returns {Blob} The WAV audio file blob.
 */
function toWav(buffers, sampleRate, channels, bitDepth, normalize) {
  // Original function logic remains...
  const len = buffers[0].length;
  const samples = new Float32Array(len * channels);
  for (let c = 0; c < channels; c++) {
    const data = buffers[c];
    for (let i = 0; i < len; i++)samples[i * channels + c] = data[i];
  }
  if (normalize) {
    let max = 0;
    for (let i = 0; i < samples.length; i++) {
      const a = Math.abs(samples[i]);
      if (a > max) max = a;
    }
    if (max > 0) {
      const n = 1 / max;
      for (let i = 0; i < samples.length; i++)samples[i] *= n;
    }
  }
  const bps = bitDepth / 8;
  const ba = channels * bps;
  const br = sampleRate * ba;
  const ds = samples.length * bps;
  const buf = new ArrayBuffer(44 + ds);
  const v = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++)v.setUint8(o + i, s.charCodeAt(i)) };
  ws(0, 'RIFF');
  v.setUint32(4, 36 + ds, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, br, true);
  v.setUint16(32, ba, true);
  v.setUint16(34, bitDepth, true);
  ws(36, 'data');
  v.setUint32(40, ds, true);
  let o = 44;
  if (bitDepth === 16) {
    for (let i = 0; i < samples.length; i++, o += 2) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  } else if (bitDepth === 24) {
    for (let i = 0; i < samples.length; i++, o += 3) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      let val = Math.round(s < 0 ? s * 0x800000 : s * 0x7FFFFF);
      v.setUint8(o, val & 0xFF);
      v.setUint8(o + 1, (val >> 8) & 0xFF);
      v.setUint8(o + 2, (val >> 16) & 0xFF);
    }
  } else if (bitDepth === 32) {
    for (let i = 0; i < samples.length; i++, o += 4) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt32(o, s < 0 ? s * 0x80000000 : s * 0x7FFFFFFF, true);
    }
  }
  return new Blob([v], { type: 'audio/wav' });
}

/**
 * Utility to trigger the download of a Blob.
 * @param {Blob} blob - The file content.
 * @param {string} name - The filename.
 */
function downloadFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Handles the logic for generating and downloading the WAV file.
 */
async function downloadAudio() {
  const mode = modeEl.value;
  const waveform = waveformEl.value;
  const amplitude = parseFloat(ampEl.value);
  const duration = parseFloat(durationEl.value);
  const sampleRate = parseInt(srEl.value);
  const channels = parseInt(channelsEl.value);
  const bitDepth = parseInt(bitdepthEl.value);
  const doNormalize = normalizeEl.value === '1';

  const totalSamples = Math.floor(sampleRate * duration);
  const buffers = [];
  for (let c = 0; c < channels; c++) buffers.push(new Float32Array(totalSamples));
  
  // Audio Generation Logic
  if (mode === 'single') {
    const frequency = parseFloat(freqEl.value);
    for (let i = 0; i < totalSamples; i++) {
      const time = i / sampleRate;
      let value = 0;
      
      if (waveform === 'noise') {
        value = (Math.random() * 2 - 1) * amplitude;
      } else {
        const p = 2 * Math.PI * frequency * time;
        if (waveform === 'sine') value = Math.sin(p) * amplitude;
        else if (waveform === 'square') value = (Math.sin(p) >= 0 ? 1 : -1) * amplitude;
        else if (waveform === 'triangle') value = (2 / Math.PI) * Math.asin(Math.sin(p)) * amplitude;
        else if (waveform === 'sawtooth') value = (2 / Math.PI) * (frequency * Math.PI * (time % (1 / frequency)) - (Math.PI / 2)) * amplitude;
      }
      for (let c = 0; c < channels; c++) buffers[c][i] = value;
    }
  } else if (mode === 'multiple') {
    const freqInput = document.getElementById('multiFreq').value;
    const freqs = freqInput.split(',').map(x => parseFloat(x.trim())).filter(x => x > 0);
    if (!freqs.length) { alert('Enter valid frequencies'); return; }
    
    const individualAmplitude = amplitude / Math.sqrt(freqs.length);
    for (let i = 0; i < totalSamples; i++) {
      const time = i / sampleRate;
      let value = 0;
      freqs.forEach(f => {
        const p = 2 * Math.PI * f * time;
        // Use individualAmplitude here
        if (waveform === 'sine') value += Math.sin(p) * individualAmplitude;
        else if (waveform === 'square') value += (Math.sin(p) >= 0 ? 1 : -1) * individualAmplitude;
        else if (waveform === 'triangle') value += (2 / Math.PI) * Math.asin(Math.sin(p)) * individualAmplitude;
        else if (waveform === 'sawtooth') value += (2 / Math.PI) * (f * Math.PI * (time % (1 / f)) - (Math.PI / 2)) * individualAmplitude;
      });
      for (let c = 0; c < channels; c++) buffers[c][i] = value;
    }
  } else if (mode === 'sweep') {
    const startFreq = parseFloat(document.getElementById('sweepStart').value);
    const endFreq = parseFloat(document.getElementById('sweepEnd').value);
    const sweepType = document.getElementById('sweepType').value;
    let phase = 0;
    
    for (let i = 0; i < totalSamples; i++) {
      const time = i / sampleRate;
      const progress = time / duration;
      const freq = sweepType === 'log' ? startFreq * Math.pow(endFreq / startFreq, progress) : startFreq + (endFreq - startFreq) * progress;
      
      // Phase accumulation for smooth sweep generation
      phase += 2 * Math.PI * freq / sampleRate;
      phase = phase % (2 * Math.PI); // Keep phase within bounds
      
      let value = 0;
      // Note: Phase-based generation uses a different calculation for non-sine waves
      if (waveform === 'sine') value = Math.sin(phase) * amplitude;
      else if (waveform === 'square') value = (Math.sin(phase) >= 0 ? 1 : -1) * amplitude;
      else if (waveform === 'triangle') value = (2 / Math.PI) * Math.asin(Math.sin(phase)) * amplitude;
      // Adjusted sawtooth calculation based on phase, though the original was simpler (not phase-accumulating)
      else if (waveform === 'sawtooth') value = (2 / Math.PI) * (phase - Math.PI) * amplitude; 
      
      for (let c = 0; c < channels; c++) buffers[c][i] = value;
    }
  }

  // Convert buffers to WAV blob and trigger download
  const blob = toWav(buffers, sampleRate, channels, bitDepth, doNormalize);
  let name = 'tone';
  if (mode === 'single') name = `tone-${waveform}-${freqEl.value}Hz`;
  else if (mode === 'multiple') name = `multi-tone-${waveform}`;
  else name = `sweep-${document.getElementById('sweepStart').value}-${document.getElementById('sweepEnd').value}Hz-${sweepType}`;
  
  downloadFile(blob, `${name}-${bitDepth}bit.wav`);
}


/**
 * Sets the UI controls to a specific preset frequency.
 * @param {number} freq - The target frequency.
 */
function setPreset(freq) {
  modeEl.value = 'single';
  modeEl.dispatchEvent(new Event('change')); // Trigger mode change UI update
  waveformEl.value = 'sine';
  freqEl.value = freq;
  freqSliderEl.value = freq;
  updateFreqDisplay(freq);
  // Set amplitude based on frequency (lower for bass, general for others)
  ampEl.value = freq < 100 ? 0.9 : 0.7; 
  durationEl.value = 10;
  srEl.value = 48000;
  channelsEl.value = 1;
}

/**
 * Sets the UI controls to a noise (pink/white) preset.
 */
function setNoisePreset() {
  modeEl.value = 'single';
  modeEl.dispatchEvent(new Event('change'));
  waveformEl.value = 'noise';
  ampEl.value = 0.7;
  durationEl.value = 30;
  srEl.value = 48000;
  channelsEl.value = 2; // Noise is often used in stereo
}

/**
 * Sets the UI controls to a sweep tone preset.
 */
function setSweepPreset() {
  modeEl.value = 'sweep';
  modeEl.dispatchEvent(new Event('change'));
  waveformEl.value = 'sine';
  document.getElementById('sweepStart').value = 20;
  document.getElementById('sweepEnd').value = 20000;
  document.getElementById('sweepType').value = 'log';
  ampEl.value = 0.7;
  durationEl.value = 30;
}

/**
 * Sets the UI controls to a multiple tone preset.
 */
function setMultiPreset() {
  modeEl.value = 'multiple';
  modeEl.dispatchEvent(new Event('change'));
  waveformEl.value = 'sine';
  document.getElementById('multiFreq').value = '100, 250, 500, 1000';
  ampEl.value = 0.7;
  durationEl.value = 10;
}


// --- Event Listeners ---

// Language Selector
langSel.addEventListener('change', () => { 
  setLang(langSel.value); 
});

// Initial language setup
setLang(langSel.value);


// Frequency Input/Slider Sync
[freqEl, freqSliderEl].forEach(el => {
  el.addEventListener('input', () => {
    const value = el.value;
    freqEl.value = value;
    freqSliderEl.value = value;
    updateFreqDisplay(value);
  });
});

// Mode Change Logic
modeEl.addEventListener('change', () => {
  const mode = modeEl.value;
  singleCtrlEl.style.display = mode === 'single' ? 'block' : 'none';
  singlePresetEl.style.display = mode === 'single' ? 'block' : 'none';
  multiCtrlEl.style.display = mode === 'multiple' ? 'block' : 'none';
  sweepCtrlEl.style.display = mode === 'sweep' ? 'block' : 'none';
  
  // Set default duration for sweep mode
  if (mode === 'sweep') durationEl.value = 30;
});


// Play/Stop/Download Buttons
playBtn.addEventListener('click', playAudio);
stopBtn.addEventListener('click', stopAudio);
downloadBtn.addEventListener('click', downloadAudio);


// Preset Button Listeners
const presetConfigs = {
  // [Frequency, Amplitude]
  preset20: [20, 0.9], preset35: [35, 0.9], preset40: [40, 0.9], preset60: [60, 0.8],
  preset80: [80, 0.8], preset100: [100, 0.8], preset125: [125, 0.8], preset250: [250, 0.7],
  preset315: [315, 0.7], preset500: [500, 0.7], preset630: [630, 0.7], preset1000: [1000, 0.7],
  preset1250: [1250, 0.7], preset2000: [2000, 0.6], preset2500: [2500, 0.6], preset4000: [4000, 0.6],
  preset5000: [5000, 0.6], preset8000: [8000, 0.5], preset10000: [10000, 0.5], preset12500: [12500, 0.5],
  preset16000: [16000, 0.5]
};

Object.keys(presetConfigs).forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    const [f, a] = presetConfigs[id];
    setPreset(f); // Use the refactored function
    ampEl.value = a; // Override default amplitude for specific preset config
  });
});

// Noise Presets (using refactored function)
document.getElementById('preset_pinknoise').addEventListener('click', setNoisePreset);
document.getElementById('preset_whitenoise').addEventListener('click', setNoisePreset);
// Assuming there are buttons for Multi/Sweep presets, which weren't in the original presetConfigs
// document.getElementById('preset_multi').addEventListener('click', setMultiPreset);
// document.getElementById('preset_sweep').addEventListener('click', setSweepPreset);