import { createSpeedtestService } from "./src/speedtestService.browser.js";
import { createUIController } from "./src/uiController.browser.js";
import { loadConfig, DEFAULT_CONFIG } from "./src/configLoader.browser.js";
import { createTelemetryClient } from "./src/telemetryClient.browser.js";
import { createGauge, calculateGaugeAmount, formatSpeed } from "./src/gaugeRenderer.browser.js";

const speedtestCtor = typeof Speedtest !== "undefined" ? Speedtest : null;

if (!speedtestCtor) {
    throw new Error("Speedtest constructor não encontrado. Verifique a inclusão de speedtest.js");
}

const CONFIG_URL = "./config/speedtest.config.json";

async function bootstrap() {
    let configResult;
    try {
        configResult = await loadConfig(CONFIG_URL);
    } catch (err) {
        configResult = {
            config: DEFAULT_CONFIG,
            usedFallback: true,
            error: err
        };
    }

    const config = configResult.config || DEFAULT_CONFIG;
    if (configResult.usedFallback && configResult.error) {
        console.warn("Usando configuração padrão devido a falha no carregamento", configResult.error);
    }

    const service = createSpeedtestService({
        SpeedtestCtor: speedtestCtor,
        defaultSettings: config.defaultSettings
    });

    const telemetryClient = createTelemetryClient(config.telemetry);

    if (telemetryClient && typeof telemetryClient.isEnabled === "function" && telemetryClient.isEnabled()) {
        service.on("end", function(payload) {
            telemetryClient.send(payload);
        });
    }

    const elements = {
        startStopBtn: document.getElementById("startStopBtn"),
        downloadText: document.getElementById("dlText"),
        uploadText: document.getElementById("ulText"),
        pingText: document.getElementById("pingText"),
        jitterText: document.getElementById("jitText"),
        ipText: document.getElementById("ip"),
        testContainer: document.getElementById("test"),
        statusText: document.getElementById("statusMessage")
    };

    const gauges = {
        download: createGauge(document.getElementById("dlGauge"), {
            foregroundColor: "#60a5fa",
            progressColor: "#1d4ed8"
        }),
        upload: createGauge(document.getElementById("ulGauge"), {
            foregroundColor: "#c084fc",
            progressColor: "#7c3aed"
        })
    };

    const controller = createUIController({
        service: service,
        elements: elements,
        labels: config.ui && config.ui.labels,
        statusMessages: config.ui && config.ui.statusMessages,
        gauges: gauges,
        formatters: {
            speed: formatSpeed,
            gaugeAmount: calculateGaugeAmount
        }
    });

    controller.init();
}

bootstrap().catch(function(err) {
    console.error("Falha ao iniciar aplicação Speedtest", err);
});
