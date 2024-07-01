import './index.css';
import { ipcRenderer } from 'electron';
import { writeFile } from 'fs';

let mediaRecorder;
let recordedChunks = [];

// Buttons
const videoElement = document.querySelector('video');

const startBtn = document.getElementById('startBtn');
startBtn.onclick = e => {
  startRecording().catch(err => console.error('Error starting recording:', err));
  startBtn.innerText = 'Recording';
};

const stopBtn = document.getElementById('stopBtn');
stopBtn.onclick = e => {
  if (mediaRecorder) {
    mediaRecorder.stop();
    startBtn.innerText = 'Start';
  } else {
    console.warn('mediaRecorder is not defined.');
  }
};

const selectMenu = document.getElementById('selectMenu');

selectMenu.onchange = displaySelectedSource;
window.onload = async () => {
  await getVideoSources();
  if (selectMenu.options.length > 0) {
    selectMenu.selectedIndex = 0; // Automatically select the first source
    await displaySelectedSource(); // Display the first source
  }

};

async function getVideoSources() {
  const inputSources = await ipcRenderer.invoke('getSources');

  inputSources.forEach(source => {
    const element = document.createElement('option');
    element.value = source.id;
    element.innerHTML = source.name;
    selectMenu.appendChild(element);
  });
}

async function displaySelectedSource() {
  const screenId = selectMenu.options[selectMenu.selectedIndex].value;

  const IS_MACOS = await ipcRenderer.invoke("getOperatingSystem") === 'darwin';
  const audio = !IS_MACOS ? {
    mandatory: {
      chromeMediaSource: 'desktop'
    }
  } : false;

  const constraints = {
    audio,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: screenId,
        maxWidth: 1920,
        maxHeight: 1080
      }
    }
  };

  // Create a Stream
  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  // Preview the source in a video element
  videoElement.srcObject = stream;
  await videoElement.play();
}

async function startRecording() {
  const screenId = selectMenu.options[selectMenu.selectedIndex].value;

  const IS_MACOS = await ipcRenderer.invoke("getOperatingSystem") === 'darwin';
  const audio = !IS_MACOS ? {
    mandatory: {
      chromeMediaSource: 'desktop'
    }
  } : false;

  const constraints = {
    audio,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: screenId,
        maxWidth: 1920,
        maxHeight: 1080
      }
    }
  };

  try {
    // Create a Stream
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Preview the source in a video element
    videoElement.srcObject = stream;
    await videoElement.play();

    const mimeType = 'video/webm; codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      throw new Error(`The format ${mimeType} is not supported by MediaRecorder`);
    }

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = onDataAvailable;
    mediaRecorder.onstop = stopRecording;
    mediaRecorder.start();
  } catch (err) {
    console.error('Error creating MediaRecorder:', err);
    startBtn.innerText = 'Start';
  }
}

function onDataAvailable(e) {
  recordedChunks.push(e.data);
}

async function stopRecording() {
  if (mediaRecorder) {
    videoElement.srcObject = null;

    const mimeType = 'video/webm; codecs=vp9';
    const blob = new Blob(recordedChunks, { type: mimeType });

    const buffer = Buffer.from(await blob.arrayBuffer());
    recordedChunks = [];

    const { canceled, filePath } = await ipcRenderer.invoke('showSaveDialog');
    if (canceled) return;

    if (filePath) {
      writeFile(filePath, buffer, () => console.log('Video saved successfully!'));
    }
  } else {
    console.warn('stopRecording called but mediaRecorder is not defined.');
  }
}
