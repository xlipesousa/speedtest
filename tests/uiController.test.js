const { createUIController } = require("../src/uiController");

describe("uiController", () => {
  function createFakeService() {
    const listeners = {};
    let running = false;
    let lastSnapshot = null;

    const startMock = jest.fn(() => {
      running = true;
      emit("start", { settings: {} });
    });
    const abortMock = jest.fn(() => {
      running = false;
      emit("end", { aborted: true, snapshot: lastSnapshot });
    });
    const isRunningMock = jest.fn(() => running);
    const getLastSnapshotMock = jest.fn(() => lastSnapshot);

    function on(eventName, handler) {
      if (!listeners[eventName]) {
        listeners[eventName] = new Set();
      }
      listeners[eventName].add(handler);
      return function unsubscribe() {
        listeners[eventName].delete(handler);
      };
    }

    function emit(eventName, payload) {
      const handlers = listeners[eventName];
      if (!handlers) {
        return;
      }
      handlers.forEach(fn => fn(payload));
    }

    return {
      on,
      start: startMock,
      abort: abortMock,
      isRunning: isRunningMock,
      getLastSnapshot: getLastSnapshotMock,
      setSnapshot(data) {
        lastSnapshot = data;
      },
      emit
    };
  }

  function setupDOM() {
    document.body.innerHTML = `
      <button id="startStopBtn" aria-controls="test" aria-describedby="statusMessage" aria-pressed="false">Iniciar Teste</button>
      <p id="statusMessage" role="status" aria-live="polite">Pronto para iniciar teste.</p>
      <div id="test">
        <div id="dlText">123</div>
        <div id="ulText">456</div>
        <div id="pingText">789</div>
        <div id="jitText">10</div>
        <span id="ip">127.0.0.1</span>
      </div>
    `;
    return {
      startStopBtn: document.getElementById("startStopBtn"),
      downloadText: document.getElementById("dlText"),
      uploadText: document.getElementById("ulText"),
      pingText: document.getElementById("pingText"),
      jitterText: document.getElementById("jitText"),
      ipText: document.getElementById("ip"),
      testContainer: document.getElementById("test"),
      statusText: document.getElementById("statusMessage")
    };
  }

  test("init limpa métricas e configura estado inicial", () => {
    const service = createFakeService();
    const elements = setupDOM();

    const controller = createUIController({ service, elements });
    controller.init();

    expect(elements.downloadText.textContent).toBe("");
    expect(elements.uploadText.textContent).toBe("");
    expect(elements.pingText.textContent).toBe("");
    expect(elements.jitterText.textContent).toBe("");
    expect(elements.ipText.textContent).toBe("");
    expect(elements.startStopBtn.textContent).toBe("Iniciar Teste");
    expect(elements.startStopBtn.classList.contains("running")).toBe(false);
    expect(elements.startStopBtn.getAttribute("aria-pressed")).toBe("false");
    expect(elements.testContainer.getAttribute("aria-busy")).toBe("false");
    expect(elements.statusText.textContent).toBe("Pronto para iniciar teste.");

    controller.destroy();
  });

  test("evento start atualiza botão para estado em execução", () => {
    const service = createFakeService();
    const elements = setupDOM();

    const controller = createUIController({ service, elements });
    controller.init();

    service.emit("start", { settings: {} });

    expect(elements.startStopBtn.textContent).toBe("Abortar");
    expect(elements.startStopBtn.classList.contains("running")).toBe(true);
    expect(elements.startStopBtn.getAttribute("aria-pressed")).toBe("true");
    expect(elements.testContainer.getAttribute("aria-busy")).toBe("true");
    expect(elements.statusText.textContent).toBe("Teste em andamento.");

    controller.destroy();
  });

  test("evento update preenche métricas e aplica placeholder quando necessário", () => {
    const service = createFakeService();
    const elements = setupDOM();

    const controller = createUIController({ service, elements });
    controller.init();

    const payload = {
      testState: 1,
      dlStatus: 0,
      ulStatus: "32",
      pingStatus: "12",
      jitterStatus: "1",
      clientIp: "8.8.8.8"
    };
    service.emit("update", payload);

    expect(elements.downloadText.textContent).toBe("...");
    expect(elements.uploadText.textContent).toBe("32.0");
    expect(elements.pingText.textContent).toBe("12.0");
    expect(elements.jitterText.textContent).toBe("1.0");
    expect(elements.ipText.textContent).toBe("8.8.8.8");

    controller.destroy();
  });

  test("evento end abortado limpa métricas e restaura botão", () => {
    const service = createFakeService();
    const elements = setupDOM();

    const controller = createUIController({ service, elements });
    controller.init();

    service.emit("start", { settings: {} });
    service.emit("update", {
      testState: 3,
      dlStatus: "100",
      ulStatus: "42",
      pingStatus: "11",
      jitterStatus: "2",
      clientIp: "1.1.1.1"
    });

    service.emit("end", { aborted: true, snapshot: null });

    expect(elements.downloadText.textContent).toBe("");
    expect(elements.uploadText.textContent).toBe("");
    expect(elements.startStopBtn.textContent).toBe("Iniciar Teste");
    expect(elements.startStopBtn.classList.contains("running")).toBe(false);
    expect(elements.startStopBtn.getAttribute("aria-pressed")).toBe("false");
    expect(elements.testContainer.getAttribute("aria-busy")).toBe("false");
    expect(elements.statusText.textContent).toBe("Teste abortado.");

    controller.destroy();
  });

  test("evento end normal mantém métricas e indica conclusão", () => {
    const service = createFakeService();
    const elements = setupDOM();

    const controller = createUIController({ service, elements });
    controller.init();

    service.emit("start", { settings: {} });
    service.emit("update", {
      testState: 4,
      dlStatus: "150",
      ulStatus: "70",
      pingStatus: "9",
      jitterStatus: "1",
      clientIp: "2.2.2.2"
    });

    service.emit("end", { aborted: false, snapshot: {
      dlStatus: "150",
      ulStatus: "70",
      pingStatus: "9",
      jitterStatus: "1",
      clientIp: "2.2.2.2"
    }});

    expect(elements.statusText.textContent).toBe("Teste concluído.");
    expect(elements.testContainer.getAttribute("aria-busy")).toBe("false");

    controller.destroy();
  });

  test("evento de erro ajusta status e libera botão", () => {
    const service = createFakeService();
    const elements = setupDOM();

    const controller = createUIController({ service, elements });
    controller.init();

    service.emit("start", { settings: {} });
    service.emit("error", new Error("boom"));

    expect(elements.startStopBtn.getAttribute("aria-pressed")).toBe("false");
    expect(elements.statusText.textContent).toBe("Ocorreu um erro durante o teste.");
    expect(elements.testContainer.getAttribute("aria-busy")).toBe("false");

    controller.destroy();
  });

  test("clique no botão alterna entre start e abort", () => {
    const service = createFakeService();
    const elements = setupDOM();

    const controller = createUIController({ service, elements });
    controller.init();

    elements.startStopBtn.click();
    expect(service.start).toHaveBeenCalledTimes(1);

    service.emit("start", { settings: {} });
    elements.startStopBtn.click();
    expect(service.abort).toHaveBeenCalledTimes(1);

    controller.destroy();
  });
});
