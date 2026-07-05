/**
 * Visuals - ビジュアルフィードバックシステム
 * 
 * - Canvas によるリズムパターンの可視化
 * - タップ時のパーティクル演出
 * - ウェーブフォーム表示
 */
class Visuals {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;
        this.particles = [];
        this.wavePhase = 0;
        this.noteFlashes = [];
        this.animationId = null;
        this.isActive = false;
    }

    init() {
        this.canvas = document.getElementById('canvas-visualizer');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = this.width * window.devicePixelRatio;
        this.canvas.height = this.height * window.devicePixelRatio;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    start() {
        this.isActive = true;
        this.animate();
    }

    stop() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * メインアニメーションループ
     */
    animate() {
        if (!this.isActive) return;

        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 背景ウェーブ
        this.drawWave();
        
        // ノートフラッシュ
        this.drawNoteFlashes();
        
        // パーティクル
        this.updateParticles();
        this.drawParticles();

        this.wavePhase += 0.02;
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * 背景のウェーブエフェクト
     */
    drawWave() {
        const { ctx, width, height } = this;
        const centerY = height / 2;
        
        ctx.beginPath();
        ctx.moveTo(0, centerY);

        for (let x = 0; x < width; x += 2) {
            const y = centerY + 
                Math.sin(x * 0.02 + this.wavePhase) * 15 +
                Math.sin(x * 0.005 + this.wavePhase * 0.7) * 8;
            ctx.lineTo(x, y);
        }

        ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Second wave
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for (let x = 0; x < width; x += 2) {
            const y = centerY + 
                Math.sin(x * 0.015 + this.wavePhase * 1.3 + 1) * 10 +
                Math.sin(x * 0.008 + this.wavePhase * 0.5) * 12;
            ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(255, 64, 129, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    /**
     * お手本ノート再生時のフラッシュ
     */
    triggerNoteFlash(note, index) {
        const totalNotes = STAGES[gameLogic.currentStage].pattern.length;
        const x = (index / Math.max(1, totalNotes - 1)) * (this.width * 0.8) + this.width * 0.1;
        const isHold = note.duration >= HOLD_THRESHOLD_BEATS;
        
        this.noteFlashes.push({
            x,
            y: this.height / 2,
            radius: isHold ? 30 : 20,
            alpha: 1,
            isHold,
            duration: note.duration,
        });
    }

    drawNoteFlashes() {
        this.noteFlashes = this.noteFlashes.filter(flash => {
            flash.alpha -= 0.03;
            flash.radius += 1;
            
            if (flash.alpha <= 0) return false;

            const { ctx } = this;
            const gradient = ctx.createRadialGradient(
                flash.x, flash.y, 0,
                flash.x, flash.y, flash.radius
            );
            
            const color = flash.isHold ? '0, 229, 255' : '255, 64, 129';
            gradient.addColorStop(0, `rgba(${color}, ${flash.alpha * 0.8})`);
            gradient.addColorStop(1, `rgba(${color}, 0)`);

            ctx.beginPath();
            ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            return true;
        });
    }

    /**
     * タップ時パーティクル生成
     */
    triggerTapParticles(isHold = false) {
        const centerX = this.width / 2;
        const centerY = this.height * 0.7;
        const count = isHold ? 15 : 8;

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
            const speed = 2 + Math.random() * 4;
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                decay: 0.02 + Math.random() * 0.02,
                size: 3 + Math.random() * 4,
                color: isHold ? [0, 229, 255] : [255, 64, 129],
            });
        }
    }

    updateParticles() {
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1; // gravity
            p.life -= p.decay;
            p.size *= 0.97;
            return p.life > 0;
        });
    }

    drawParticles() {
        this.particles.forEach(p => {
            const { ctx } = this;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color.join(',')}, ${p.life})`;
            ctx.fill();
        });
    }

    /**
     * パターンの視覚的プレビュー（タイムライン表示）
     */
    drawPatternTimeline(stage, progress = 0) {
        const { ctx, width, height } = this;
        const centerY = height * 0.3;
        const lineY = centerY;
        const lineStart = width * 0.1;
        const lineEnd = width * 0.9;
        const lineWidth = lineEnd - lineStart;

        // タイムライン背景
        ctx.beginPath();
        ctx.moveTo(lineStart, lineY);
        ctx.lineTo(lineEnd, lineY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // ノートマーカー
        const patternDuration = getPatternDuration(stage);
        stage.pattern.forEach(note => {
            const x = lineStart + (note.time / patternDuration) * lineWidth;
            const noteWidth = (note.duration / patternDuration) * lineWidth;
            const isHold = note.duration >= HOLD_THRESHOLD_BEATS;

            if (isHold) {
                ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
                ctx.fillRect(x, lineY - 6, noteWidth, 12);
                ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
                ctx.strokeRect(x, lineY - 6, noteWidth, 12);
            } else {
                ctx.beginPath();
                ctx.arc(x, lineY, 6, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 64, 129, 0.8)';
                ctx.fill();
            }
        });

        // プログレスカーソル
        if (progress > 0) {
            const cursorX = lineStart + progress * lineWidth;
            ctx.beginPath();
            ctx.moveTo(cursorX, lineY - 15);
            ctx.lineTo(cursorX, lineY + 15);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    clear() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.width, this.height);
        }
        this.particles = [];
        this.noteFlashes = [];
    }
}

const visuals = new Visuals();
