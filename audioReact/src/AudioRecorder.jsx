import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabaseClient";

// Duración máxima permitida por audio, en segundos
const MAX_DURATION = 30;

export default function AudioRecorder() {
  const [status, setStatus] = useState("idle"); // idle | recording | recorded | sending | sent
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioBlobRef = useRef(null);

  useEffect(() => {
    // Limpieza al desmontar: para el micrófono y libera memoria
    return () => {
      stopStream();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // mimeType: el navegador elige el mejor soportado (webm en la mayoría, mp4 en Safari/iOS)
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        audioBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setStatus("recorded");
        stopStream();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev + 1 >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setError(
        "No se pudo acceder al micrófono. Revisá los permisos del navegador."
      );
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  function discardRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    audioBlobRef.current = null;
    setStatus("idle");
    setSeconds(0);
  }

  async function sendRecording() {
    if (!audioBlobRef.current) return;
    setStatus("sending");
    setError(null);
    try {
      const blob = audioBlobRef.current;
      const ext = blob.type.includes("webm") ? "webm" : "mp4";
      // Nombre único: timestamp + número random, para que nunca se pisen
      const fileName = `${Date.now()}-${Math.floor(Math.random() * 100000)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("audios")
        .upload(fileName, blob, {
          contentType: blob.type,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      setStatus("sent");
      setTimeout(() => {
        discardRecording();
      }, 2000);
    } catch (err) {
      setError("No se pudo enviar el audio. Probá de nuevo.");
      setStatus("recorded");
    }
  }

  function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  const progress = Math.min((seconds / MAX_DURATION) * 100, 100);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Encabezado tipo radio */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "recording" ? "bg-red-500 animate-pulse" : "bg-neutral-700"
            }`}
          />
          <span className="text-neutral-400 text-xs tracking-widest uppercase">
            {status === "recording" ? "Grabando" : "Enviá tu audio"}
          </span>
        </div>

        <div className="bg-neutral-900 rounded-2xl p-8 border border-neutral-800">
          {/* Timer */}
          <div className="text-center mb-6">
            <span className="text-4xl font-mono text-white tabular-nums">
              {formatTime(seconds)}
            </span>
            <span className="text-neutral-500 text-sm ml-2">
              / {formatTime(MAX_DURATION)}
            </span>
          </div>

          {/* Barra de progreso */}
          <div className="h-1 bg-neutral-800 rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Reproductor, solo si ya grabó */}
          {audioUrl && (status === "recorded" || status === "sending" || status === "sent") && (
            <audio
              controls
              src={audioUrl}
              className="w-full mb-6"
              style={{ height: "40px" }}
            />
          )}

          {/* Botones según estado */}
          <div className="flex items-center justify-center gap-4">
            {status === "idle" && (
              <button
                onClick={startRecording}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 active:scale-95 transition flex items-center justify-center"
                aria-label="Grabar"
              >
                <span className="w-5 h-5 rounded-full bg-white" />
              </button>
            )}

            {status === "recording" && (
              <button
                onClick={stopRecording}
                className="w-16 h-16 rounded-full bg-white hover:bg-neutral-200 active:scale-95 transition flex items-center justify-center"
                aria-label="Detener"
              >
                <span className="w-5 h-5 bg-neutral-900 rounded-sm" />
              </button>
            )}

            {status === "recorded" && (
              <>
                <button
                  onClick={discardRecording}
                  className="px-4 py-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition text-sm"
                >
                  Descartar
                </button>
                <button
                  onClick={sendRecording}
                  className="px-6 py-3 rounded-lg bg-red-500 hover:bg-red-400 active:scale-95 transition text-white font-medium text-sm"
                >
                  Enviar al aire
                </button>
              </>
            )}

            {status === "sending" && (
              <span className="text-neutral-400 text-sm">Enviando…</span>
            )}

            {status === "sent" && (
              <span className="text-green-400 text-sm font-medium">
                ¡Listo, tu audio llegó!
              </span>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center mt-4">{error}</p>
          )}
        </div>

        <p className="text-neutral-600 text-xs text-center mt-6">
          Máximo {MAX_DURATION} segundos por audio
        </p>
      </div>
    </div>
  );
}