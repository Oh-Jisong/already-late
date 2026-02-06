"use client";
import { useEffect, useMemo, useState } from "react";

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
    "그래도 잘 살고 있습니다",
  ];

  const logs = [
    "Initializing life system...",
    "Checking motivation...",
    "Motivation level: LOW",
    "Stability decreasing...",
    "Warning: Future uncertainty detected",
    "Critical error occurred",
  ];

  const [step, setStep] = useState(0);
  const [pos, setPos] = useState({ x: 50, y: 55 });
  const [glitchOn, setGlitchOn] = useState(false);

  // ✅ 공유 링크로 들어오면 step 세팅 (?s=3 같은거)
  useEffect(() => {
    const url = new URL(window.location.href);
    const s = url.searchParams.get("s");
    if (!s) return;

    const parsed = Number(s);
    if (Number.isNaN(parsed)) return;

    const clamped = Math.max(0, Math.min(maxStep, parsed));
    setStep(clamped);
  }, []);

  const moveButtonRandomly = () => {
    const x = Math.floor(20 + Math.random() * 60); // 20~80
    const y = Math.floor(35 + Math.random() * 50); // 35~85 (상단 메시지 영역 피함)
    setPos({ x, y });
  };

  const handleClick = () => {
    setStep((prev) => {
      const next = Math.min(prev + 1, maxStep);
      if (next >= 3) moveButtonRandomly();
      return next;
    });

    if (step >= 4) {
      setGlitchOn(true);
      window.setTimeout(() => setGlitchOn(false), 120);
    }
  };

  const handleMouseEnter = () => {
    if (step >= 4) {
      if (Math.random() < 0.5) moveButtonRandomly();
    }
  };

  const buttonTransition = useMemo(() => {
    if (step <= 2) return "duration-300";
    if (step <= 4) return "duration-200";
    return "duration-150";
  }, [step]);

  // 자동 이동(느리게) — step 3부터
  useEffect(() => {
    if (step < 3) return;

    const ms = step < 5 ? 2500 : 1800;
    const t = setInterval(() => moveButtonRandomly(), ms);
    return () => clearInterval(t);
  }, [step]);

  // 버튼이 단계 올라갈수록 작아짐
  const buttonScale = useMemo(() => {
    const map = [1.0, 1.0, 0.95, 0.9, 0.82, 0.74, 0.66];
    return map[step] ?? 1.0;
  }, [step]);

  // 커서 잔상(느려 보이게)
  const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 });
  const [cursorTrail, setCursorTrail] = useState({ x: -999, y: -999 });

  useEffect(() => {
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
        const factor = step === 4 ? 0.18 : step === 5 ? 0.12 : 0.08;
        return { x: prev.x + dx * factor, y: prev.y + dy * factor };
      });
    }, 16);

    return () => clearInterval(t);
  }, [step, cursorPos]);

  // 지속 glitch: step 5부터 가끔 자동 번쩍
  useEffect(() => {
    if (step < 5) return;

    const t = setInterval(() => {
      setGlitchOn(true);
      window.setTimeout(() => setGlitchOn(false), 90);
    }, 1800);

    return () => clearInterval(t);
  }, [step]);

  // ✅ 리셋
  const reset = () => {
    setStep(0);
    setPos({ x: 50, y: 55 });
    setGlitchOn(false);

    const url = new URL(window.location.href);
    url.searchParams.delete("s");
    window.history.replaceState({}, "", url.toString());
  };

  // ✅ 공유 링크 복사 (현재 step을 ?s=step으로)
  const copyShareLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("s", String(step));
      await navigator.clipboard.writeText(url.toString());
      alert("링크 복사됨 ㅋㅋ");
    } catch {
      alert("복사 실패… 브라우저 권한 문제일 수도 있음");
    }
  };

  return (
    <main
      suppressHydrationWarning
      className={`min-h-screen relative overflow-hidden transition-all duration-700 ${
        bgColor[step]
      } text-white ${step >= 4 ? "animate-pulse" : ""} ${glitchOn ? "glitch" : ""}`}
    >
      {/* 망함 지수 */}
      <div className="absolute top-6 left-6 z-30 w-[min(260px,70vw)]">
        <div className="text-xs text-white/70 font-mono mb-2">
          망함 지수: {Math.round((step / maxStep) * 100)}%
        </div>
        <div className="h-3 w-full rounded-full bg-white/15 overflow-hidden border border-white/20">
          <div
            className="h-full bg-white/70 transition-all duration-300"
            style={{ width: `${(step / maxStep) * 100}%` }}
          />
        </div>
      </div>
      {/* 메시지/로그: 위쪽 고정 */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[min(520px,92vw)] text-center z-20 pointer-events-none">
        <p className="text-lg font-mono">{messages[step]}</p>

        {step >= 3 && (
          <div className="mt-6 text-sm font-mono text-left bg-black/70 border border-white/70 p-4 rounded-xl">
            {logs.slice(0, Math.min(step, logs.length)).map((log, i) => (
              <p key={i}>&gt; {log}</p>
            ))}
          </div>
        )}
      </div>

      {/* 커서 잔상 */}
      {step >= 4 && (
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

      {/* 도망 버튼 (엔딩 step에서는 숨김) */}
      {step < maxStep && (
        <button
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          className={`absolute z-10 px-6 py-4 text-xl font-semibold border border-white rounded-xl bg-black hover:bg-white hover:text-black transition ${buttonTransition}`}
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transform: `translate(-50%, -50%) scale(${buttonScale})`,
          }}
        >
          누르지 마세요
        </button>
      )}

      {/* 엔딩 화면 */}
      {step === maxStep && (
        <div className="absolute inset-0 flex items-center justify-center z-40">
          <div className="w-[min(520px,92vw)] bg-black/70 border border-white/70 rounded-2xl p-6 text-center">
            <p className="text-xl font-mono">그래도 잘 살고 있습니다.</p>
            <p className="mt-2 text-sm text-white/70">
              (근데 왜 여기까지 눌렀냐 ㅋㅋ)
            </p>

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
                이 상태로 링크 복사(공유)
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 0 && (
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-500 text-sm z-20">
          (진짜로 누르지 마세요)
        </p>
      )}
    </main>
  );
}