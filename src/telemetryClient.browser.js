import "./telemetryClient.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;
const api = globalScope.SpeedtestTelemetry;

if (!api || typeof api.createTelemetryClient !== "function"){
  throw new Error("SpeedtestTelemetry não disponível no escopo global");
}

const { createTelemetryClient, DEFAULT_OPTIONS } = api;

export { createTelemetryClient, DEFAULT_OPTIONS };
