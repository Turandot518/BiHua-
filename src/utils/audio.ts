/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class DunhuangAudioEngine {
  private ctx: AudioContext | null = null;
  private pentatonicScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00]; // 宫商角徵羽
  private lastPlayTime = 0;

  // Background Generative Music States
  private bgmPlaying = false;
  private bgmTimeout: any = null;
  private droneOscs: { osc: OscillatorNode; gain: GainNode }[] = [];
  private lfoOsc: OscillatorNode | null = null;

  // Spatial Feedback Delay Network
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayFilter: BiquadFilterNode | null = null;

  constructor() {
    // AudioContext will be lazy-initialized on user interaction
  }

  private initContext() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (err) {
        console.warn("AudioContext creation failed completely:", err);
        return;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch((err) => {
        console.warn("AudioContext resume failed or rejected:", err);
      });
    }

    if (!this.ctx) return;

    // Set up the beautiful feedback spatial echo network if not already present
    const now = this.ctx.currentTime;
    if (!this.delayNode) {
      try {
        this.delayNode = this.ctx.createDelay(4.0);
        this.delayFeedback = this.ctx.createGain();
        this.delayFilter = this.ctx.createBiquadFilter();

        // 0.85 seconds delay creates a long, slow, majestic ancient spacing
        this.delayNode.delayTime.setValueAtTime(0.85, now);
        // Feedback is set nicely to 0.45 so sounds cascade into the distance
        this.delayFeedback.gain.setValueAtTime(0.45, now);
        // Soft lowpass filter cuts harsh treble, keeping the echos deep and vintage
        this.delayFilter.type = "lowpass";
        this.delayFilter.frequency.setValueAtTime(750, now);

        // Core feedback connection: delay -> filter -> feedback -> delay
        this.delayNode.connect(this.delayFilter);
        this.delayFilter.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode);

        // Send delay output to master out at a highly ambient, delicate level
        const delayOutputGain = this.ctx.createGain();
        delayOutputGain.gain.setValueAtTime(0.26, now);
        this.delayNode.connect(delayOutputGain);
        delayOutputGain.connect(this.ctx.destination);
      } catch (e) {
        console.warn("Failed to initialize spatial echoes:", e);
      }
    }
  }

  /**
   * Safe entry point to toggle BGM state and trigger browser lazy sound enablement
   */
  public setBGMEnabled(enabled: boolean) {
    this.initContext();
    if (enabled) {
      this.startBGM();
    } else {
      this.stopBGM();
    }
  }

  public isBGMPlaying() {
    return this.bgmPlaying;
  }

  /**
   * Starts a soothing, continuous ancient Dunhuang ambient soundscape
   */
  public startBGM() {
    this.initContext();
    if (!this.ctx || this.bgmPlaying) return;

    this.bgmPlaying = true;
    const now = this.ctx.currentTime;

    try {
      // 1. Create deep drone hum using very soft SINE nodes to prevent buzziness.
      // Ethereal bass anchors: D2 (73.42Hz) and A2 (110.00Hz)
      const frequencies = [73.42, 110.00];
      this.droneOscs = [];

      // Create a master drone fader that lets the hum evolve in a barely audible way
      const masterDroneGain = this.ctx.createGain();
      masterDroneGain.gain.setValueAtTime(0, now);
      // Fades in beautifully over 4 seconds
      masterDroneGain.gain.linearRampToValueAtTime(0.015, now + 4.0);
      masterDroneGain.connect(this.ctx.destination);

      frequencies.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        // 100% pure Sine waves give a silky warm glass drone without aggressive buzz
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(100, now); // strictly limit to sub-bass warm hum

        const baseVolume = idx === 0 ? 0.3 : 0.15;
        gain.gain.setValueAtTime(baseVolume, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterDroneGain);

        osc.start(now);
        this.droneOscs.push({ osc, gain });
      });

      // Ultra-slow breathing LFO (0.05Hz = 20-second swell cycles) to make it feel organic
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.05, now);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.008, now);

      lfo.connect(lfoGain);
      lfoGain.connect(masterDroneGain.gain);
      lfo.start(now);
      this.lfoOsc = lfo;

      // 2. Play beautiful, generative soundscapes at wide, unhurried intervals
      let seqIndex = 0;
      const playMelodyTicker = () => {
        if (!this.bgmPlaying || !this.ctx) return;

        // Pentatonic scale note frequencies
        const bgmScale = [
          146.83, 164.81, 196.00, 220.00, 261.63,
          293.66, 329.63, 392.00, 440.00, 523.25,
          587.33, 659.25, 783.99, 880.00
        ];

        const rollVal = Math.random();

        if (rollVal < 0.45) {
          // Play a beautiful, soft, organic Guzheng-style string pluck with spacey echo
          const freqIndex = Math.floor(Math.random() * bgmScale.length);
          const freq = bgmScale[freqIndex];
          this.triggerPluckNote(freq, 0.035, 1.8);
        } else if (rollVal < 0.70) {
          // Instead of harsh whistles, play an ethereal, calming Tibetan Singing Bowl resonance
          const bowlNotes = [220.00, 261.63, 293.66, 329.63, 440.00];
          const freq = bowlNotes[Math.floor(Math.random() * bowlNotes.length)];
          this.triggerSingingBowl(freq, 0.02, 4.5);
        } else if (rollVal < 0.88) {
          // Play a handful of soft, distant crystal wind chimes moving in the breeze
          this.triggerGentleChimes();
        }

        seqIndex++;
        if (seqIndex % 8 === 0) {
          // A majestic, very faint temple gong/bell in the distance
          this.triggerFaintTempleBell();
        }

        // Spacious delays between events (3.5s to 7s) to ensure a slow, meditative pace
        const nextDelay = 3500 + Math.random() * 3500;
        this.bgmTimeout = setTimeout(playMelodyTicker, nextDelay);
      };

      // Delay start of first sounds slightly to let user settle
      this.bgmTimeout = setTimeout(playMelodyTicker, 2000);

    } catch (err) {
      console.warn("Dunhuang soundscape generator failed:", err);
    }
  }

  public stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimeout) {
      clearTimeout(this.bgmTimeout);
      this.bgmTimeout = null;
    }

    const now = this.ctx ? this.ctx.currentTime : 0;

    // Fade out drone stems beautifully
    this.droneOscs.forEach(({ osc, gain }) => {
      try {
        if (this.ctx && gain) {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
          setTimeout(() => {
            try { osc.stop(); } catch (_) {}
          }, 1400);
        } else {
          osc.stop();
        }
      } catch (_) {}
    });
    this.droneOscs = [];

    if (this.lfoOsc) {
      try { this.lfoOsc.stop(); } catch (_) {}
      this.lfoOsc = null;
    }
  }

  /**
   * Simulates a sweet, lush, spacey Guzheng string pluck utilizing a 2-oscillator chorus
   */
  private triggerPluckNote(freq: number, volume: number, decay: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Create a dual-oscillator chorused pluck for rich acoustic warmth
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Detune slightly for an organic chorus effect (sounds like a real string vibrating)
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(freq - 0.6, now);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq + 0.6, now);

    // Subtle pitch micro-slide on trigger for authentic string-bending feel
    if (Math.random() > 0.5) {
      osc1.frequency.exponentialRampToValueAtTime(freq * 1.04, now + 0.22);
      osc2.frequency.exponentialRampToValueAtTime(freq * 1.04, now + 0.22);
    }

    // Filter to suppress high edge and decay quickly
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + decay);

    // Soft attack, beautiful ring
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + decay);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);

    // Send dry signal to speakers and wet signal directly into the feedback space
    gainNode.connect(this.ctx.destination);
    if (this.delayNode) {
      gainNode.connect(this.delayNode);
    }

    osc1.start(now);
    osc2.start(now);
    
    osc1.stop(now + decay + 0.1);
    osc2.stop(now + decay + 0.1);
  }

  /**
   * Beautiful, glassy crystal singing bowl with high pure harmonics and long slow decay
   */
  private triggerSingingBowl(freq: number, volume: number, duration: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Singing bowls consist of a fundamental pure sine wave + very subtle octave/fifth partials
    const partials = [1.0, 2.0, 2.99, 4.02];
    
    partials.forEach((mult, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * mult, now);

      // Volume fades in slowly representing a soft strike of the leather mallet
      const partialVol = volume * (idx === 0 ? 0.9 : idx === 1 ? 0.33 : 0.12);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(partialVol, now + 0.6); // slow soft strike swell
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      if (this.delayNode) {
        // Echoes beautifully
        gain.connect(this.delayNode);
      }

      osc.start(now);
      osc.stop(now + duration + 0.1);
    });
  }

  private triggerGentleChimes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // High pentatonic nodes representing silver desert bells
    const chimeFreqs = [783.99, 880.00, 987.77, 1174.66, 1318.51];
    
    chimeFreqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      // Stagger chimes gently over short delays to sound like wind
      const delay = idx * 0.18 + Math.random() * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + delay);

      // Super delicate volume
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.009, now + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      if (this.delayNode) {
        gain.connect(this.delayNode);
      }

      osc.start(now + delay);
      osc.stop(now + delay + 1.6);
    });
  }

  private triggerFaintTempleBell() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const fundamental = 82.41; // Deep E2 fundamental representing a heavy ancient temple bowl
    const partials = [1, 1.5, 2, 2.68, 3.2];

    partials.forEach((mult, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(fundamental * mult, now);

      const decayTime = 6.0 / mult;
      const volume = 0.008 / (i + 1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.08); // slow gong swell
      gain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      if (this.delayNode) {
        gain.connect(this.delayNode);
      }

      osc.start(now);
      osc.stop(now + decayTime + 0.1);
    });
  }

  /**
   * High-End Guzheng Pluck triggered by user finger strokes or spotlight motion.
   * Chorused and echoing within the spatial feedback loop!
   */
  public playGuzhengPluck(xRatio: number = 0.5) {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // 160ms throttle to prevent sound clipping
    if (now - this.lastPlayTime < 0.16) return;
    this.lastPlayTime = now;

    const index = Math.floor(xRatio * this.pentatonicScale.length);
    const freq = this.pentatonicScale[Math.max(0, Math.min(index, this.pentatonicScale.length - 1))];

    this.triggerPluckNote(freq, 0.12, 1.4);
  }

  /**
   * Deep sacred ceremonial bell, layered with high cascading wind chimes
   */
  public playTempleBell() {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const fundamental = 110; // A2
    const partials = [1, 2, 2.4, 3, 3.7, 4.2];

    partials.forEach((mult, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(fundamental * mult, now);

      const decayTime = 4.5 / mult;
      const volume = 0.08 / (i + 1);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      if (this.delayNode) {
        gain.connect(this.delayNode);
      }

      osc.start(now);
      osc.stop(now + decayTime + 0.1);
    });

    // Cascade bells
    this.playChimes();
  }

  /**
   * Sound of cascading micro bells
   */
  public playChimes() {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const chimeFreqs = [880, 987.77, 1046.50, 1174.66, 1318.51, 1567.98];

    chimeFreqs.forEach((freq, i) => {
      if (!this.ctx) return;
      const delay = i * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.022, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.0);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      if (this.delayNode) {
        gain.connect(this.delayNode);
      }

      osc.start(now + delay);
      osc.stop(now + delay + 1.1);
    });
  }

  /**
   * Atmospheric wind sweep used for restoration and transitions
   */
  public playSwipeSound() {
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.45);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.46);
  }
}

export const audio = new DunhuangAudioEngine();
