import "./configLoader.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;
const api = globalScope.SpeedtestConfig;

if (!api || typeof api.loadConfig !== "function"){
  throw new Error("SpeedtestConfig não disponível no escopo global");
}

const { loadConfig, DEFAULT_CONFIG } = api;

export { loadConfig, DEFAULT_CONFIG };
