const { createTelemetryClient } = require("../src/telemetryClient");

describe("telemetryClient", () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  test("não envia quando telemetria desativada", async () => {
    const fetchSpy = jest.fn();
    const client = createTelemetryClient({ enabled: false, fetchImpl: fetchSpy });

    const result = await client.send({ aborted: false, snapshot: {} });

    expect(result.skipped).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("ignora eventos abortados", async () => {
    const fetchSpy = jest.fn();
    const client = createTelemetryClient({ enabled: true, endpoint: "/telemetry", fetchImpl: fetchSpy });

    const result = await client.send({ aborted: true, snapshot: {} });

    expect(result.skipped).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("envia payload quando habilitado", async () => {
    const fetchSpy = jest.fn(() => Promise.resolve({ status: 204 }));
    const client = createTelemetryClient({
      enabled: true,
      endpoint: "/telemetry",
      includeIp: true,
      fetchImpl: fetchSpy
    });

    const payload = {
      aborted: false,
      snapshot: {
        dlStatus: "50",
        ulStatus: "20",
        pingStatus: "12",
        jitterStatus: "1",
        clientIp: "8.8.8.8"
      }
    };

    const result = await client.send(payload);

    expect(result.skipped).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/telemetry");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.result.download).toBe("50");
    expect(body.meta.clientIp).toBe("8.8.8.8");
  });
});
