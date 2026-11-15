const activateBtn = document.getElementById("activateBtn");
const statusText = document.getElementById("statusText");
const dataDisplay = document.getElementById("dataDisplay");

let audioCtx = null;
let activeNoiseNode = null;

// Text-to-Speech PA helper
function speak(text, callback) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    if (callback) utterance.onend = callback;
    window.speechSynthesis.speak(utterance);
  } else if (callback) {
    callback();
  }
}

// Single click to unlock browser audio & mic permissions
if (activateBtn) {
  activateBtn.addEventListener("click", () => {
    // Initialize Web Audio Context on user click
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    activateBtn.style.display = "none";
    statusText.textContent = "PA Activated! Listening for your command...";
    speak("Voice assistant activated. Say Kathmandu to hear its weather soundscape.", startListening);
  });
}

// Continuous Voice Recognition
function startListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    statusText.textContent = "Speech recognition not supported in this browser. Please use Google Chrome.";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    statusText.textContent = "🎤 Listening... Say 'Kathmandu'";
  };

  recognition.onresult = async (event) => {
    const spokenText = event.results[0][0].transcript.trim().toLowerCase();
    statusText.textContent = `You said: "${spokenText}"`;

    if (spokenText.includes("kathmandu") || spokenText.includes("weather") || spokenText.includes("sound")) {
      speak("Fetching live NASA climate data for Kathmandu.");
      await fetchAndSonifyKathmandu();
    } else {
      speak("Please say Kathmandu to test the weather soundscape.", startListening);
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    statusText.textContent = "Didn't catch that. Listening again...";
    setTimeout(startListening, 1500);
  };

  try {
    recognition.start();
  } catch (e) {
    console.log("Recognition already active");
  }
}

// Fetch NASA Data & Display Proof of Access
async function fetchAndSonifyKathmandu() {
  statusText.textContent = "Connecting to NASA POWER API...";
  dataDisplay.textContent = "Requesting data from power.larc.nasa.gov...";

  try {
    const response = await fetch("/api/nasa-weather");
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    const rainRate = data.rainfall; // Precipitation in mm/day
    
    // Prove access by displaying the raw metrics on screen
    statusText.textContent = "NASA Data Loaded! Playing soundscape...";
    dataDisplay.innerHTML = `✅ <strong>Connected to NASA API</strong><br>` +
                            `Location: Kathmandu<br>` +
                            `Precipitation: <strong>${rainRate.toFixed(2)} mm/day</strong><br>` +
                            `Date: ${data.date}`;

    speak(`Data successfully loaded from NASA. Current rainfall is ${rainRate.toFixed(1)} millimeters per day. Playing soundscape now.`);

    // Trigger Audio Sonification
    playNASAWeatherAudio(rainRate);

  } catch (err) {
    console.error("Error:", err);
    statusText.textContent = "Failed to connect to NASA data stream.";
    dataDisplay.textContent = "❌ Error: Could not reach backend or NASA server.";
    speak("Failed to retrieve NASA data. Trying again.", () => {
      setTimeout(startListening, 2000);
    });
  }
}

// Web Audio Rain Synthesizer
function playNASAWeatherAudio(rainMm) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  if (activeNoiseNode) {
    try { activeNoiseNode.stop(); } catch(e){}
  }

  // Generate white noise buffer
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  activeNoiseNode = audioCtx.createBufferSource();
  activeNoiseNode.buffer = buffer;
  activeNoiseNode.loop = true;

  // Bandpass filter mapping rainfall rate to frequency
  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = Math.max(300, Math.min(rainMm * 250 + 300, 4500));
  filter.Q.value = 2.5;

  const gainNode = audioCtx.createGain();
  gainNode.gain.value = Math.min(Math.max(rainMm / 25, 0.2), 1.0);

  // Connect graph: Noise -> Filter -> Gain -> Speakers
  activeNoiseNode.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  activeNoiseNode.start();
}