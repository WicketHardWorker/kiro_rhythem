/**
 * GameLogic - ゲーム進行と判定システム
 * 
 * フェーズ:
 * 1. LISTEN - お手本パターンを聴く（2回再生）
 * 2. PLAY_COUNTIN - YOUR TURN の4カウント
 * 3. PLAY - プレイヤーがパターンを再現
 * 4. JUDGE - 判定・結果表示
 */
class GameLogic {
    constructor() {
        this.currentStage = 0;
        this.phase = 'IDLE'; // IDLE, COUNTDOWN, LISTEN, PLAY_COUNTIN, PLAY, JUDGE
        this.playerInputs = []; // { startTime, endTime } in seconds relative to pattern start
        this.patternStartTime = 0; // AudioContext time when play phase started
        this.scheduledNotes = [];
        this.metronomeIds = [];
        this.countdownStep = 0;
        
        // コールバック
        this.onPhaseChange = null;
        this.onBeat = null;
        this.onDemoNote = null;
        this.onResult = null;
        this.onCountdown = null;
        this.onPlayCountdown = null;
        this.onProgress = null;

        // タイミング判定設定
        this.timingWindows = {
            perfect: 0.05,  // ±50ms
            great: 0.10,    // ±100ms
            good: 0.18,     // ±180ms
            ok: 0.28,       // ±280ms
        };

        // Duration 判定設定（割合）
        this.durationWindows = {
            perfect: 0.2,  // ±20%誤差
            great: 0.35,
            good: 0.5,
            ok: 0.7,
        };
    }

    get stage() {
        return STAGES[this.currentStage];
    }

    get beatDuration() {
        return 60 / this.stage.bpm;
    }

    /**
     * ステージを開始する
     */
    startStage(stageIndex) {
        if (stageIndex !== undefined) {
            this.currentStage = stageIndex;
        }
        this.playerInputs = [];
        this.phase = 'IDLE';
        
        // BGMを即座に開始（ステージ中ずっと鳴り続ける）
        audioEngine.startBGM(this.stage.bpm, this.stage.bgmTimeSignature);
        
        // ステージイントロ後にカウントダウン開始
        setTimeout(() => this.startCountdown(), 2000);
    }

    /**
     * カウントダウン → リスンフェーズ
     */
    startCountdown() {
        this.phase = 'COUNTDOWN';
        if (this.onPhaseChange) this.onPhaseChange('COUNTDOWN');

        const bpm = this.stage.bpm;
        const beatDur = this.beatDuration;
        const startTime = audioEngine.now + 0.1;

        // 4カウント
        this.countdownStep = 0;
        const counts = 4;

        for (let i = 0; i < counts; i++) {
            const t = startTime + i * beatDur;
            audioEngine.scheduleClick(t, i === 0);
        }

        // カウントダウン表示のスケジュール
        const countInterval = setInterval(() => {
            this.countdownStep++;
            if (this.onCountdown) this.onCountdown(this.countdownStep);
            if (this.countdownStep >= counts) {
                clearInterval(countInterval);
            }
        }, beatDur * 1000);

        // カウントダウン終了後にリスンフェーズ
        const listenDelay = counts * beatDur * 1000;
        setTimeout(() => this.startListenPhase(), listenDelay);
    }

    /**
     * お手本再生フェーズ
     */
    startListenPhase() {
        this.phase = 'LISTEN';
        if (this.onPhaseChange) this.onPhaseChange('LISTEN');

        const stage = this.stage;
        const beatDur = this.beatDuration;
        const patternDur = getPatternDurationSec(stage);
        const startTime = audioEngine.now + 0.1;

        // BGMはstartStage()で既に開始済み（止めない）

        // メトロノーム（小節全体）
        const totalBeats = stage.timeSignature[0];
        for (let i = 0; i < totalBeats; i++) {
            const t = startTime + i * beatDur;
            audioEngine.scheduleClick(t, i === 0);
        }

        // お手本ノートをスケジュール
        stage.pattern.forEach((note, idx) => {
            const noteTime = startTime + note.time * beatDur;
            const noteDur = note.duration * beatDur;
            audioEngine.scheduleDemoNote(noteTime, noteDur);

            // ビジュアルコールバックのスケジュール
            const delay = (noteTime - audioEngine.now) * 1000;
            setTimeout(() => {
                if (this.onDemoNote) this.onDemoNote(note, idx);
            }, Math.max(0, delay));
        });

        // プログレスバー更新
        this.startProgressTracking(startTime, patternDur);

        // 2回目の再生（同じパターン）+ その後 PLAY フェーズ
        const secondStartTime = startTime + patternDur + beatDur; // 1拍休み

        setTimeout(() => {
            // 2回目のメトロノーム
            for (let i = 0; i < totalBeats; i++) {
                const t = secondStartTime + i * beatDur;
                audioEngine.scheduleClick(t, i === 0);
            }

            // 2回目のお手本
            stage.pattern.forEach((note, idx) => {
                const noteTime = secondStartTime + note.time * beatDur;
                const noteDur = note.duration * beatDur;
                audioEngine.scheduleDemoNote(noteTime, noteDur);
                
                const delay = (noteTime - audioEngine.now) * 1000;
                setTimeout(() => {
                    if (this.onDemoNote) this.onDemoNote(note, idx);
                }, Math.max(0, delay));
            });

            this.startProgressTracking(secondStartTime, patternDur);
        }, (patternDur + beatDur) * 1000);

        // リスン終了 → プレイフェーズへ
        const totalListenTime = (patternDur * 2 + beatDur * 2) * 1000;
        setTimeout(() => this.startPlayPhase(), totalListenTime);
    }

    /**
     * プレイフェーズ - 4カウントのカウントインで明確に開始を伝える
     */
    startPlayPhase() {
        this.phase = 'PLAY_COUNTIN';
        this.playerInputs = [];
        if (this.onPhaseChange) this.onPhaseChange('PLAY_COUNTIN');

        const stage = this.stage;
        const beatDur = this.beatDuration;
        const patternDur = getPatternDurationSec(stage);
        
        // 4カウントのカウントイン（YOUR TURN を明確に伝える）
        const countInBeats = 4;
        const countInStart = audioEngine.now + 0.1;

        for (let i = 0; i < countInBeats; i++) {
            const t = countInStart + i * beatDur;
            audioEngine.scheduleClick(t, true); // 全部強いクリックで目立たせる
        }

        // カウントイン表示
        this.countdownStep = 0;
        const countInterval = setInterval(() => {
            this.countdownStep++;
            if (this.onPlayCountdown) this.onPlayCountdown(this.countdownStep, countInBeats);
            if (this.countdownStep >= countInBeats) {
                clearInterval(countInterval);
            }
        }, beatDur * 1000);

        // カウントイン終了後に本番開始
        const countInDuration = countInBeats * beatDur;
        const startTime = countInStart + countInDuration;
        this.patternStartTime = startTime;

        setTimeout(() => {
            this.phase = 'PLAY';
            if (this.onPhaseChange) this.onPhaseChange('PLAY');

            // メトロノーム（プレイ中）
            const totalBeats = stage.timeSignature[0];
            for (let i = 0; i < totalBeats; i++) {
                const t = startTime + i * beatDur;
                audioEngine.scheduleClick(t, i === 0);
            }

            // プログレス
            this.startProgressTracking(startTime, patternDur);

            // プレイ時間終了後に判定（余白込み）
            const playTime = (patternDur + beatDur * 0.5) * 1000;
            setTimeout(() => this.judgePerformance(), playTime);
        }, countInDuration * 1000);
    }

    /**
     * タップ開始を記録
     */
    onTapStart() {
        if (this.phase !== 'PLAY') return null;
        
        const tapTime = audioEngine.now - this.patternStartTime;
        const input = { startTime: tapTime, endTime: null };
        this.playerInputs.push(input);
        return input;
    }

    /**
     * タップ終了を記録
     */
    onTapEnd() {
        if (this.phase !== 'PLAY') return;
        
        const tapEndTime = audioEngine.now - this.patternStartTime;
        // 最後の未完了入力を閉じる
        for (let i = this.playerInputs.length - 1; i >= 0; i--) {
            if (this.playerInputs[i].endTime === null) {
                this.playerInputs[i].endTime = tapEndTime;
                break;
            }
        }
    }

    /**
     * プレイヤーの入力を判定
     */
    judgePerformance() {
        this.phase = 'JUDGE';
        // BGMは止めない（結果画面でも鳴り続ける）

        const stage = this.stage;
        const beatDur = this.beatDuration;
        const pattern = stage.pattern;

        // 未完了のタップを閉じる
        this.playerInputs.forEach(input => {
            if (input.endTime === null) {
                input.endTime = input.startTime + 0.1;
            }
        });

        let totalTimingScore = 0;
        let totalDurationScore = 0;
        let matchedNotes = 0;

        // 各パターンノートに対して最も近い入力を見つける
        const usedInputs = new Set();
        
        pattern.forEach(note => {
            const expectedTime = note.time * beatDur;
            const expectedDuration = note.duration * beatDur;
            const isHold = note.duration >= HOLD_THRESHOLD_BEATS;

            // 最も近い未使用の入力を探す
            let bestIdx = -1;
            let bestDiff = Infinity;

            this.playerInputs.forEach((input, idx) => {
                if (usedInputs.has(idx)) return;
                const diff = Math.abs(input.startTime - expectedTime);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestIdx = idx;
                }
            });

            if (bestIdx >= 0 && bestDiff < this.timingWindows.ok + 0.1) {
                usedInputs.add(bestIdx);
                matchedNotes++;

                // タイミングスコア
                const timingScore = this.calcTimingScore(bestDiff);
                totalTimingScore += timingScore;

                // Duration スコア
                if (isHold) {
                    const input = this.playerInputs[bestIdx];
                    const actualDuration = input.endTime - input.startTime;
                    const durationRatio = Math.abs(actualDuration - expectedDuration) / expectedDuration;
                    totalDurationScore += this.calcDurationScore(durationRatio);
                } else {
                    // 短いノートはduration完璧扱い
                    totalDurationScore += 1.0;
                }
            } else {
                // ミス（入力なし）
                totalTimingScore += 0;
                totalDurationScore += 0;
            }
        });

        const noteCount = pattern.length;
        const timingPercent = noteCount > 0 ? (totalTimingScore / noteCount) * 100 : 0;
        const durationPercent = noteCount > 0 ? (totalDurationScore / noteCount) * 100 : 0;

        // 総合スコア（タイミング70%、長さ30%のウェイト）
        const totalScore = timingPercent * 0.7 + durationPercent * 0.3;

        // グレード
        let grade = 'C';
        if (totalScore >= 95) grade = 'S';
        else if (totalScore >= 85) grade = 'A';
        else if (totalScore >= 70) grade = 'B';

        const result = {
            grade,
            totalScore: Math.round(totalScore),
            timingPercent: Math.round(timingPercent),
            durationPercent: Math.round(durationPercent),
            matchedNotes,
            totalNotes: noteCount,
            passed: totalScore >= 60,
        };

        if (result.passed && grade !== 'C') {
            audioEngine.playSuccess();
        }

        if (this.onResult) this.onResult(result);
    }

    /**
     * タイミング差からスコアを算出（0〜1）
     */
    calcTimingScore(diffSec) {
        if (diffSec <= this.timingWindows.perfect) return 1.0;
        if (diffSec <= this.timingWindows.great) return 0.9;
        if (diffSec <= this.timingWindows.good) return 0.7;
        if (diffSec <= this.timingWindows.ok) return 0.5;
        return 0.2;
    }

    /**
     * Duration比率からスコアを算出（0〜1）
     */
    calcDurationScore(ratio) {
        if (ratio <= this.durationWindows.perfect) return 1.0;
        if (ratio <= this.durationWindows.great) return 0.9;
        if (ratio <= this.durationWindows.good) return 0.7;
        if (ratio <= this.durationWindows.ok) return 0.5;
        return 0.2;
    }

    /**
     * 次のステージへ
     */
    nextStage() {
        if (this.currentStage < STAGES.length - 1) {
            this.currentStage++;
            return true;
        }
        return false;
    }

    /**
     * プログレスバーのリアルタイム追跡
     */
    startProgressTracking(startTime, duration) {
        const update = () => {
            if (this.phase === 'JUDGE' || this.phase === 'IDLE') return;
            const elapsed = audioEngine.now - startTime;
            const progress = Math.min(1, Math.max(0, elapsed / duration));
            if (this.onProgress) this.onProgress(progress);
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        requestAnimationFrame(update);
    }
}

const gameLogic = new GameLogic();
