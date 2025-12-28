import "./uiController.js";

const globalScope = typeof window !== "undefined" ? window : globalThis;
const api = globalScope.SpeedtestUI;

if (!api || typeof api.createUIController !== "function"){
  throw new Error("SpeedtestUI não disponível no escopo global");
}

const { createUIController } = api;

export { createUIController };
