/**
 * Main - ゲーム初期化とUI制御
 */

// DOM要素
const screens = {
    title: document.getElementById('screen-title'),
    stageIntro: document.getElementById('screen-stage-intro'),
    game: document.getElementById('screen-game'),
    result: document.getElementById('screen-result'),
};

const elements = {
    btnStart: document.getElementById('btn-start'),
    stageNum: document.getElementById('stage-num'),
    stageName: document.getElementById('stage-name'),
    stageDesc: document.getElementById('stage-desc'),
    stageTempo: document.getElementById('stage-tempo'),
    gameStageNum: document.getElementById('game-stage-num'),
    phaseIndicator: document.getElementById('phase-indicator'),
    tapArea: document.getElementById('tap-area'),
    tapRing: document.getElementById('tap-ring'),
    tapText: document.getElementById('tap-text'),
    timingProgress: document.getElementById('timing-progress'),
    beatMarkers: document.getElementById('beat-markers'),
    resultGrade: document.getElementById('result-grade'),
    resultScore: document.getElementById('result-score'),
    resultTiming: document.getElementById('result-timing'),
    resultDuration: document.getElementById('result-duration'),
    btnRetry: document.getElementById('btn-retry'),
    btnNext: document.getElementById('btn-next'),
};

// 現在のタップ状態
let currentTapSound = null;
let isTapping = false;

/**
 * 画面遷移
 */
function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenId].classList.add('active');
}

/**
 * ステージイントロ表示
 */
function showStageIntro() {
    const stage = gameLogic.stage;
    elements.stageNum.textContent = gameLogic.currentStage + 1;
    elements.stageName.textContent = stage.name;
    elements.stageDesc.textContent = stage.desc;
    elements.stageTempo.textContent = `BPM ${stage.bpm}`;
    showScreen('stageIntro');

    // ビートマーカー更新
    updateBeatMarkers(stage);
}

/**
 * ビートマーカーをタイムラインに配置
 */
function updateBeatMarkers(stage) {
    elements.beatMarkers.innerHTML = '';
    const totalBeats = stage.timeSignature[0];
    
    for (let i = 0; i <= totalBeats; i++) {
        const marker = document.createElement('div');
        marker.className = 'beat-marker' + (i === 0 ? ' strong' : '');
        marker.style.left = `${(i / totalBeats) * 100}%`;
        elements.beatMarkers.appendChild(marker);
    }
}

/**
 * ゲーム画面を表示してプレイ開始
 */
function startGame() {
    showScreen('game');
    elements.gameStageNum.textContent = gameLogic.currentStage + 1;
    elements.tapArea.classList.add('disabled');
    elements.tapText.textContent = 'LISTEN...';
    elements.phaseIndicator.textContent = 'LISTEN';
    elements.phaseIndicator.className = 'phase-indicator listen';
    elements.timingProgress.style.width = '0%';
    
    visuals.start();
    gameLogic.startStage();
}

/**
 * フェーズ変更コールバック
 */
gameLogic.onPhaseChange = (phase) => {
    if (phase === 'COUNTDOWN') {
        elements.tapText.textContent = '...';
        elements.phaseIndicator.textContent = 'READY';
        elements.phaseIndicator.className = 'phase-indicator listen';
    } else if (phase === 'LISTEN') {
        elements.tapArea.classList.add('disabled');
        elements.tapText.textContent = 'LISTEN...';
        elements.phaseIndicator.textContent = 'LISTEN';
        elements.phaseIndicator.className = 'phase-indicator listen';
    } else if (phase === 'PLAY_COUNTIN') {
        elements.tapArea.classList.add('disabled');
        elements.tapText.textContent = 'GET READY!';
        elements.phaseIndicator.textContent = 'YOUR TURN';
        elements.phaseIndicator.className = 'phase-indicator play';
        elements.timingProgress.style.width = '0%';
    } else if (phase === 'PLAY') {
        elements.tapArea.classList.remove('disabled');
        elements.tapText.textContent = 'GO!';
        elements.phaseIndicator.textContent = 'GO!';
        elements.phaseIndicator.className = 'phase-indicator play';
        // GO! を一瞬大きく表示してからTAPに変える
        elements.tapArea.classList.add('active');
        setTimeout(() => {
            elements.tapArea.classList.remove('active');
            elements.tapText.textContent = 'TAP!';
            elements.phaseIndicator.textContent = 'YOUR TURN';
        }, 300);
    }
};

/**
 * PLAYカウントイン表示（4カウント、YOUR TURN前の明確な合図）
 */
gameLogic.onPlayCountdown = (step, total) => {
    elements.tapText.textContent = `${total - step + 1}`;
};

/**
 * カウントダウン表示
 */
gameLogic.onCountdown = (step) => {
    elements.tapText.textContent = `${step}`;
};

/**
 * プログレスバー更新
 */
gameLogic.onProgress = (progress) => {
    elements.timingProgress.style.width = `${progress * 100}%`;
};

/**
 * お手本ノート再生時
 */
gameLogic.onDemoNote = (note, index) => {
    visuals.triggerNoteFlash(note, index);
    // タップエリアの一時的なフラッシュ
    elements.tapArea.classList.add('active');
    const dur = Math.min(note.duration * (60 / gameLogic.stage.bpm) * 1000, 500);
    setTimeout(() => {
        if (gameLogic.phase === 'LISTEN') {
            elements.tapArea.classList.remove('active');
        }
    }, dur);
};

/**
 * 結果表示
 */
gameLogic.onResult = (result) => {
    visuals.stop();
    // BGMは止めない（結果画面でも流れ続ける）
    
    setTimeout(() => {
        elements.resultGrade.textContent = result.grade;
        elements.resultGrade.className = 'result-grade ' + result.grade.toLowerCase();
        elements.resultScore.textContent = `${result.totalScore}%`;
        elements.resultTiming.textContent = `${result.timingPercent}%`;
        elements.resultDuration.textContent = `${result.durationPercent}%`;

        // 次へ進めるかどうか
        if (result.passed && gameLogic.currentStage < STAGES.length - 1) {
            elements.btnNext.style.display = '';
        } else if (gameLogic.currentStage >= STAGES.length - 1 && result.passed) {
            elements.btnNext.textContent = 'ALL CLEAR!';
            elements.btnNext.style.display = '';
        } else {
            elements.btnNext.style.display = 'none';
        }

        showScreen('result');
    }, 500);
};

/**
 * タッチ入力処理 - 超低遅延設計
 * touchstart で即座に音を鳴らし、AudioContext の時刻を記録
 */
function handleTapStart(e) {
    e.preventDefault();
    if ((gameLogic.phase !== 'PLAY') || isTapping) return;

    isTapping = true;
    
    // 入力記録（AudioContext 基準の高精度タイムスタンプ）
    const input = gameLogic.onTapStart();
    
    if (input) {
        // 即座に音を再生（Hold判定は後で決まるが、まずHold音を出す）
        currentTapSound = audioEngine.playTapSound(true);
        
        // ビジュアルフィードバック
        elements.tapArea.classList.add('active');
        visuals.triggerTapParticles(false);
        
        // リングパルス
        elements.tapRing.classList.remove('pulse');
        void elements.tapRing.offsetWidth; // reflow trick
        elements.tapRing.classList.add('pulse');
    }
}

function handleTapEnd(e) {
    e.preventDefault();
    if (!isTapping) return;

    isTapping = false;
    
    // 入力終了記録
    gameLogic.onTapEnd();
    
    // 音を止める
    if (currentTapSound) {
        currentTapSound.stop();
        currentTapSound = null;
    }

    // ビジュアル
    elements.tapArea.classList.remove('active');
}

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
    // スタートボタン
    elements.btnStart.addEventListener('touchstart', async (e) => {
        e.preventDefault();
        await audioEngine.init();
        // iOS: ユーザージェスチャー内で確実にresume
        await audioEngine.ensureResumed();
        audioEngine.warmUp();
        showStageIntro();
        setTimeout(startGame, 2000);
    });
    
    // マウスフォールバック（デバッグ用）
    elements.btnStart.addEventListener('click', async (e) => {
        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
        await audioEngine.init();
        await audioEngine.ensureResumed();
        audioEngine.warmUp();
        showStageIntro();
        setTimeout(startGame, 2000);
    });

    // タップエリア - touchstart/end（低遅延）
    elements.tapArea.addEventListener('touchstart', handleTapStart, { passive: false });
    elements.tapArea.addEventListener('touchend', handleTapEnd, { passive: false });
    elements.tapArea.addEventListener('touchcancel', handleTapEnd, { passive: false });

    // マウスフォールバック
    elements.tapArea.addEventListener('mousedown', handleTapStart);
    elements.tapArea.addEventListener('mouseup', handleTapEnd);
    elements.tapArea.addEventListener('mouseleave', handleTapEnd);

    // リトライ
    elements.btnRetry.addEventListener('touchstart', (e) => {
        e.preventDefault();
        audioEngine.stopBGM();
        showStageIntro();
        setTimeout(startGame, 2000);
    });
    elements.btnRetry.addEventListener('click', (e) => {
        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
        audioEngine.stopBGM();
        showStageIntro();
        setTimeout(startGame, 2000);
    });

    // 次のステージ
    elements.btnNext.addEventListener('touchstart', (e) => {
        e.preventDefault();
        audioEngine.stopBGM();
        if (gameLogic.nextStage()) {
            showStageIntro();
            setTimeout(startGame, 2000);
        }
    });
    elements.btnNext.addEventListener('click', (e) => {
        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
        audioEngine.stopBGM();
        if (gameLogic.nextStage()) {
            showStageIntro();
            setTimeout(startGame, 2000);
        }
    });

    // ページ全体のデフォルト動作を防止（スクロール、ズーム）
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    
    // ダブルタップズーム防止
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd < 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });
}

/**
 * 初期化
 */
function initGame() {
    visuals.init();
    setupEventListeners();
    showScreen('title');
    console.log('Rhythm Echo initialized. Tap to start.');
}

// DOM Ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
