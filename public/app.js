const talkButton = document.getElementById("talkButton");
const statusMessage = document.getElementById("statusMessage");
const paMessage = document.getElementById("paMessage");

const LANGUAGE = "en-US";
const REQUEST_TIMEOUT_MS = 30000;
// Earlier messages kept so the PA can follow up on what was already said.
const MAX_HISTORY_MESSAGES = 20;

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

const synth = window.speechSynthesis || null;

const RECOGNITION_ERRORS = {
    "no-speech": "I didn't hear anything. Click “Talk with me” and try again.",
    "audio-capture": "No microphone was found. Please check that one is connected.",
    "not-allowed": "Microphone access was blocked. Please allow it in your browser settings.",
    "service-not-allowed": "Speech recognition is blocked in this browser.",
    "network": "Speech recognition needs an internet connection.",
    "aborted": "Listening was stopped."
};

const history = [];

let recognition = null;
// "idle" | "listening" | "thinking"
let state = "idle";
// What ended the current listening session: null, "result", or "error".
let recognitionOutcome = null;


function setState(nextState, status) {

    state = nextState;
    talkButton.disabled = nextState !== "idle";

    if (status !== undefined) {
        statusMessage.textContent = status;
    }
}


function speak(text) {

    if (!synth || !text) {
        return;
    }

    synth.cancel();

    // Chrome cuts off long utterances, so speak one sentence at a time.
    const sentences =
        text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [text];

    for (const sentence of sentences) {

        const trimmed = sentence.trim();

        if (!trimmed) {
            continue;
        }

        const utterance = new SpeechSynthesisUtterance(trimmed);
        utterance.lang = LANGUAGE;

        synth.speak(utterance);
    }
}


async function askPA(question) {

    setState("thinking", `You said: “${question}” — thinking…`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {

        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: question, history }),
            signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.reply) {
            throw new Error(data.error || "The PA could not respond. Please try again.");
        }

        history.push(
            { role: "user", text: question },
            { role: "model", text: data.reply }
        );
        history.splice(0, Math.max(0, history.length - MAX_HISTORY_MESSAGES));

        paMessage.textContent = data.reply;
        statusMessage.textContent = `You said: “${question}”`;

        speak(data.reply);

    } catch (error) {

        console.error("CHAT ERROR:", error);

        let message = error.message;

        if (error.name === "AbortError") {
            message = "The PA took too long to answer. Please try again.";
        } else if (error instanceof TypeError) {
            message = "I can't reach the Jukebox server. Please check that it's running.";
        }

        statusMessage.textContent = message;
        speak(message);

    } finally {

        clearTimeout(timer);
        setState("idle");
    }
}


if (!SpeechRecognition) {

    talkButton.disabled = true;
    statusMessage.textContent =
        "Speech recognition is not available in this browser. Please try Chrome or Edge.";

} else {

    recognition = new SpeechRecognition();

    recognition.lang = LANGUAGE;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;


    recognition.onstart = () => {

        recognitionOutcome = null;
        setState("listening", "🎙 Listening…");
    };


    recognition.onresult = (event) => {

        const text = event.results[0][0].transcript.trim();

        if (!text) {
            return;
        }

        recognitionOutcome = "result";
        askPA(text);
    };


    recognition.onerror = (event) => {

        console.error("RECOGNITION ERROR:", event.error);

        recognitionOutcome = "error";
        statusMessage.textContent =
            RECOGNITION_ERRORS[event.error] || `Speech error: ${event.error}`;
    };


    recognition.onend = () => {

        // A result moves us on to "thinking"; anything else returns to idle.
        if (state !== "listening") {
            return;
        }

        setState("idle");

        if (!recognitionOutcome) {
            statusMessage.textContent = "I didn't catch that. Please try again.";
        }
    };
}


talkButton.addEventListener("click", () => {

    if (!recognition || state !== "idle") {
        return;
    }

    // Let the user interrupt the PA, and keep its voice out of the microphone.
    if (synth) {
        synth.cancel();
    }

    setState("listening", "Starting speech recognition…");

    try {

        recognition.start();

    } catch (error) {

        console.error("START ERROR:", error);

        setState("idle", `Couldn't start the microphone: ${error.name}`);
    }
});
