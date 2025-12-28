(function(globalScope){
  "use strict";

  var LABELS = {
    start: "Iniciar Teste",
    abort: "Abortar"
  };
  var STATUS_MESSAGES = {
    idle: "Pronto para iniciar teste.",
    running: "Teste em andamento.",
    aborted: "Teste abortado.",
    complete: "Teste concluído.",
    error: "Ocorreu um erro durante o teste."
  };

  function assertElement(elem, name){
    if (!elem){
      throw new Error("Elemento de UI ausente: " + name);
    }
    return elem;
  }

  function defaultSpeedFormatter(value){
    var num = Number(value);
    if (!isFinite(num) || num < 0){
      return "0.00";
    }
    if (num < 10){
      return num.toFixed(2);
    }
    if (num < 100){
      return num.toFixed(1);
    }
    return num.toFixed(0);
  }

  function formatLatency(value){
    var num = Number(value);
    if (!isFinite(num) || num < 0){
      return "";
    }
    if (num < 100){
      return num.toFixed(1);
    }
    return num.toFixed(0);
  }

  function oscillate(){
    return 1 + 0.02 * Math.sin(Date.now() / 100);
  }

  function createUIController(options){
    options = options || {};
    var service = options.service;
    var elements = options.elements || {};
    var labels = Object.assign({}, LABELS, options.labels || {});
    var statusMessages = Object.assign({}, STATUS_MESSAGES, options.statusMessages || {});
    var gauges = options.gauges || {};
    var formatters = options.formatters || {};
    var downloadGauge = gauges.download || null;
    var uploadGauge = gauges.upload || null;
    var speedFormatter = typeof formatters.speed === "function" ? formatters.speed : defaultSpeedFormatter;
    var gaugeAmountFn = typeof formatters.gaugeAmount === "function" ? formatters.gaugeAmount : null;

    if (!service || typeof service.on !== "function"){
      throw new Error("Serviço inválido recebido pelo controlador de UI");
    }

    var button = assertElement(elements.startStopBtn, "startStopBtn");
    var downloadEl = assertElement(elements.downloadText, "downloadText");
    var uploadEl = assertElement(elements.uploadText, "uploadText");
    var pingEl = assertElement(elements.pingText, "pingText");
    var jitterEl = assertElement(elements.jitterText, "jitterText");
    var ipEl = assertElement(elements.ipText, "ipText");
    var testContainer = elements.testContainer || null;
    var statusEl = elements.statusText || null;

    var subscriptions = [];
    var boundClickHandler = null;

    function setButtonRunning(running){
      if (running){
        button.classList.add("running");
        button.textContent = labels.abort;
      } else {
        button.classList.remove("running");
        button.textContent = labels.start;
      }
      button.setAttribute("aria-pressed", running ? "true" : "false");
    }

    function setBusy(running){
      if (!testContainer){
        return;
      }
      testContainer.setAttribute("aria-busy", running ? "true" : "false");
    }

    function setRunningState(running){
      setButtonRunning(running);
      setBusy(running);
    }

    function setStatus(key){
      if (!statusEl){
        return;
      }
      var message = statusMessages[key] || "";
      statusEl.textContent = message;
    }

    function formatMetric(data, statusKey){
      var result = {
        text: "",
        numeric: null,
        gaugeAmount: 0
      };
      if (!data){
        return result;
      }
      var waitState = (statusKey === "dlStatus" && data.testState === 1) ||
                      (statusKey === "ulStatus" && data.testState === 3);
      var value = data[statusKey];
      var numericValue = Number(value);
      var isNumeric = isFinite(numericValue);
      if (waitState && (!isNumeric || numericValue === 0)){
        result.text = "...";
        return result;
      }
      if (isNumeric){
        result.numeric = numericValue;
        if (statusKey === "pingStatus" || statusKey === "jitterStatus"){
          result.text = formatLatency(numericValue);
        } else {
          result.text = speedFormatter(numericValue);
        }
        if ((statusKey === "dlStatus" || statusKey === "ulStatus") && gaugeAmountFn){
          result.gaugeAmount = gaugeAmountFn(Math.max(0, numericValue));
        }
        return result;
      }
      result.text = value || "";
      return result;
    }

    function clearMetrics(){
      downloadEl.textContent = "";
      uploadEl.textContent = "";
      pingEl.textContent = "";
      jitterEl.textContent = "";
      ipEl.textContent = "";
      if (downloadGauge && typeof downloadGauge.reset === "function"){
        downloadGauge.reset();
      }
      if (uploadGauge && typeof uploadGauge.reset === "function"){
        uploadGauge.reset();
      }
    }

    function applySnapshot(snapshot){
      if (!snapshot){
        return;
      }
      var downloadMetric = formatMetric(snapshot, "dlStatus");
      var uploadMetric = formatMetric(snapshot, "ulStatus");
      var pingMetric = formatMetric(snapshot, "pingStatus");
      var jitterMetric = formatMetric(snapshot, "jitterStatus");

      downloadEl.textContent = downloadMetric.text;
      uploadEl.textContent = uploadMetric.text;
      pingEl.textContent = pingMetric.text;
      jitterEl.textContent = jitterMetric.text;

      if (downloadGauge && typeof downloadGauge.draw === "function"){
        var dlAmount = downloadMetric.gaugeAmount;
        if (downloadMetric.numeric !== null && snapshot.testState === 1 && gaugeAmountFn){
          dlAmount = gaugeAmountFn(Math.max(0, downloadMetric.numeric * oscillate()));
        }
        downloadGauge.draw(dlAmount, Number(snapshot.dlProgress || 0));
      }

      if (uploadGauge && typeof uploadGauge.draw === "function"){
        var ulAmount = uploadMetric.gaugeAmount;
        if (uploadMetric.numeric !== null && snapshot.testState === 3 && gaugeAmountFn){
          ulAmount = gaugeAmountFn(Math.max(0, uploadMetric.numeric * oscillate()));
        }
        uploadGauge.draw(ulAmount, Number(snapshot.ulProgress || 0));
      }

      if (typeof snapshot.clientIp !== "undefined"){
        ipEl.textContent = snapshot.clientIp || "";
      }
    }

    function bindServiceEvents(){
      subscriptions.push(service.on("start", function(){
        setRunningState(true);
        setStatus("running");
      }));
      subscriptions.push(service.on("update", function(data){
        applySnapshot(data);
      }));
      subscriptions.push(service.on("end", function(payload){
        setRunningState(false);
        if (payload && payload.aborted){
          clearMetrics();
          setStatus("aborted");
        } else {
          setStatus("complete");
        }
      }));
      subscriptions.push(service.on("error", function(){
        setRunningState(false);
        setStatus("error");
      }));
    }

    function handleButtonClick(){
      if (typeof service.isRunning === "function" && service.isRunning()){
        service.abort();
      } else {
        service.start();
      }
    }

    function init(){
      clearMetrics();
      setStatus("idle");
      bindServiceEvents();
      boundClickHandler = handleButtonClick;
      button.addEventListener("click", boundClickHandler);
      var currentlyRunning = typeof service.isRunning === "function" && service.isRunning();
      setRunningState(currentlyRunning);
      if (currentlyRunning){
        setStatus("running");
      }
      var snapshot = typeof service.getLastSnapshot === "function" ? service.getLastSnapshot() : null;
      if (snapshot){
        applySnapshot(snapshot);
      }
    }

    function destroy(){
      while (subscriptions.length){
        var unsubscribe = subscriptions.pop();
        if (typeof unsubscribe === "function"){
          unsubscribe();
        }
      }
      if (boundClickHandler){
        button.removeEventListener("click", boundClickHandler);
        boundClickHandler = null;
      }
    }

    return {
      init: init,
      destroy: destroy,
      clearMetrics: clearMetrics,
      applySnapshot: applySnapshot
    };
  }

  if (typeof module !== "undefined" && module.exports){
    module.exports = {
      createUIController: createUIController
    };
  }

  if (typeof globalScope !== "undefined"){
    globalScope.SpeedtestUI = globalScope.SpeedtestUI || {};
    globalScope.SpeedtestUI.createUIController = createUIController;
  }
})(typeof window !== "undefined" ? window : globalThis);
