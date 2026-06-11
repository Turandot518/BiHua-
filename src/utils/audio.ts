/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class DunhuangAudioEngine {
  private ctx: AudioContext | null = null;
  private pentatonicScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00]; // 宫商角徵羽
  private lastPlayTime = 0;

  // Background Generative Sanskrit Music States
  private bgmPlaying = false;
  private bgmTimeout: any = null;
  private droneOscs: { osc: OscillatorNode; gain: GainNode }[] = [];
  private formantOscs: { osc: OscillatorNode; gain: GainNode }[] = [];
  private formantLfo: OscillatorNode | null = null;
  private formantGroupGain: GainNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private stepIndex = 0;

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
   * Starts a beautiful, continuous, Sanskrit Buddist temple soundtrack
   */
  public startBGM() {
    this.initContext();
    if (!this.ctx || this.bgmPlaying) return;

    this.bgmPlaying = true;
    this.stepIndex = 0;
    const now = this.ctx.currentTime;

    try {
      // --- 1. AESTHETIC BUDDHIST FORMANT CHOIR DRONE (梵音低吟 OMMMM) ---
      // We detune sawtooth and triangle oscillators passing through automatic formant throat filters
      // simulating a gathering of Buddhist monks humming deep sacred Sanskrit mantras.
      const baseFreqs = [55.0, 110.0, 165.0]; // A1, A2, E3 root-fifth anchors
      this.formantOscs = [];

      this.formantGroupGain = this.ctx.createGain();
      this.formantGroupGain.gain.setValueAtTime(0, now);
      this.formantGroupGain.gain.linearRampToValueAtTime(0.040, now + 4.5);
      this.formantGroupGain.connect(this.ctx.destination);

      // Vocal Vowel Formant Bandpass sweeps back-and-forth between Aaa (720Hz) and Ooo (450Hz)
      const vowelFilter = this.ctx.createBiquadFilter();
      vowelFilter.type = "bandpass";
      vowelFilter.Q.setValueAtTime(3.8, now);
      vowelFilter.frequency.setValueAtTime(550, now);
      vowelFilter.connect(this.formantGroupGain);

      if (this.delayNode) {
        // Send a bit of chanting drone to the vast hall echoes
        const droneDryGain = this.ctx.createGain();
        droneDryGain.gain.setValueAtTime(0.15, now);
        vowelFilter.connect(droneDryGain);
        droneDryGain.connect(this.delayNode);
      }

      // Sweep the filter slowly using an LFO for natural organic chanting breathing
      this.formantLfo = this.ctx.createOscillator();
      this.formantLfo.frequency.setValueAtTime(0.08, now); // Slow 12.5 seconds sweeping cycles
      const lfoGainNode = this.ctx.createGain();
      lfoGainNode.gain.setValueAtTime(140, now); // scale frequency center by +/- 140Hz

      this.formantLfo.connect(lfoGainNode);
      lfoGainNode.connect(vowelFilter.frequency);
      this.formantLfo.start(now);

      baseFreqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Layer saw/triangle for rich buzzy reedy vocal folds
        osc.type = idx === 1 ? "sawtooth" : "triangle";
        // Fine micro detune (around ±0.6Hz) creates chorus-like lushness
        osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 0.7, now);

        // Vocal vibrato cycle (Buddhist monk chants naturally weave tremolo pitch vibrato)
        const vibe = this.ctx.createOscillator();
        vibe.frequency.setValueAtTime(4.8 + idx * 0.4, now);
        const vibeGain = this.ctx.createGain();
        vibeGain.gain.setValueAtTime(0.35, now);
        vibe.connect(vibeGain);
        vibeGain.connect(osc.frequency);
        vibe.start(now);

        const v = idx === 0 ? 0.35 : idx === 1 ? 0.22 : 0.08;
        gain.gain.setValueAtTime(v, now);

        // Severe low-pass filter takes high-frequency saw harsh buzz, leaving cozy chest hums
        const chantFilter = this.ctx.createBiquadFilter();
        chantFilter.type = "lowpass";
        chantFilter.frequency.setValueAtTime(420, now);

        osc.connect(chantFilter);
        chantFilter.connect(gain);
        gain.connect(vowelFilter);

        osc.start(now);
        this.formantOscs.push({ osc, gain });
      });

      // --- 2. SUB-BASS DRONE FOR STEADY ZEN VIBRATION ---
      const subFrequencies = [73.42, 110.00];
      this.droneOscs = [];

      const masterDroneGain = this.ctx.createGain();
      masterDroneGain.gain.setValueAtTime(0, now);
      masterDroneGain.gain.linearRampToValueAtTime(0.015, now + 4.0);
      masterDroneGain.connect(this.ctx.destination);

      subFrequencies.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(100, now);

        const baseVolume = idx === 0 ? 0.3 : 0.15;
        gain.gain.setValueAtTime(baseVolume, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterDroneGain);

        osc.start(now);
        this.droneOscs.push({ osc, gain });
      });

      this.lfoOsc = this.ctx.createOscillator();
      this.lfoOsc.frequency.setValueAtTime(0.05, now);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.008, now);
      this.lfoOsc.connect(lfoGain);
      lfoGain.connect(masterDroneGain.gain);
      this.lfoOsc.start(now);

      // --- 3. THE SANSKRIT ZEN STEP SEQUENCER LOOP (400ms per step) ---
      // This plays an emotional, ancient Buddhist melody (Pentatonic, reminiscent of temple hymns)
      // coupled with Wooden Fish clicks on even beats, Guzheng runs, and Singing Bowls on downbeats!
      const playSequencerStep = () => {
        if (!this.bgmPlaying || !this.ctx) return;

        const step = this.stepIndex % 32;

        // Traditional Sanskrit Buddhist Pentatonic flute theme pitches
        // 0 denotes rest beats (meditative spaces)
        const melody = [
          440.00, 0,      440.00, 523.25, 587.33, 0,      587.33, 659.25, // Step 0-7: A4, A4, C5, D5, D5, E5
          783.99, 0,      659.25, 0,      587.33, 523.25, 440.00, 0,      // Step 8-15: G5, E5, D5, C5, A4
          587.33, 0,      587.33, 659.25, 783.99, 0,      880.00, 0,      // Step 16-23: D5, D5, E5, G5, A5
          783.99, 659.25, 587.33, 523.25, 440.00, 0,      0,      0       // Step 24-31: G5, E5, D5, C5, A4
        ];

        // A. Trigger Zen Bamboo Flute Melody
        const currentNote = melody[step];
        if (currentNote > 0) {
          // Play woodwind sound with breathing space
          this.triggerZenFlute(currentNote, 0.045, 1.3);
        }

        // B. Steady Wooden Fish heartbeat ticks on every other step (0, 2, 4...)
        if (step % 2 === 0) {
          // Play soft, woodblock heartbeat to establish the Sanskrit rhythm pace
          this.triggerWoodenFish(0.024);
        }

        // C. Trigger Guzheng backup rolling arpeggios on downbeats
        if (step === 0) {
          // Am rolling accompaniment notes
          this.triggerPluckNote(220.00, 0.04, 1.2);
          setTimeout(() => this.triggerPluckNote(329.63, 0.035, 1.2), 60);
          setTimeout(() => this.triggerPluckNote(440.00, 0.03, 1.2), 120);
          
          // Singing bowl resonance washes over downbeat
          this.triggerSingingBowl(220.00, 0.015, 6.0);
        } else if (step === 8) {
          // C chord backup
          this.triggerPluckNote(261.63, 0.04, 1.2);
          setTimeout(() => this.triggerPluckNote(392.00, 0.035, 1.2), 60);
          setTimeout(() => this.triggerPluckNote(523.25, 0.03, 1.2), 120);
        } else if (step === 16) {
          // D chord backup
          this.triggerPluckNote(293.66, 0.04, 1.2);
          setTimeout(() => this.triggerPluckNote(440.00, 0.035, 1.2), 60);
          setTimeout(() => this.triggerPluckNote(587.33, 0.03, 1.2), 120);
          
          this.triggerSingingBowl(329.63, 0.015, 6.0);
        } else if (step === 24) {
          // G chord backup
          this.triggerPluckNote(196.00, 0.04, 1.2);
          setTimeout(() => this.triggerPluckNote(293.66, 0.035, 1.2), 60);
          setTimeout(() => this.triggerPluckNote(392.00, 0.03, 1.2), 120);
        }

        // D. High sweet silver sky-scatter wind chimes shimmering softly in space
        if (step === 12 || step === 28) {
          if (Math.random() > 0.3) {
            this.triggerGentleChimes();
          }
        }

        // E. Faint majestic temple bell deep in the horizon
        if (this.stepIndex % 64 === 0) {
          this.triggerFaintTempleBell();
        }

        this.stepIndex++;
        // Keep steps beautifully structured at 400ms intervals (150 BPM eighth notes)
        this.bgmTimeout = setTimeout(playSequencerStep, 400);
      };

      // Gentle warmup delay before playing the Sanskrit melody
      this.bgmTimeout = setTimeout(playSequencerStep, 1500);

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

    // Fade out vocal formant chants
    this.formantOscs.forEach(({ osc, gain }) => {
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
    this.formantOscs = [];

    if (this.formantLfo) {
      try { this.formantLfo.stop(); } catch (_) {}
      this.formantLfo = null;
    }

    if (this.lfoOsc) {
      try { this.lfoOsc.stop(); } catch (_) {}
      this.lfoOsc = null;
    }
  }

  /**
   * Beautiful, breathing bamboo flute sound (vibrato triangle wave with soft lowpass sweep)
   */
  private triggerZenFlute(freq: number, volume: number = 0.05, duration: number = 1.3) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);

    // Warm, authentic air tremolo (bamboo flutes vibrato around 5.5 - 6.0 Hz)
    const vibrato = this.ctx.createOscillator();
    vibrato.frequency.setValueAtTime(5.8, now);
    const vibratoGain = this.ctx.createGain();
    vibratoGain.gain.setValueAtTime(0, now);
    vibratoGain.gain.linearRampToValueAtTime(freq * 0.008, now + 0.3); // swell vibrato depth
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    vibrato.start(now);

    filter.type = "lowpass";
    // Soft flute breathing filter frequency
    filter.frequency.setValueAtTime(freq * 1.6, now);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.1, now + duration);

    gainNode.gain.setValueAtTime(0, now);
    // Smooth soft breath-in attack
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.12);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    if (this.delayNode) {
      gainNode.connect(this.delayNode);
    }

    osc.start(now);
    osc.stop(now + duration + 0.1);
    vibrato.stop(now + duration + 0.1);
  }

  /**
   * Authentic wooden fish (木鱼) block drum strike.
   * Tight high-Q bandpass sound with tiny woody chest release click.
   */
  private triggerWoodenFish(volume: number = 0.024) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(540, now);
    // Pitch drops slightly immediately for a realistic hollow wood shell sound
    osc.frequency.exponentialRampToValueAtTime(430, now + 0.06);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(480, now);
    filter.Q.setValueAtTime(14, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.003); // Instant percussion transients
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    if (this.delayNode) {
      // Subtle spacey delayed echoes
      const woodEchoGain = this.ctx.createGain();
      woodEchoGain.gain.setValueAtTime(0.08, now);
      gainNode.connect(woodEchoGain);
      woodEchoGain.connect(this.delayNode);
    }

    osc.start(now);
    osc.stop(now + 0.1);
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
