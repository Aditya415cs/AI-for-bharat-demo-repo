import { Platform } from 'react-native';

export type WebFaceStatus = 'scanning' | 'verified' | 'no_face' | 'multiple_faces' | 'unsupported' | 'error';

interface WebFaceProctorOptions {
  intervalMs?: number;
  onStatus: (status: WebFaceStatus, faceCount: number) => void;
}

export class WebFaceProctor {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private detecting = false;
  private modelsLoaded = false;
  private readonly intervalMs: number;
  private readonly onStatus: (status: WebFaceStatus, faceCount: number) => void;

  constructor(options: WebFaceProctorOptions) {
    this.intervalMs = options.intervalMs ?? 1200;
    this.onStatus = options.onStatus;
  }

  async start() {
    if (this.running) return;

    if (Platform.OS !== 'web' || typeof document === 'undefined' || !navigator?.mediaDevices) {
      this.onStatus('unsupported', 0);
      return;
    }

    this.running = true;
    this.onStatus('scanning', 0);

    try {
      const faceapi = await import('face-api.js');
      if (!this.modelsLoaded) {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        this.modelsLoaded = true;
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      this.video = document.createElement('video');
      this.video.autoplay = true;
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.srcObject = this.stream;
      this.video.style.display = 'none';
      document.body.appendChild(this.video);
      await this.video.play();

      this.scheduleNext(500);
    } catch (error) {
      console.warn('[WebFaceProctor] Failed to start:', error);
      await this.stop();
      this.onStatus('error', 0);
    }
  }

  async stop() {
    this.running = false;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video.remove();
      this.video = null;
    }

    this.detecting = false;
  }

  private scheduleNext(delay = this.intervalMs) {
    if (!this.running) return;
    this.timeoutId = setTimeout(() => {
      void this.detect();
    }, delay);
  }

  private async detect() {
    if (!this.running || this.detecting || !this.video) {
      this.scheduleNext();
      return;
    }

    if (this.video.readyState < 2 || this.video.videoWidth === 0 || this.video.videoHeight === 0) {
      this.scheduleNext(500);
      return;
    }

    this.detecting = true;
    try {
      const faceapi = await import('face-api.js');
      const detections = await faceapi.detectAllFaces(
        this.video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.45,
        })
      );

      const faceCount = detections.length;
      if (faceCount === 0) {
        this.onStatus('no_face', 0);
      } else if (faceCount > 1) {
        this.onStatus('multiple_faces', faceCount);
      } else {
        this.onStatus('verified', 1);
      }
    } catch (error) {
      console.warn('[WebFaceProctor] Detection failed:', error);
      this.onStatus('error', 0);
    } finally {
      this.detecting = false;
      this.scheduleNext();
    }
  }
}
