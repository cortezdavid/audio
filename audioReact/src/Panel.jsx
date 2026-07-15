import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

const PANEL_PASSWORD = import.meta.env.VITE_PANEL_PASSWORD;

export default function Panel() {
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const [audios, setAudios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const fetchAudios = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.storage
        .from("audios")
        .list("", {
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) throw error;

      const withUrls = (data || [])
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((f) => {
          const { data: urlData } = supabase.storage
            .from("audios")
            .getPublicUrl(f.name);
          return {
            name: f.name,
            createdAt: f.created_at,
            sizeKb: f.metadata?.size ? Math.round(f.metadata.size / 1024) : null,
            url: urlData.publicUrl,
          };
        });

      setAudios(withUrls);
    } catch (err) {
      setLoadError("No se pudieron cargar los audios. Probá recargar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unlocked) fetchAudios();
  }, [unlocked, fetchAudios]);

  function handlePasswordSubmit(e) {
    e.preventDefault();
    if (passwordInput === PANEL_PASSWORD) {
      setUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  }

  async function deleteAudio(name) {
    const confirmDelete = window.confirm(`¿Borrar "${name}"?`);
    if (!confirmDelete) return;
    const { error } = await supabase.storage.from("audios").remove([name]);
    if (!error) {
      setAudios((prev) => prev.filter((a) => a.name !== name));
    }
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <form
          onSubmit={handlePasswordSubmit}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 w-full max-w-xs"
        >
          <h1 className="text-white text-lg font-medium mb-1">Panel</h1>
          <p className="text-neutral-500 text-sm mb-6">Acceso restringido</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              setPasswordError(false);
            }}
            placeholder="Contraseña"
            autoFocus
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm mb-3 outline-none focus:border-red-500"
          />
          {passwordError && (
            <p className="text-red-400 text-xs mb-3">Contraseña incorrecta.</p>
          )}
          <button
            type="submit"
            className="w-full bg-red-500 hover:bg-red-400 text-white text-sm font-medium py-2 rounded-lg transition"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-white text-xl font-medium">
            Audios recibidos{" "}
            <span className="text-neutral-500 text-sm font-normal">
              ({audios.length})
            </span>
          </h1>
          <button
            onClick={fetchAudios}
            className="text-neutral-400 hover:text-white text-sm border border-neutral-800 rounded-lg px-3 py-1.5 transition"
          >
            Actualizar
          </button>
        </div>

        {loading && (
          <p className="text-neutral-500 text-sm">Cargando…</p>
        )}

        {loadError && (
          <p className="text-red-400 text-sm">{loadError}</p>
        )}

        {!loading && audios.length === 0 && !loadError && (
          <p className="text-neutral-600 text-sm">
            Todavía no llegó ningún audio.
          </p>
        )}

        <div className="space-y-3">
          {audios.map((audio) => (
            <div
              key={audio.name}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-400 text-xs">
                  {formatDate(audio.createdAt)}
                  {audio.sizeKb ? ` · ${audio.sizeKb} KB` : ""}
                </span>
                <button
                  onClick={() => deleteAudio(audio.name)}
                  className="text-neutral-600 hover:text-red-400 text-xs transition"
                >
                  Borrar
                </button>
              </div>
              <audio controls src={audio.url} className="w-full" style={{ height: "40px" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}