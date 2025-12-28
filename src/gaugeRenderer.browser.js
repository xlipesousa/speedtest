import "./gaugeRenderer.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;
const api = globalScope.SpeedtestGauge;

if (!api || typeof api.createGauge !== "function"){
  throw new Error("SpeedtestGauge não disponível no escopo global");
}

const { createGauge, calculateGaugeAmount, formatSpeed } = api;

export { createGauge, calculateGaugeAmount, formatSpeed };
