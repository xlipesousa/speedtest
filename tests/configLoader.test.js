const { loadConfig, DEFAULT_CONFIG, _internal } = require("../src/configLoader");

describe("configLoader", () => {
  test("retorna configuração normalizada quando fetch responde ok", async () => {
    const mockConfig = {
      defaultSettings: { time_dl_max: 10 },
      ui: {
        labels: { start: "GO", abort: "STOP" },
        statusMessages: { idle: "Ready", running: "Running", complete: "Done", aborted: "Stopped", error: "Error" }
      },
      telemetry: { enabled: true, endpoint: "/telemetry" }
    };
    const mockFetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockConfig)
    }));

    const result = await loadConfig("/config.json", { fetchImpl: mockFetch });

    expect(result.usedFallback).toBe(false);
    expect(result.config.defaultSettings.time_dl_max).toBe(10);
    expect(result.config.ui.labels.start).toBe("GO");
    expect(result.config.ui.statusMessages.running).toBe("Running");
    expect(result.config.telemetry.enabled).toBe(true);
  });

  test("usa fallback quando fetch falha", async () => {
    const error = new Error("network");
    const mockFetch = jest.fn(() => Promise.reject(error));

    const result = await loadConfig("/config.json", { fetchImpl: mockFetch });

    expect(result.usedFallback).toBe(true);
    expect(result.config).toEqual(_internal.cloneDefaultConfig());
    expect(result.error).toBe(error);
  });

  test("normaliza estrutura mesmo com campos inválidos", async () => {
    const mockFetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ defaultSettings: null, ui: null, telemetry: null })
    }));

    const result = await loadConfig("/config.json", { fetchImpl: mockFetch });

    expect(result.config.defaultSettings).toEqual({});
    expect(result.config.ui.labels.start).toBe(DEFAULT_CONFIG.ui.labels.start);
    expect(result.config.ui.statusMessages.idle).toBe(DEFAULT_CONFIG.ui.statusMessages.idle);
    expect(result.config.telemetry.enabled).toBe(false);
  });
});
