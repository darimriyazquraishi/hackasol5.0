import pyaudio
import wave

# Constants
CHUNK = 1024
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 44100
RECORD_SECONDS = 5
OUTPUT_FILENAME = "output.wav"

# Initialize PyAudio
p = pyaudio.PyAudio()

# Open a stream
stream = p.open(format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK)

print("Recording audio...")

frames = []

# Record audio
for i in range(0, int(RATE / CHUNK * RECORD_SECONDS)):
    data = stream.read(CHUNK)
    frames.append(data)

print("Recording complete.")

# Stop the stream and close it
stream.stop_stream()
stream.close()

# Terminate PyAudio
p.terminate()

# Write the recorded audio to a WAV file
wf = wave.open(OUTPUT_FILENAME, 'wb')
wf.setnchannels(CHANNELS)
wf.setsampwidth(p.get_sample_size(FORMAT))
wf.setframerate(RATE)
wf.writeframes(b''.join(frames))
wf.close()

print(f"Audio recorded and saved to {OUTPUT_FILENAME}")