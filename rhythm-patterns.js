/**
 * RhythmPatterns - リズムパターン定義
 * 
 * パターン構造:
 * {
 *   time: ビート数（1 = 1拍）,
 *   duration: 音の長さ（ビート単位。0.1=短いタップ、0.5=8分音符の長さ、1=4分音符の長さ）
 * }
 * 
 * duration が閾値（0.25拍）以上ならホールド判定
 */

const STAGES = [
    // Stage 1: 基本の4つ打ち
    {
        name: "First Steps",
        desc: "4/4 - Quarter notes",
        bpm: 90,
        timeSignature: [4, 4],
        bgmTimeSignature: [4, 4],
        pattern: [
            { time: 0, duration: 0.1 },
            { time: 1, duration: 0.1 },
            { time: 2, duration: 0.1 },
            { time: 3, duration: 0.1 },
        ]
    },

    // Stage 2: 8分音符混じり
    {
        name: "Quick Steps",
        desc: "4/4 - Eighth notes",
        bpm: 95,
        timeSignature: [4, 4],
        bgmTimeSignature: [4, 4],
        pattern: [
            { time: 0, duration: 0.1 },
            { time: 0.5, duration: 0.1 },
            { time: 1, duration: 0.1 },
            { time: 2, duration: 0.1 },
            { time: 2.5, duration: 0.1 },
            { time: 3, duration: 0.1 },
        ]
    },

    // Stage 3: ホールドノート登場
    {
        name: "Hold It",
        desc: "4/4 - Long notes",
        bpm: 85,
        timeSignature: [4, 4],
        bgmTimeSignature: [4, 4],
        pattern: [
            { time: 0, duration: 1.0 },   // 1拍伸ばす
            { time: 1.5, duration: 0.1 },
            { time: 2, duration: 2.0 },    // 2拍伸ばす
        ]
    },

    // Stage 4: シンコペーション
    {
        name: "Off-Beat",
        desc: "4/4 - Syncopation",
        bpm: 100,
        timeSignature: [4, 4],
        bgmTimeSignature: [4, 4],
        pattern: [
            { time: 0, duration: 0.1 },
            { time: 0.75, duration: 0.1 },
            { time: 1.5, duration: 0.5 },
            { time: 2.5, duration: 0.1 },
            { time: 3, duration: 0.1 },
            { time: 3.5, duration: 0.1 },
        ]
    },

    // Stage 5: 3/4拍子（ワルツ）
    {
        name: "Waltz",
        desc: "3/4 - Three-beat feel",
        bpm: 110,
        timeSignature: [3, 4],
        bgmTimeSignature: [3, 4],
        pattern: [
            { time: 0, duration: 0.5 },
            { time: 1, duration: 0.1 },
            { time: 1.5, duration: 0.1 },
            { time: 2, duration: 0.1 },
            { time: 2.5, duration: 0.1 },
        ]
    },

    // Stage 6: 付点リズム
    {
        name: "Dotted",
        desc: "4/4 - Dotted rhythms",
        bpm: 95,
        timeSignature: [4, 4],
        bgmTimeSignature: [4, 4],
        pattern: [
            { time: 0, duration: 0.75 },
            { time: 0.75, duration: 0.1 },
            { time: 1.5, duration: 0.75 },
            { time: 2.25, duration: 0.1 },
            { time: 3, duration: 0.1 },
            { time: 3.5, duration: 0.5 },
        ]
    },

    // Stage 7: 5/4拍子（テイクファイブ風）
    {
        name: "Take Five",
        desc: "5/4 - Five-beat groove",
        bpm: 105,
        timeSignature: [5, 4],
        bgmTimeSignature: [5, 4],
        pattern: [
            { time: 0, duration: 0.1 },
            { time: 1, duration: 0.1 },
            { time: 1.5, duration: 0.1 },
            { time: 2, duration: 0.5 },
            { time: 3, duration: 0.1 },
            { time: 3.5, duration: 0.1 },
            { time: 4, duration: 0.1 },
            { time: 4.5, duration: 0.1 },
        ]
    },

    // Stage 8: 7/8拍子
    {
        name: "Seven",
        desc: "7/8 - Asymmetric groove",
        bpm: 130,
        timeSignature: [7, 8],
        bgmTimeSignature: [7, 8],
        pattern: [
            { time: 0, duration: 0.1 },
            { time: 1, duration: 0.1 },
            { time: 2, duration: 0.1 },
            { time: 2.75, duration: 0.1 },
            { time: 3.5, duration: 0.1 },
        ]
    },

    // Stage 9: ポリリズム（3 over 4）- BGMは4拍子、入力パターンは3拍子で割る
    {
        name: "Polyrhythm",
        desc: "3 over 4 - BGM in 4, you play in 3",
        bpm: 90,
        timeSignature: [4, 4],        // プレイヤーのパターンは4拍分の長さ
        bgmTimeSignature: [4, 4],     // BGMは4拍子
        pattern: [
            // 4拍の中に3等分のリズム (4/3 ≈ 1.333 beats apart)
            { time: 0, duration: 0.5 },
            { time: 1.333, duration: 0.5 },
            { time: 2.667, duration: 0.5 },
        ]
    },

    // Stage 10: ポリリズム（5 over 4）+ ホールド
    {
        name: "Chaos",
        desc: "5 over 4 with holds - Ultimate challenge",
        bpm: 88,
        timeSignature: [4, 4],
        bgmTimeSignature: [4, 4],
        pattern: [
            // 4拍の中に5等分 (4/5 = 0.8 beats apart)
            { time: 0, duration: 0.8 },
            { time: 0.8, duration: 0.1 },
            { time: 1.6, duration: 0.4 },
            { time: 2.4, duration: 0.1 },
            { time: 3.2, duration: 0.6 },
        ]
    },
];

/**
 * パターンの総時間（ビート数）を計算
 */
function getPatternDuration(stage) {
    return stage.timeSignature[0];
}

/**
 * パターンの総時間を秒で計算
 */
function getPatternDurationSec(stage) {
    const beatDuration = 60 / stage.bpm;
    return getPatternDuration(stage) * beatDuration;
}

/**
 * ホールド判定の閾値（ビート単位）
 */
const HOLD_THRESHOLD_BEATS = 0.25;

/**
 * ビートを秒に変換
 */
function beatsToSec(beats, bpm) {
    return beats * (60 / bpm);
}

/**
 * 秒をビートに変換  
 */
function secToBeats(sec, bpm) {
    return sec / (60 / bpm);
}
