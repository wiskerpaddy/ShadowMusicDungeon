/**
 * ShadowDungeon Audio Engine v3.0 (Multi-Track Edition)
 * 全11セクションの解説に対応。テリーのワンダーランド風の多重演奏を実現。
 */
export const AudioEngine = {
    // --- 1. 基本プロパティと状態管理 ---
    audioCtx: null,
    timers: {}, // 複数のタイマーをトラック（type）ごとに管理
    isMuted: false,
    isPianoMode: false, // UI切り替え用
    isSaxMode: false,   // UI切り替え用
    baseBPM: 100, 
    currentBPM: 100,
    masterVolume: -10,

    // --- 2. 空間演出：リバーブ ---
    reverb: new Tone.Reverb({
        decay: 0.8,
        preDelay: 0.01
    }).toDestination(),

    // 楽器の再定義（発音数とキレを重視）
    piano: new Tone.Sampler({
        urls: { A1: "A1.mp3", A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3" },
        baseUrl: "https://tonejs.github.io/audio/salamander/",
        release: 0.5, // 音が消えるのを防ぐため、余韻を少し短く
        volume: -5    // ピアノが目立ちすぎないよう調整
    }),
    
    sax: new Tone.Sampler({
        urls: { "A3": "A3.mp3", "C4": "C4.mp3", "E4": "E4.mp3", "G4": "G4.mp3" },
        baseUrl: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/alto_sax-mp3/",
        attack: 0, 
        release: 0.2, 
        curve: "step",
        // サックス独自のピッチズレを修正（30セントほど下げて微調整）
        detune: -30 
    }),
    synth: new Tone.PolySynth(Tone.Synth),

    // --- 4. ブラウザの制限を突破する初期化 ---
    initCtx() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        Tone.start();
        
        // 全楽器を出口（Destination）へ接続
        this.piano.toDestination();
        this.synth.toDestination();
        
        // SAXは直音とリバーブ（20%）をミックス
        this.reverb.wet.value = 0.2;
        this.sax.connect(this.reverb);
        this.sax.toDestination();

        Tone.Destination.volume.value = this.masterVolume;
    },

    // --- 5 & 6. BPM理論と時間軸の制御 ---
    get tempoMultiplier() {
        return this.baseBPM / this.currentBPM;
    },

    /**
     * 7 & 8. トラック再生コアロジック
     * startTimeを使用することで、JavaScriptのタイマー誤差を無視して完璧に同期。
     */
    playTrack(track, type, index = 0, startTime = null) {
        if (this.isMuted || !track || track.length === 0) return;
        if (!startTime) startTime = Tone.now() + 0.1;

        const note = track[index % track.length];
        const nextTick = note.dur * this.tempoMultiplier;

        if (note.freq > 0) {
            let instrument = (type === 'sax') ? this.sax : (type === 'piano') ? this.piano : this.synth;
            let finalFreq = this.applyPitchCorrection(note.freq);
            
            // サックスの移調（音程を合わせるための重要な補正）
            // freq を直接いじるのではなく、detune プロパティを活用
            instrument.triggerAttackRelease(finalFreq, nextTick, startTime, 0.6);
        }

        const nextStartTime = startTime + nextTick;
        this.timers[type] = setTimeout(() => {
            this.playTrack(track, type, (index + 1) % track.length, nextStartTime);
        }, nextTick * 1000);
    },

    // --- 10. 操作系：BPMと対数ボリューム ---
    setBPM(bpm) { 
        this.currentBPM = bpm; 
    },
    
    setVolume(val) {
        this.masterVolume = Tone.gainToDb(val);
        // rampToで滑らかに変化させ、不快なクリックノイズを防止
        Tone.Destination.volume.rampTo(this.masterVolume, 0.1);
    },

    // --- 11. 周波数補正：サンプラーの音割れ防止 ---
    applyPitchCorrection(freq) {
        if (freq > 1200) return freq / 8;
        if (freq > 600) return freq / 4;
        if (freq > 300) return freq / 2;
        return freq;
    },

    stopAll() {
        Object.values(this.timers).forEach(t => clearTimeout(t));
        this.timers = {};
        Tone.Transport.stop();
    }
};