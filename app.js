const talkButton = document.getElementById("talkButton");
const statusMessage = document.getElementById("statusMessage");
const paMessage = document.getElementById("paMessage");

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition = null;
let listening = false;

if (!SpeechRecognition) {

    statusMessage.textContent =
        "Speech recognition is not available in this browser.";

} else {

    recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;


    recognition.onstart = () => {

        listening = true;

        console.log("RECOGNITION STARTED");

        statusMessage.textContent =
            "🎙 Listening…";
    };


    recognition.onaudiostart = () => {

        console.log("AUDIO CAPTURE STARTED");
    };


    recognition.onspeechstart = () => {

        console.log("SPEECH DETECTED");
    };


    recognition.onresult = (event) => {

        const text =
            event.results[0][0].transcript;

        console.log("RESULT:", text);

        statusMessage.textContent =
            `I heard: "${text}"`;

        paMessage.textContent =
            `I heard you say: "${text}"`;
    };


    recognition.onerror = (event) => {

        console.error(
            "RECOGNITION ERROR:",
            event.error
        );

        listening = false;

        statusMessage.textContent =
            `Speech error: ${event.error}`;
    };


    recognition.onend = () => {

        listening = false;

        console.log("RECOGNITION ENDED");
    };
}


talkButton.addEventListener("click", () => {

    if (!recognition) {
        return;
    }

    if (listening) {

        console.log(
            "Already listening — ignoring button press."
        );

        return;
    }

    statusMessage.textContent =
        "Starting speech recognition…";

    try {

        recognition.start();

        console.log(
            "start() called successfully."
        );

    } catch (error) {

        console.error(
            "START ERROR:",
            error
        );

        statusMessage.textContent =
            `Start error: ${error.name}`;
    }
});