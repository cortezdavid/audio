import { BrowserRouter, Routes, Route } from "react-router-dom";
import AudioRecorder from "./AudioRecorder";
import Panel from "./Panel";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AudioRecorder />} />
        {/* Ruta larga a propósito, para que no sea fácil de adivinar */}
        <Route path="/panel-9f3k2m8x" element={<Panel />} />
      </Routes>
    </BrowserRouter>
  );
}