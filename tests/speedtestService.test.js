const { createSpeedtestService } = require("../src/speedtestService");

describe("speedtestService", () => {
  class FakeSpeedtest {
    constructor() {
      this.parameters = {};
      this.state = 0;
      this.onupdate = null;
      this.onend = null;
      FakeSpeedtest.instances.push(this);
    }

    setParameter(key, value) {
      this.parameters[key] = value;
    }

    getState() {
      return this.state;
    }

    start() {
      this.state = 3;
    }

    abort() {
      this.state = 5;
      if (typeof this.onend === "function") {
        this.onend(true);
      }
    }

    triggerUpdate(payload) {
      if (typeof this.onupdate === "function") {
        this.onupdate(payload);
      }
    }

    triggerEnd(aborted) {
      this.state = aborted ? 5 : 4;
      if (typeof this.onend === "function") {
        this.onend(aborted);
      }
    }
  }
  FakeSpeedtest.instances = [];

  beforeEach(() => {
    FakeSpeedtest.instances = [];
  });

  test("aplica configurações padrão e customizadas antes de iniciar", () => {
    const service = createSpeedtestService({
      SpeedtestCtor: FakeSpeedtest,
      defaultSettings: { time_dl_max: 5 }
    });

    service.start({ time_ul_max: 7 });

    const instance = FakeSpeedtest.instances[0];
    expect(instance).toBeDefined();
    expect(instance.parameters).toEqual({
      time_dl_max: 5,
      time_ul_max: 7
    });
  });

  test("emite eventos start, update e end", () => {
    const service = createSpeedtestService({ SpeedtestCtor: FakeSpeedtest });
    const events = [];

    service.on("start", () => events.push("start"));
    service.on("update", data => events.push(["update", data.testState]));
    service.on("end", ({ aborted }) => events.push(["end", aborted]));

    service.start();

    const instance = FakeSpeedtest.instances[0];
    instance.triggerUpdate({ testState: 1, dlStatus: "42" });
    instance.triggerEnd(false);

    expect(events).toEqual([
      "start",
      ["update", 1],
      ["end", false]
    ]);
  });

  test("abort interrompe teste em andamento", () => {
    const service = createSpeedtestService({ SpeedtestCtor: FakeSpeedtest });

    service.start();
    const instance = FakeSpeedtest.instances[0];

    const unsubscribe = service.on("end", ({ aborted }) => {
      expect(aborted).toBe(true);
    });

    const result = service.abort();
    expect(result).toBe(true);
    expect(service.isRunning()).toBe(false);
    expect(instance.getState()).toBe(5);

    unsubscribe();
  });

  test("não permite iniciar dois testes simultâneos", () => {
    const service = createSpeedtestService({ SpeedtestCtor: FakeSpeedtest });
    service.start();

    expect(() => service.start()).toThrow(/já existe/iu);
  });

  test("reset aborta teste pendente e limpa snapshot", () => {
    const service = createSpeedtestService({ SpeedtestCtor: FakeSpeedtest });

    service.start();
    const instance = FakeSpeedtest.instances[0];
    instance.triggerUpdate({ testState: 2, dlStatus: "100" });

    service.reset();

    expect(service.isRunning()).toBe(false);
    expect(service.getLastSnapshot()).toBeNull();
  });
});
