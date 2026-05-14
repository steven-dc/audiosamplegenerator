// Cần import strings từ lang.js trước
// Note: 'strings' object is assumed to be globally available from lang.js

// --- Global DOM Element Selectors ---
const langSel = document.getElementById('langsel');

const modeEl = document.getElementById('mode');
const waveformEl = document.getElementById('waveform');
const freqEl = document.getElementById('freq');
const ampEl = document.getElementById('amp');
const durationEl = document.getElementById('duration');
const srEl = document.getElementById('samplerate');
const channelsEl = document.getElementById('channels');
const bitdepthEl = document.getElementById('bitdepth');
const normalizeEl = document.getElementById('normalize');

const freqSliderEl = document.getElementById('freq_slider');
const freqDisplayEl = document.getElementById('freq_display');

const singleCtrlEl = document.getElementById('singleCtrl');
const singlePresetEl = document.getElementById('singlePreset');
const multiCtrlEl = document.getElementById('multiCtrl');
const sweepCtrlEl = document.getElementById('sweepCtrl');

const playBtn = document.getElementById('play');
const stopBtn = document.getElementById('stop');
const downloadBtn = document.getElementById('download');

// --- Global Audio State Variables ---
let audioContext = null;
let currentOscillator = null;
let gainNode = null;
let isPlaying = false;

// --- Helper Functions ---

function updateElementText(id, s, textKey, tooltipKey) {
  const el = document.getElementById(id);
  if (el) {
    if (el.childNodes.length > 0 && el.id.includes('_label') || el.id === 'play' || el.id === 'stop' || el.id === 'download') {
      el.childNodes[0].textContent = s[textKey] + ' ';
    } else {
      el.innerText = s[textKey];
    }
    if (tooltipKey) {
      const tooltipEl = document.getElementById(tooltipKey);
      if (tooltipEl) tooltipEl.innerText = s[tooltipKey];
    }
  }
}

function updateFreqDisplay(value) {
  freqDisplayEl.innerText = Math.round(parseFloat(value) * 10) / 10 + ' Hz';
}

function updateOptionTooltips(selector, lang) {
  const opts = document.querySelectorAll(selector);
  opts.forEach(opt => {
    const viTooltip = opt.getAttribute('data-tooltip-vi') || '';
    const enTooltip = opt.getAttribute('data-tooltip-en') || '';
    opt.title = (lang === 'vi') ? viTooltip : enTooltip;
  });
}

// --- Waveform Sample Generator ---
// FIX #1: Tách riêng hàm sinh mẫu sóng để dùng chung,
// và sửa công thức sawtooth đúng chuẩn dựa trên phase.

/**
 * Sinh một mẫu tín hiệu tại phase cho trước.
 * @param {string} waveform - Loại sóng: 'sine', 'square', 'triangle', 'sawtooth'.
 * @param {number} phase - Góc pha hiện tại (radian, không giới hạn phạm vi).
 * @param {number} amplitude - Biên độ [0..1].
 * @returns {number} Giá trị mẫu.
 */
function getSample(waveform, phase, amplitude) {
  // Chuẩn hoá phase về [0, 2π) để tính toán nhất quán
  const p = ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  switch (waveform) {
    case 'sine':
      return Math.sin(p) * amplitude;
    case 'square':
      return (p < Math.PI ? 1 : -1) * amplitude;
    case 'triangle':
      // Tăng từ -1 đến +1 trong nửa đầu, giảm ngược lại
      return (p < Math.PI
        ? -1 + (2 / Math.PI) * p
        : 3 - (2 / Math.PI) * p) * amplitude;
    case 'sawtooth':
      // FIX #1 (CORE): Công thức cũ bị sai biên độ và offset.
      // Sawtooth chuẩn: tăng tuyến tính từ -1 đến +1 trong một chu kỳ.
      return (-1 + p / Math.PI) * amplitude;
    default:
      return 0;
  }
}

// --- Pink Noise Generator ---
// FIX #2: Implement pink noise thực sự (xấp xỉ Voss-McCartney, lọc 1/f).

/**
 * Sinh một buffer pink noise bằng bộ lọc Voss-McCartney (xấp xỉ).
 * Phổ công suất giảm ~3 dB/octave, khác với white noise phổ phẳng.
 * @param {number} length - Số mẫu cần sinh.
 * @param {number} amplitude - Biên độ tổng thể.
 * @returns {Float32Array}
 */
function generatePinkNoise(length, amplitude) {
  const buf = new Float32Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    // Bộ lọc IIR 7-band xấp xỉ phổ 1/f
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    buf[i] = Math.max(-1, Math.min(1, pink)) * amplitude;
  }
  return buf;
}

/**
 * Sinh white noise buffer.
 * @param {number} length - Số mẫu.
 * @param {number} amplitude - Biên độ.
 * @returns {Float32Array}
 */
function generateWhiteNoise(length, amplitude) {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) buf[i] = (Math.random() * 2 - 1) * amplitude;
  return buf;
}


// --- Main Functions ---

function setLang(lang) {
  const s = strings[lang];
  if (!s) return;

  document.getElementById('title').innerText = s.title;
  document.getElementById('desc').innerText = s.desc;
  document.getElementById('footer').innerText = s.footer;
  document.getElementById('langlabel').innerText = s.langlabel;

  const controls = [
    { id: 'mode_label',     text: 'mode_label',     tooltip: 'mode_tooltip' },
    { id: 'waveform_label', text: 'waveform_label', tooltip: 'waveform_tooltip' },
    { id: 'freq_label',     text: 'freq_label',     tooltip: 'freq_tooltip' },
    { id: 'amp_label',      text: 'amp_label',      tooltip: 'amp_tooltip' },
    { id: 'dur_label',      text: 'dur_label',      tooltip: 'dur_tooltip' },
    { id: 'sr_label',       text: 'sr_label',       tooltip: 'sr_tooltip' },
    { id: 'channels_label', text: 'channels_label', tooltip: 'channels_tooltip' },
    { id: 'bitdepth_label', text: 'bitdepth_label', tooltip: 'bitdepth_tooltip' },
    { id: 'norm_label',     text: 'norm_label',     tooltip: 'norm_tooltip' },
    { id: 'play',           text: 'play',           tooltip: 'play_tooltip' },
    { id: 'stop',           text: 'stop',           tooltip: 'stop_tooltip' },
    { id: 'download',       text: 'download',       tooltip: 'download_tooltip' }
  ];
  controls.forEach(c => updateElementText(c.id, s, c.text, c.tooltip));

  document.getElementById('preset_title').innerText = s.preset_title;
  ['bass', 'mid', 'treble', 'special'].forEach(label => {
    const el = document.getElementById(`${label}_label`);
    if (el) el.innerText = s[`${label}_label`];
  });

  const presets = ['20','35','40','60','80','100','125','250','315','500','630',
                   '1000','1250','2000','2500','4000','5000','8000','10000','12500','16000',
                   'pinknoise','whitenoise'];
  presets.forEach(p => {
    const elId = `preset${p.includes('noise') ? '_' : ''}${p}_tooltip`;
    const tooltipKey = elId;
    const el = document.getElementById(elId);
    if (el && s[tooltipKey]) el.innerText = s[tooltipKey];
  });

  updateOptionTooltips('#waveform option', lang);
  updateOptionTooltips('#samplerate option', lang);
  updateOptionTooltips('#bitdepth option', lang);
}


function playAudio() {
  if (isPlaying) return;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.error('Web Audio API is not supported in this browser.', e);
    alert('Web Audio API is required for this feature. Please use a modern browser.');
    return;
  }

  const mode = modeEl.value;
  const waveform = waveformEl.value;
  const amplitude = parseFloat(ampEl.value);

  gainNode = audioContext.createGain();
  gainNode.gain.value = 1.0; // FIX #4: Gain node luôn = 1; biên độ đặt trực tiếp ở nguồn
  gainNode.connect(audioContext.destination);

  if (mode === 'single') {
    const frequency = parseFloat(freqEl.value);

    if (waveform === 'noise_pink' || waveform === 'noise_white' || waveform === 'noise') {
      // FIX #2: Phân biệt pink/white noise khi phát
      const isPink = (waveform === 'noise_pink');
      const bufLength = audioContext.sampleRate * 2;
      const buffer = audioContext.createBuffer(1, bufLength, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      const noiseData = isPink
        ? generatePinkNoise(bufLength, amplitude)
        : generateWhiteNoise(bufLength, amplitude);
      data.set(noiseData);

      currentOscillator = audioContext.createBufferSource();
      currentOscillator.buffer = buffer;
      currentOscillator.loop = true;
      currentOscillator.connect(gainNode);
      currentOscillator.start();

    } else {
      currentOscillator = audioContext.createOscillator();
      currentOscillator.type = waveform;
      currentOscillator.frequency.value = frequency;
      // FIX #4: amplitude đặt trên gainNode khi dùng OscillatorNode (không có gain riêng)
      gainNode.gain.value = amplitude;
      currentOscillator.connect(gainNode);
      currentOscillator.start();
    }

  } else if (mode === 'multiple') {
    const freqInput = document.getElementById('multiFreq').value;
    const freqs = freqInput.split(',').map(x => parseFloat(x.trim())).filter(x => x > 0);
    if (!freqs.length) { alert('Enter valid frequencies for Multiple mode'); return; }

    // FIX #4: Mỗi oscillator có GainNode riêng mang đúng biên độ,
    // gainNode chính giữ = 1 để không nhân đôi.
    const individualAmplitude = amplitude / Math.sqrt(freqs.length);
    currentOscillator = [];
    freqs.forEach(f => {
      const osc = audioContext.createOscillator();
      osc.type = (waveform === 'noise' || waveform === 'noise_pink' || waveform === 'noise_white')
        ? 'sine' : waveform;
      osc.frequency.value = f;

      const oscGain = audioContext.createGain();
      oscGain.gain.value = individualAmplitude;
      osc.connect(oscGain);
      oscGain.connect(gainNode);
      osc.start();
      currentOscillator.push({ osc, oscGain });
    });

  } else if (mode === 'sweep') {
    const startFreq = parseFloat(document.getElementById('sweepStart').value);
    const endFreq = parseFloat(document.getElementById('sweepEnd').value);
    const sweepType = document.getElementById('sweepType').value;
    const duration = parseFloat(durationEl.value);

    currentOscillator = audioContext.createOscillator();
    currentOscillator.type = (waveform === 'noise' || waveform === 'noise_pink' || waveform === 'noise_white')
      ? 'sine' : waveform;
    gainNode.gain.value = amplitude;

    if (sweepType === 'log') {
      currentOscillator.frequency.setValueAtTime(startFreq, audioContext.currentTime);
      currentOscillator.frequency.exponentialRampToValueAtTime(endFreq, audioContext.currentTime + duration);
    } else {
      currentOscillator.frequency.setValueAtTime(startFreq, audioContext.currentTime);
      currentOscillator.frequency.linearRampToValueAtTime(endFreq, audioContext.currentTime + duration);
    }

    currentOscillator.connect(gainNode);
    currentOscillator.start();
    currentOscillator.stop(audioContext.currentTime + duration);
  }

  isPlaying = true;
}


function stopAudio() {
  if (!isPlaying) return;

  try {
    if (Array.isArray(currentOscillator)) {
      // FIX #4: cấu trúc mảng giờ là [{osc, oscGain}, ...]
      currentOscillator.forEach(item => {
        const osc = item.osc || item; // tương thích ngược nếu là oscillator đơn giản
        const g   = item.oscGain;
        try { osc.stop(); osc.disconnect(); } catch (e) { }
        if (g) try { g.disconnect(); } catch (e) { }
      });
    } else if (currentOscillator) {
      try { currentOscillator.stop(); currentOscillator.disconnect(); } catch (e) { }
    }
    if (gainNode) try { gainNode.disconnect(); } catch (e) { }
    if (audioContext) try { audioContext.close(); } catch (e) { }
  } catch (e) {
    console.error('Error stopping audio:', e);
  }

  currentOscillator = null;
  gainNode = null;
  audioContext = null;
  isPlaying = false;
}


function toWav(buffers, sampleRate, channels, bitDepth, normalize) {
  const len = buffers[0].length;
  const samples = new Float32Array(len * channels);
  for (let c = 0; c < channels; c++) {
    const data = buffers[c];
    for (let i = 0; i < len; i++) samples[i * channels + c] = data[i];
  }
  if (normalize) {
    let max = 0;
    for (let i = 0; i < samples.length; i++) {
      const a = Math.abs(samples[i]);
      if (a > max) max = a;
    }
    if (max > 0) {
      const n = 1 / max;
      for (let i = 0; i < samples.length; i++) samples[i] *= n;
    }
  }
  const bps = bitDepth / 8;
  const ba = channels * bps;
  const br = sampleRate * ba;
  const ds = samples.length * bps;
  const buf = new ArrayBuffer(44 + ds);
  const v = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
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
      const s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  } else if (bitDepth === 24) {
    for (let i = 0; i < samples.length; i++, o += 3) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      const val = Math.round(s < 0 ? s * 0x800000 : s * 0x7FFFFF);
      v.setUint8(o,     val & 0xFF);
      v.setUint8(o + 1, (val >> 8) & 0xFF);
      v.setUint8(o + 2, (val >> 16) & 0xFF);
    }
  } else if (bitDepth === 32) {
    for (let i = 0; i < samples.length; i++, o += 4) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt32(o, s < 0 ? s * 0x80000000 : s * 0x7FFFFFFF, true);
    }
  }
  return new Blob([v], { type: 'audio/wav' });
}


function downloadFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


async function downloadAudio() {
  const mode      = modeEl.value;
  const waveform  = waveformEl.value;
  const amplitude = parseFloat(ampEl.value);
  const duration  = parseFloat(durationEl.value);
  const sampleRate = parseInt(srEl.value);
  const channels  = parseInt(channelsEl.value);
  const bitDepth  = parseInt(bitdepthEl.value);
  const doNormalize = normalizeEl.value === '1';

  // FIX #3: Đọc sweepType ở phạm vi hàm, không chỉ trong khối sweep,
  // để dùng được khi đặt tên file bên dưới.
  const sweepType = document.getElementById('sweepType')?.value || 'log';

  const totalSamples = Math.floor(sampleRate * duration);
  const buffers = [];
  for (let c = 0; c < channels; c++) buffers.push(new Float32Array(totalSamples));

  if (mode === 'single') {
    const frequency = parseFloat(freqEl.value);

    if (waveform === 'noise_pink' || waveform === 'noise_white' || waveform === 'noise') {
      // FIX #2: Phân biệt pink/white noise khi xuất file
      const isPink = (waveform === 'noise_pink');
      const noiseData = isPink
        ? generatePinkNoise(totalSamples, amplitude)
        : generateWhiteNoise(totalSamples, amplitude);
      for (let c = 0; c < channels; c++) buffers[c].set(noiseData);

    } else {
      // FIX #1: Dùng getSample() với phase-accumulation thay vì công thức time-domain cũ
      let phase = 0;
      const phaseStep = 2 * Math.PI * frequency / sampleRate;
      for (let i = 0; i < totalSamples; i++) {
        const value = getSample(waveform, phase, amplitude);
        for (let c = 0; c < channels; c++) buffers[c][i] = value;
        phase += phaseStep;
        if (phase >= 2 * Math.PI) phase -= 2 * Math.PI;
      }
    }

  } else if (mode === 'multiple') {
    const freqInput = document.getElementById('multiFreq').value;
    const freqs = freqInput.split(',').map(x => parseFloat(x.trim())).filter(x => x > 0);
    if (!freqs.length) { alert('Enter valid frequencies'); return; }

    const individualAmplitude = amplitude / Math.sqrt(freqs.length);
    // FIX #1 + #4: Dùng getSample() với phase-accumulation độc lập cho từng tần số
    const phases = new Float64Array(freqs.length);
    const phaseSteps = freqs.map(f => 2 * Math.PI * f / sampleRate);

    for (let i = 0; i < totalSamples; i++) {
      let value = 0;
      freqs.forEach((f, fi) => {
        value += getSample(waveform === 'noise' || waveform === 'noise_pink' || waveform === 'noise_white'
          ? 'sine' : waveform, phases[fi], individualAmplitude);
        phases[fi] += phaseSteps[fi];
        if (phases[fi] >= 2 * Math.PI) phases[fi] -= 2 * Math.PI;
      });
      for (let c = 0; c < channels; c++) buffers[c][i] = value;
    }

  } else if (mode === 'sweep') {
    const startFreq = parseFloat(document.getElementById('sweepStart').value);
    const endFreq   = parseFloat(document.getElementById('sweepEnd').value);
    // sweepType đã được đọc ở đầu hàm (FIX #3)

    // FIX #1: Dùng getSample() với phase-accumulation
    let phase = 0;
    for (let i = 0; i < totalSamples; i++) {
      const progress = i / totalSamples;
      const freq = sweepType === 'log'
        ? startFreq * Math.pow(endFreq / startFreq, progress)
        : startFreq + (endFreq - startFreq) * progress;

      phase += 2 * Math.PI * freq / sampleRate;
      if (phase >= 2 * Math.PI) phase -= 2 * Math.PI;

      const value = getSample(
        (waveform === 'noise' || waveform === 'noise_pink' || waveform === 'noise_white') ? 'sine' : waveform,
        phase,
        amplitude
      );
      for (let c = 0; c < channels; c++) buffers[c][i] = value;
    }
  }

  const blob = toWav(buffers, sampleRate, channels, bitDepth, doNormalize);

  // FIX #3: sweepType đã có trong scope, không còn lỗi ReferenceError
  let name;
  if (mode === 'single') {
    const noiseLabel = waveform === 'noise_pink' ? 'pinknoise'
                     : waveform === 'noise_white' ? 'whitenoise'
                     : waveform === 'noise'        ? 'noise'
                     : null;
    name = noiseLabel
      ? `tone-${noiseLabel}`
      : `tone-${waveform}-${freqEl.value}Hz`;
  } else if (mode === 'multiple') {
    name = `multi-tone-${waveform}`;
  } else {
    name = `sweep-${document.getElementById('sweepStart').value}-${document.getElementById('sweepEnd').value}Hz-${sweepType}`;
  }

  downloadFile(blob, `${name}-${bitDepth}bit.wav`);
}


function setPreset(freq) {
  modeEl.value = 'single';
  modeEl.dispatchEvent(new Event('change'));
  waveformEl.value = 'sine';
  freqEl.value = freq;
  freqSliderEl.value = freq;
  updateFreqDisplay(freq);
  ampEl.value = freq < 100 ? 0.9 : 0.7;
  durationEl.value = 10;
  srEl.value = 48000;
  channelsEl.value = 1;
}

// FIX #2: Tách hàm preset riêng cho pink noise và white noise
function setPinkNoisePreset() {
  modeEl.value = 'single';
  modeEl.dispatchEvent(new Event('change'));
  waveformEl.value = 'noise_pink'; // cần thêm option này vào <select id="waveform">
  ampEl.value = 0.7;
  durationEl.value = 30;
  srEl.value = 48000;
  channelsEl.value = 2;
}

function setWhiteNoisePreset() {
  modeEl.value = 'single';
  modeEl.dispatchEvent(new Event('change'));
  waveformEl.value = 'noise_white'; // cần thêm option này vào <select id="waveform">
  ampEl.value = 0.7;
  durationEl.value = 30;
  srEl.value = 48000;
  channelsEl.value = 2;
}

function setSweepPreset() {
  modeEl.value = 'sweep';
  modeEl.dispatchEvent(new Event('change'));
  waveformEl.value = 'sine';
  document.getElementById('sweepStart').value = 20;
  document.getElementById('sweepEnd').value   = 20000;
  document.getElementById('sweepType').value  = 'log';
  ampEl.value = 0.7;
  durationEl.value = 30;
}

function setMultiPreset() {
  modeEl.value = 'multiple';
  modeEl.dispatchEvent(new Event('change'));
  waveformEl.value = 'sine';
  document.getElementById('multiFreq').value = '100, 250, 500, 1000';
  ampEl.value = 0.7;
  durationEl.value = 10;
}


// --- Event Listeners ---

langSel.addEventListener('change', () => { setLang(langSel.value); });
setLang(langSel.value);

[freqEl, freqSliderEl].forEach(el => {
  el.addEventListener('input', () => {
    const value = el.value;
    freqEl.value = value;
    freqSliderEl.value = value;
    updateFreqDisplay(value);
  });
});

modeEl.addEventListener('change', () => {
  const mode = modeEl.value;
  singleCtrlEl.style.display  = mode === 'single'   ? 'block' : 'none';
  singlePresetEl.style.display = mode === 'single'   ? 'block' : 'none';
  multiCtrlEl.style.display   = mode === 'multiple' ? 'block' : 'none';
  sweepCtrlEl.style.display   = mode === 'sweep'    ? 'block' : 'none';
  if (mode === 'sweep') durationEl.value = 30;
});

playBtn.addEventListener('click', playAudio);
stopBtn.addEventListener('click', stopAudio);
downloadBtn.addEventListener('click', downloadAudio);

const presetConfigs = {
  preset20:    [20,    0.9], preset35:    [35,    0.9], preset40:    [40,    0.9],
  preset60:    [60,    0.8], preset80:    [80,    0.8], preset100:   [100,   0.8],
  preset125:   [125,   0.8], preset250:   [250,   0.7], preset315:   [315,   0.7],
  preset500:   [500,   0.7], preset630:   [630,   0.7], preset1000:  [1000,  0.7],
  preset1250:  [1250,  0.7], preset2000:  [2000,  0.6], preset2500:  [2500,  0.6],
  preset4000:  [4000,  0.6], preset5000:  [5000,  0.6], preset8000:  [8000,  0.5],
  preset10000: [10000, 0.5], preset12500: [12500, 0.5], preset16000: [16000, 0.5]
};

Object.keys(presetConfigs).forEach(id => {
  document.getElementById(id).addEventListener('click', () => {
    const [f, a] = presetConfigs[id];
    setPreset(f);
    ampEl.value = a;
  });
});

// FIX #2: Gán đúng hàm preset cho từng loại noise
document.getElementById('preset_pinknoise').addEventListener('click', setPinkNoisePreset);
document.getElementById('preset_whitenoise').addEventListener('click', setWhiteNoisePreset);
