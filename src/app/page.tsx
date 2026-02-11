"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RunRecord = {
  id: string;
  score: number;
  clicks: number;
  dodges: number;
  durationMs: number;
  ending: string;
  createdAt: number;
};

const LS_KEY = "already_late_leaderboard_v1";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function loadBoard(): RunRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RunRecord[];
  } catch {
    return [];
  }
}

function saveBoard(list: RunRecord[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export default function Home() {
  const maxStep = 6;

  const bgColor = [
    "bg-white",
    "bg-gray-200",
    "bg-gray-400",
    "bg-gray-600",
    "bg-gray-800",
    "bg-black",
    "bg-black",
  ];

  const messages = [
    "누르지 마세요",
    "…누르셨네요",
    "조금씩 어두워지고 있습니다",
    "이미 늦은 것 같습니다",
    "시스템 안정성 저하 감지",
    "ERROR: Life Motivation Not Found",
    "엔딩 처리 중…",
  ];

  const logs = [
    "Initializing life system...",
    "Checking motivation...",
    "Motivation level: LOW",
    "Stability decreasing...",
    "Warning: Future uncertainty detected",
    "Critical error occurred",
  ];

  // ====== state ======
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState({ x: 50, y: 55 });
  const [glitchOn, setGlitchOn] = useState(false);

  // 점수/기록
  const [clicks, setClicks] = useState(0);
  const [dodges, setDodges] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);

  // 엔딩 분기
  const [endingType, setEndingType] = useState<"A" | "B" | "C">("A");

  // 랭킹
  const [board, setBoard] = useState<RunRecord[]>([]);

  // 모바일/포인터
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  // 사운드
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const bgOscRef = useRef<OscillatorNode | null>(null);
  const bgGainRef = useRef<GainNode | null>(null);

  // 커서 잔상
  const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 });
  const [cursorTrail, setCursorTrail] = useState({ x: -999, y: -999 });

  // ====== derived ======
  const doomPercent = Math.round((step / maxStep) * 100);

  const durationMs = useMemo(() => {
    if (!startedAt) return 0;
    const end = endedAt ?? Date.now();
    return Math.max(0, end - startedAt);
  }, [startedAt, endedAt]);

  const score = useMemo(() => {
    // 점수 철학(무의미하게 진지함):
    // - 클릭이 많을수록(망함을 가속) 점수 상승
    // - 도망을 많이 “당할수록” 점수 상승(인생이 흔들림)
    // - 너무 오래 버티면 약간 감점(현실 도피)
    const clickScore = clicks * 120;
    const dodgeScore = dodges * 180;
    const timePenalty = Math.floor(durationMs / 1000) * 3; // 1초당 -3
    return Math.max(0, clickScore + dodgeScore - timePenalty);
  }, [clicks, dodges, durationMs]);

  const buttonTransition = useMemo(() => {
    if (step <= 2) return "duration-250";
    if (step <= 4) return "duration-200";
    return "duration-160";
  }, [step]);

  const buttonScale = useMemo(() => {
    const map = [1.0, 1.0, 0.96, 0.9, 0.83, 0.76, 0.7];
    return map[step] ?? 1.0;
  }, [step]);

  // ====== helpers ======
  const moveButtonRandomly = () => {
    // 상단 메시지/로그 영역 피하기 위해 y 제한
    const x = Math.floor(18 + Math.random() * 64); // 18~82
    const y = Math.floor(36 + Math.random() * 50); // 36~86
    setPos({ x, y });
  };

  const pulseGlitch = (ms = 110) => {
    setGlitchOn(true);
    window.setTimeout(() => setGlitchOn(false), ms);
  };

  // ---- audio (WebAudio) ----
  const ensureAudio = () => {
    if (muted) return null;
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
    return audioRef.current;
  };

  const beep = (freq: number, ms: number, gain = 0.06) => {
    const ctx = ensureAudio();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.01);
    g.gain.linearRampToValueAtTime(0.0001, now + ms / 1000);
    o.start(now);
    o.stop(now + ms / 1000 + 0.02);
  };

  const startBgHum = () => {
    const ctx = ensureAudio();
    if (!ctx) return;
    if (bgOscRef.current) return;

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 48;
    g.gain.value = 0.0;

    o.connect(g);
    g.connect(ctx.destination);
    o.start();

    bgOscRef.current = o;
    bgGainRef.current = g;
  };

  const stopBgHum = () => {
    try {
      bgGainRef.current?.gain.setValueAtTime(
        0.0,
        audioRef.current?.currentTime ?? 0
      );
      bgOscRef.current?.stop();
    } catch {}
    bgOscRef.current = null;
    bgGainRef.current = null;
  };

  const setBgIntensity = (s: number) => {
    const ctx = audioRef.current;
    const g = bgGainRef.current;
    const o = bgOscRef.current;
    if (!ctx || !g || !o || muted) return;

    const now = ctx.currentTime;
    const level =
      s < 3 ? 0.0 : s === 3 ? 0.015 : s === 4 ? 0.03 : s === 5 ? 0.05 : 0.06;
    const freq = 42 + s * 7;

    o.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(level, now + 0.15);
  };

  // ====== lifecycle ======
  useEffect(() => {
    // coarse pointer(모바일/태블릿) 감지
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setIsCoarsePointer(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    // 랭킹 로드
    setBoard(loadBoard());
  }, []);

  useEffect(() => {
    // 공유 링크로 step 세팅 (?s=3)
    const url = new URL(window.location.href);
    const s = url.searchParams.get("s");
    if (!s) return;
    const parsed = Number(s);
    if (Number.isNaN(parsed)) return;
    const clamped = clamp(parsed, 0, maxStep);
    setStep(clamped);
  }, []);

  useEffect(() => {
    // mouse move → trail
    const onMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    if (step < 4) return;
    const t = setInterval(() => {
      setCursorTrail((prev) => {
        const dx = cursorPos.x - prev.x;
        const dy = cursorPos.y - prev.y;
        const factor = step === 4 ? 0.18 : step === 5 ? 0.12 : 0.09;
        return { x: prev.x + dx * factor, y: prev.y + dy * factor };
      });
    }, 16);
    return () => clearInterval(t);
  }, [step, cursorPos]);

  useEffect(() => {
    // step 5부터 자동 glitch
    if (step < 5) return;
    const t = setInterval(() => pulseGlitch(90), 1800);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    // step 3부터 자동 이동(조금 덜 도망가게: 빈도 낮춤)
    if (step < 3 || step >= maxStep) return;

    const ms = step < 5 ? 2800 : 2100;
    const t = setInterval(() => moveButtonRandomly(), ms);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    // BGM 켜기/강도 조절
    if (muted) {
      stopBgHum();
      return;
    }
    startBgHum();
    setBgIntensity(step);
    return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, muted]);

  useEffect(() => {
    // 엔딩 들어가면 종료시간 찍고 기록 저장
    if (step !== maxStep) return;

    const end = Date.now();
    setEndedAt(end);

    // 엔딩 타입 결정(랜덤 + 약간의 조건)
    const r = Math.random();
    const type: "A" | "B" | "C" =
      score >= 1200 ? "C" : r < 0.5 ? "A" : r < 0.8 ? "B" : "C";
    setEndingType(type);

    // 기록 저장(로컬스토리지)
    const record: RunRecord = {
      id: crypto.randomUUID?.() ?? String(Math.random()).slice(2),
      score,
      clicks,
      dodges,
      durationMs: Math.max(0, end - (startedAt ?? end)),
      ending: type,
      createdAt: end,
    };

    const cur = loadBoard();
    const next = [record, ...cur]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    saveBoard(next);
    setBoard(next);

    // 엔딩 음
    beep(220, 160, 0.06);
    beep(110, 220, 0.05);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ====== interactions ======
  const ensureStarted = () => {
    if (!startedAt) setStartedAt(Date.now());
  };

  const handleClick = () => {
    ensureStarted();

    // 클릭음
    if (step <= 2) beep(880, 40, 0.04);
    else beep(660, 40, 0.04);

    setClicks((v) => v + 1);

    setStep((prev) => {
      const next = Math.min(prev + 1, maxStep);
      if (next >= 3 && next < maxStep) moveButtonRandomly();
      return next;
    });

    if (step >= 4) pulseGlitch(120);
  };

  // 데스크톱: hover 도망 (덜 도망가게 확률 낮춤)
  const handleMouseEnter = () => {
    if (isCoarsePointer) return; // 모바일은 hover 개념 X
    if (step >= 4 && step < maxStep) {
      if (Math.random() < 0.35) {
        setDodges((v) => v + 1);
        moveButtonRandomly();
        beep(520, 30, 0.03);
      }
    }
  };

  // 모바일/터치: 누르려는 순간 도망(가끔)
  const handlePointerDown = () => {
    if (!isCoarsePointer) return;
    if (step >= 4 && step < maxStep) {
      if (Math.random() < 0.4) {
        setDodges((v) => v + 1);
        moveButtonRandomly();
        pulseGlitch(90);
        beep(520, 40, 0.03);
      }
    }
  };

  // ====== report ======
  const report = useMemo(() => {
    // “무의미하게 진지한” 보고서 생성
    const dodgeRate =
      clicks === 0 ? 0 : Math.round((dodges / Math.max(1, clicks)) * 100);
    const timeSec = Math.max(1, Math.floor(durationMs / 1000));
    const pressPerSec = (clicks / timeSec).toFixed(2);

    const seriousness = score >= 1500 ? "위기" : score >= 900 ? "주의" : "관찰";
    const personality =
      pressPerSec >= "0.80"
        ? "충동형(impulsive)"
        : pressPerSec >= "0.45"
        ? "집요형(persistent)"
        : "관망형(observant)";

    const line1 = `1) 안정성 등급: ${seriousness} (Score=${score})`;
    const line2 = `2) 입력 패턴: ${personality} / 클릭 빈도 ${pressPerSec}회/초`;
    const line3 = `3) 회피 반응: 도망 유도율 ${dodgeRate}% (dodges=${dodges})`;
    const line4 = `4) 체류 시간: ${formatMs(durationMs)} — "늦었는데도 머무름" 지표 상승`;
    const line5 =
      score >= 1200
        ? `5) 소견: 이미 늦었지만, 늦은 걸 인지하고도 눌렀습니다. (고급 망함)`
        : `5) 소견: 늦었다는 경고를 '가벼운 조언'으로 분류했습니다. (일반 망함)`;

    const extra =
      endingType === "C"
        ? `\n부록: 시스템이 당신을 선택했습니다. (축하인지 저주인지 모름)`
        : endingType === "B"
        ? `\n부록: 회복 가능성은… 글쎄요.`
        : `\n부록: 그래도 잘 살고 있습니다(아마도).`;

    return [line1, line2, line3, line4, line5].join("\n") + extra;
  }, [clicks, dodges, durationMs, score, endingType]);

  // ====== share/reset ======
  const reset = () => {
    setStep(0);
    setPos({ x: 50, y: 55 });
    setGlitchOn(false);

    setClicks(0);
    setDodges(0);
    setStartedAt(null);
    setEndedAt(null);
    setEndingType("A");

    const url = new URL(window.location.href);
    url.searchParams.delete("s");
    window.history.replaceState({}, "", url.toString());

    beep(880, 40, 0.03);
  };

  const copyShareLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("s", String(step));
      await navigator.clipboard.writeText(url.toString());
      alert("링크 복사됨 ㅋㅋ");
      beep(990, 40, 0.03);
    } catch {
      alert("복사 실패… 브라우저 권한 문제일 수도 있음");
    }
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      alert("망함 보고서 복사됨");
      beep(740, 40, 0.03);
    } catch {
      alert("복사 실패…");
    }
  };

  const clearBoard = () => {
    localStorage.removeItem(LS_KEY);
    setBoard([]);
    beep(220, 80, 0.03);
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (next) stopBgHum();
      return next;
    });
  };

  // ====== ending text ======
  const endingTitle =
    endingType === "A"
      ? "그래도 잘 살고 있습니다."
      : endingType === "B"
      ? "회복 가능성 평가 중…"
      : "시스템이 당신을 선택했습니다.";

  const endingSub =
    endingType === "A"
      ? "(근데 왜 여기까지 눌렀냐 ㅋㅋ)"
      : endingType === "B"
      ? "…잠깐만요. 로그가 너무 많습니다."
      : "이제 도망쳐도 늦었습니다.";

  return (
    <main
      suppressHydrationWarning
      className={`min-h-screen relative overflow-hidden transition-all duration-700 ${
        bgColor[step]
      } ${glitchOn ? "glitch" : ""} ${
        step >= 4 ? "animate-pulse" : ""
      } text-white`}
    >
      {/* 상단 좌측: 망함 지수 + 상태 */}
      <div className="absolute top-6 left-6 z-40 w-[min(300px,72vw)]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-white/70 font-mono">
            망함 지수: {doomPercent}% · score {score}
          </div>
          <button
            onClick={toggleMute}
            className="text-xs font-mono px-2 py-1 rounded-md border border-white/30 bg-black/40 hover:bg-white hover:text-black transition pointer-events-auto"
          >
            {muted ? "SOUND OFF" : "SOUND ON"}
          </button>
        </div>

        <div className="mt-2 h-3 w-full rounded-full bg-white/15 overflow-hidden border border-white/20">
          <div
            className="h-full bg-white/70 transition-all duration-300"
            style={{ width: `${(step / maxStep) * 100}%` }}
          />
        </div>

        <div className="mt-2 text-[11px] text-white/55 font-mono">
          clicks {clicks} · dodges {dodges} · time {formatMs(durationMs)}
        </div>
      </div>

      {/* 메시지/로그(상단 중앙 고정) */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[min(560px,92vw)] text-center z-30 pointer-events-none">
        <p className="text-lg font-mono">{messages[step]}</p>

        {step >= 3 && (
          <div className="mt-6 text-sm font-mono text-left bg-black/70 border border-white/70 p-4 rounded-xl">
            {logs.slice(0, Math.min(step, logs.length)).map((log, i) => (
              <p key={i}>&gt; {log}</p>
            ))}
          </div>
        )}
      </div>

      {/* 커서 잔상(step>=4) */}
      {step >= 4 && !isCoarsePointer && (
        <div
          className="fixed z-30 pointer-events-none"
          style={{
            left: cursorTrail.x,
            top: cursorTrail.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="w-10 h-10 rounded-full border border-white/50 bg-white/5 backdrop-blur-sm" />
        </div>
      )}

      {/* 도망 버튼 (엔딩에서는 숨김) */}
      {step < maxStep && (
        <button
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onPointerDown={handlePointerDown}
          className={`absolute z-20 px-6 py-4 text-xl font-semibold border border-white rounded-xl bg-black hover:bg-white hover:text-black transition ${buttonTransition}`}
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transform: `translate(-50%, -50%) scale(${buttonScale})`,
            touchAction: "manipulation",
          }}
        >
          누르지 마세요
        </button>
      )}

      {/* 안내문 */}
      {step === 0 && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-500 text-sm z-20">
          (진짜로 누르지 마세요)
        </p>
      )}

      {/* 엔딩 화면 */}
      {step === maxStep && (
        <div className="absolute inset-0 flex items-center justify-center z-50 px-4">
          <div className="w-[min(720px,96vw)] bg-black/70 border border-white/70 rounded-2xl p-6 text-center">
            <p className="text-2xl font-mono">{endingTitle}</p>
            <p className="mt-2 text-sm text-white/70">{endingSub}</p>

            {/* 망함 보고서 */}
            <div className="mt-6 text-left bg-black/60 border border-white/30 rounded-xl p-4 font-mono text-sm whitespace-pre-wrap">
              <div className="text-white/80 mb-2">[망함 보고서 v1.0]</div>
              {report}
            </div>

            {/* 랭킹 */}
            <div className="mt-6 text-left">
              <div className="flex items-center justify-between">
                <div className="font-mono text-white/80">[로컬 랭킹 Top 10]</div>
                <button
                  onClick={clearBoard}
                  className="text-xs font-mono px-2 py-1 rounded-md border border-white/30 bg-black/40 hover:bg-white hover:text-black transition pointer-events-auto"
                >
                  랭킹 초기화
                </button>
              </div>

              <div className="mt-2 overflow-hidden rounded-xl border border-white/20">
                <div className="grid grid-cols-12 bg-white/10 text-xs font-mono p-2 text-white/80">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">score</div>
                  <div className="col-span-2">click</div>
                  <div className="col-span-2">dodge</div>
                  <div className="col-span-2">time</div>
                  <div className="col-span-2">ending</div>
                </div>

                {board.length === 0 ? (
                  <div className="p-3 text-sm text-white/60 font-mono">
                    아직 기록이 없습니다. (하지만 곧 생길 예정)
                  </div>
                ) : (
                  board.map((r, idx) => (
                    <div
                      key={r.id}
                      className="grid grid-cols-12 p-2 text-xs font-mono border-t border-white/10 text-white/75"
                    >
                      <div className="col-span-1">{idx + 1}</div>
                      <div className="col-span-3">{r.score}</div>
                      <div className="col-span-2">{r.clicks}</div>
                      <div className="col-span-2">{r.dodges}</div>
                      <div className="col-span-2">{formatMs(r.durationMs)}</div>
                      <div className="col-span-2">{r.ending}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center pointer-events-auto">
              <button
                onClick={reset}
                className="px-5 py-3 rounded-xl border border-white bg-white text-black hover:bg-black hover:text-white transition"
              >
                다시 살아보기(리셋)
              </button>

              <button
                onClick={copyShareLink}
                className="px-5 py-3 rounded-xl border border-white bg-black hover:bg-white hover:text-black transition"
              >
                이 상태 링크 복사
              </button>

              <button
                onClick={copyReport}
                className="px-5 py-3 rounded-xl border border-white bg-black hover:bg-white hover:text-black transition"
              >
                망함 보고서 복사
              </button>
            </div>
          </div>
        </div>
      )}

      {/* glitch CSS */}
      <style jsx global>{`
        .glitch {
          filter: contrast(1.2) saturate(1.2);
          animation: glitchFlash 120ms linear;
        }
        @keyframes glitchFlash {
          0% {
            transform: translate(0, 0);
          }
          20% {
            transform: translate(2px, -1px);
          }
          40% {
            transform: translate(-2px, 1px);
          }
          60% {
            transform: translate(1px, 2px);
          }
          80% {
            transform: translate(-1px, -2px);
          }
          100% {
            transform: translate(0, 0);
          }
        }
      `}</style>
    </main>
  );
}
