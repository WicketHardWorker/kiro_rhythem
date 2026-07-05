/**
 * AudioEngine - 超低遅延オーディオシステム
 * 
 * 設計思想:
 * - AudioContext は latencyHint: "interactive" で最小レイテンシ
 * - タップ音はプリバッファ済みのオシレーター即時発音
 * - 判定は AudioContext.currentTime ベース（高精度）
 * - モバイルでの AudioContext unlock を最初のタッチで実行
 */
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.isReady = false;
        this.masterGain = null;
        this.bgmGain = null;
        this.sfxGain = null;
        
        // 合成音のパラメータプリセット
        this.sounds = {
            tap: { freq: 880, type: 'square', attack: 0.001, decay: 0.08, sustain: 0.3, release: 0.05 },
            tapHold: { freq: 660, type: 'sawtooth', attack: 0.001, decay: 0.02, sustain: 0.7, release: 0.1 },
            demo: { freq: 523.25, type: 'triangle', attack: 0.001, decay: 0.05, sustain: 0.5, release: 0.08 },
            demoHold: { freq: 392, type: 'sine', attack: 0.001, decay: 0.02, sustain: 0.8, release: 0.15 },
            metronome: { freq: 1200, type: 'sine', attack: 0.001, decay: 0.03, sustain: 0.0, release: 0.02 },
            metronomeLow: { freq: 800, type: 'sine', attack: 0.001, decay: 0.03, sustain: 0.0, release: 0.02 },
            success: { freq: 1047, type: 'sine', attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
        };
    }

    /**
     * AudioContext を初期化（ユーザージェスチャー内で呼ぶ）
     */
    async init() {
        if (this.ctx) return;
        
        this.ctx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 44100
        });

        // Resume if suspended (iOS対策)
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // マスターゲイン
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.ctx.destination);

        // BGM用チェーン
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = 0.25;
        this.bgmGain.connect(this.masterGain);

        // SFX用チェーン（タップ音・お手本音）
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.7;
        this.sfxGain.connect(this.masterGain);

        // コンプレッサーで音割れ防止
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -12;
        this.compressor.knee.value = 10;
        this.compressor.ratio.value = 4;
        this.compressor.connect(this.masterGain);

        this.isReady = true;
        console.log(`AudioEngine ready. Base latency: ${(this.ctx.baseLatency * 1000).toFixed(1)}ms, Output latency: ${((this.ctx.outputLatency || 0) * 1000).toFixed(1)}ms`);
    }

    /**
     * 現在のオーディオ時刻を取得（高精度タイムスタンプ）
     */
    get now() {
        return this.ctx ? this.ctx.currentTime : 0;
    }

    /**
     * 短い電子音を即時再生（タップフィードバック用）
     * @returns {Object} { stop: Function } - holdモード時に音を止める関数
     */
    playTapSound(isHold = false) {
        if (!this.isReady) return { stop: () => {} };

        const sound = isHold ? this.sounds.tapHold : this.sounds.tap;
        const now = this.ctx.currentTime;
        
        // オシレーター
        const osc = this.ctx.createOscillator();
        osc.type = sound.type;
        osc.frequency.value = sound.freq;

        // エンベロープ用ゲイン
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.6, now + sound.attack);
        
        if (!isHold) {
            env.gain.exponentialRampToValueAtTime(sound.sustain * 0.6 + 0.001, now + sound.attack + sound.decay);
            env.gain.exponentialRampToValueAtTime(0.001, now + sound.attack + sound.decay + sound.release);
            osc.connect(env);
            env.connect(this.sfxGain);
            osc.start(now);
            osc.stop(now + sound.attack + sound.decay + sound.release + 0.01);
            return { stop: () => {} };
        } else {
            // Hold: サステイン継続、stop() で解放
            env.gain.linearRampToValueAtTime(sound.sustain * 0.6, now + sound.attack + sound.decay);
            osc.connect(env);
            env.connect(this.sfxGain);
            osc.start(now);

            return {
                stop: () => {
                    const t = this.ctx.currentTime;
                    env.gain.cancelScheduledValues(t);
                    env.gain.setValueAtTime(env.gain.value, t);
                    env.gain.exponentialRampToValueAtTime(0.001, t + sound.release);
                    osc.stop(t + sound.release + 0.01);
                }
            };
        }
    }

    /**
     * お手本音を再生
     */
    playDemoNote(duration = 0.1) {
        if (!this.isReady) return;

        const isHold = duration > 0.2;
        const sound = isHold ? this.sounds.demoHold : this.sounds.demo;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = sound.type;
        osc.frequency.value = sound.freq;

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.5, now + sound.attack);

        if (isHold) {
            const sustainEnd = now + duration - sound.release;
            env.gain.linearRampToValueAtTime(sound.sustain * 0.5, now + sound.attack + sound.decay);
            env.gain.setValueAtTime(sound.sustain * 0.5, sustainEnd);
            env.gain.exponentialRampToValueAtTime(0.001, now + duration);
        } else {
            env.gain.exponentialRampToValueAtTime(0.001, now + duration);
        }

        osc.connect(env);
        env.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + duration + 0.01);
    }

    /**
     * お手本音をスケジュール再生（将来の時刻に正確に発音）
     */
    scheduleDemoNote(atTime, duration = 0.1) {
        if (!this.isReady) return;

        const isHold = duration > 0.2;
        const sound = isHold ? this.sounds.demoHold : this.sounds.demo;

        const osc = this.ctx.createOscillator();
        osc.type = sound.type;
        osc.frequency.value = sound.freq;

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0, atTime);
        env.gain.linearRampToValueAtTime(0.5, atTime + sound.attack);

        if (isHold) {
            const sustainEnd = atTime + duration - sound.release;
            env.gain.linearRampToValueAtTime(sound.sustain * 0.5, atTime + sound.attack + sound.decay);
            if (sustainEnd > atTime + sound.attack + sound.decay) {
                env.gain.setValueAtTime(sound.sustain * 0.5, sustainEnd);
            }
            env.gain.exponentialRampToValueAtTime(0.001, atTime + duration);
        } else {
            env.gain.exponentialRampToValueAtTime(0.001, atTime + duration);
        }

        osc.connect(env);
        env.connect(this.sfxGain);
        osc.start(atTime);
        osc.stop(atTime + duration + 0.01);
    }

    /**
     * メトロノームクリック
     */
    scheduleClick(atTime, strong = false) {
        if (!this.isReady) return;

        const sound = strong ? this.sounds.metronome : this.sounds.metronomeLow;
        const osc = this.ctx.createOscillator();
        osc.type = sound.type;
        osc.frequency.value = sound.freq;

        const env = this.ctx.createGain();
        const vol = strong ? 0.3 : 0.15;
        env.gain.setValueAtTime(0, atTime);
        env.gain.linearRampToValueAtTime(vol, atTime + 0.001);
        env.gain.exponentialRampToValueAtTime(0.001, atTime + 0.04);

        osc.connect(env);
        env.connect(this.sfxGain);
        osc.start(atTime);
        osc.stop(atTime + 0.05);
    }

    /**
     * BGMの和音を生成・再生
     */
    startBGM(bpm, timeSignature = [4, 4]) {
        this.stopBGM();
        if (!this.isReady) return;

        const beatDuration = 60 / bpm;
        const barDuration = beatDuration * timeSignature[0];
        
        // シンプルなコード進行を繰り返す
        this.bgmInterval = null;
        this.bgmPlaying = true;
        
        const chords = [
            [261.63, 329.63, 392.00],  // C major
            [293.66, 349.23, 440.00],  // D minor (approx)
            [246.94, 311.13, 369.99],  // B dim (approx)
            [261.63, 329.63, 392.00],  // C major
        ];
        
        let chordIndex = 0;
        let nextChordTime = this.ctx.currentTime;

        const scheduleChords = () => {
            if (!this.bgmPlaying) return;
            
            const lookAhead = barDuration * 2;
            
            while (nextChordTime < this.ctx.currentTime + lookAhead) {
                const chord = chords[chordIndex % chords.length];
                
                chord.forEach(freq => {
                    const osc = this.ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    
                    const env = this.ctx.createGain();
                    env.gain.setValueAtTime(0, nextChordTime);
                    env.gain.linearRampToValueAtTime(0.15, nextChordTime + 0.05);
                    env.gain.setValueAtTime(0.15, nextChordTime + barDuration - 0.1);
                    env.gain.exponentialRampToValueAtTime(0.001, nextChordTime + barDuration);
                    
                    osc.connect(env);
                    env.connect(this.bgmGain);
                    osc.start(nextChordTime);
                    osc.stop(nextChordTime + barDuration + 0.01);
                });

                // ベースライン
                const bassOsc = this.ctx.createOscillator();
                bassOsc.type = 'triangle';
                bassOsc.frequency.value = chord[0] / 2;
                const bassEnv = this.ctx.createGain();
                bassEnv.gain.setValueAtTime(0, nextChordTime);
                bassEnv.gain.linearRampToValueAtTime(0.2, nextChordTime + 0.01);
                bassEnv.gain.exponentialRampToValueAtTime(0.05, nextChordTime + beatDuration);
                bassEnv.gain.setValueAtTime(0.05, nextChordTime + barDuration - 0.05);
                bassEnv.gain.exponentialRampToValueAtTime(0.001, nextChordTime + barDuration);
                bassOsc.connect(bassEnv);
                bassEnv.connect(this.bgmGain);
                bassOsc.start(nextChordTime);
                bassOsc.stop(nextChordTime + barDuration + 0.01);

                nextChordTime += barDuration;
                chordIndex++;
            }
        };

        scheduleChords();
        this.bgmInterval = setInterval(scheduleChords, barDuration * 500); // schedule ahead
    }

    stopBGM() {
        this.bgmPlaying = false;
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
    }

    /**
     * 成功音
     */
    playSuccess() {
        if (!this.isReady) return;
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const env = this.ctx.createGain();
            const t = now + i * 0.1;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(0.3, t + 0.01);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            osc.connect(env);
            env.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.5);
        });
    }
}

// グローバルインスタンス
const audioEngine = new AudioEngine();
