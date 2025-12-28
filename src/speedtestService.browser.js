import "./speedtestService.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;
const api = globalScope.SpeedtestService;

if (!api || typeof api.createSpeedtestService !== "function"){
  throw new Error("SpeedtestService não disponível no escopo global");
}

const { createSpeedtestService } = api;

export { createSpeedtestService };
