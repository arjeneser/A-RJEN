"use client";
import { useFlightSetup } from "@/store/flight-store";
import { DurationPicker } from "./duration-picker";

export function StepDuration() {
  const { departure, duration, setDuration } = useFlightSetup();

  return (
    <div>
      <div className="mb-6">
        <h2
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          Ne Kadar Odaklanacaksınız?
        </h2>
        <p className="text-slate-400 text-sm">
          <span className="text-white font-medium">{departure?.name}</span>&apos;dan
          kalkış. Oturum sürenizi seçin.
        </p>
      </div>

      <DurationPicker
        value={duration}
        onChange={setDuration}
        accentColor="#1D4ED8"
      />
    </div>
  );
}
