(function(globalScope){
  "use strict";

  var DEFAULT_CONFIG = {
    defaultSettings: {},
    ui: {
      labels: {
        start: "Iniciar Teste",
        abort: "Abortar"
      },
      statusMessages: {
        idle: "Pronto para iniciar teste.",
        running: "Teste em andamento.",
        aborted: "Teste abortado.",
        complete: "Teste concluído.",
        error: "Ocorreu um erro durante o teste."
      }
    },
    telemetry: {
      enabled: false,
      endpoint: "",
      includeIp: false
    }
  };

  function isObject(value){
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function deepMerge(target, source){
    if (!isObject(source)){
      return target;
    }
    Object.keys(source).forEach(function(key){
      var sourceValue = source[key];
      if (Array.isArray(sourceValue)){
        target[key] = sourceValue.slice();
        return;
      }
      if (isObject(sourceValue)){
        if (!isObject(target[key])){
          target[key] = {};
        }
        deepMerge(target[key], sourceValue);
        return;
      }
      target[key] = sourceValue;
    });
    return target;
  }

  function cloneDefaultConfig(){
    return deepMerge({}, DEFAULT_CONFIG);
  }

  function normalize(config){
    var result = cloneDefaultConfig();
    if (isObject(config)){
      result = deepMerge(result, config);
    }
    if (!isObject(result.defaultSettings)){
      result.defaultSettings = {};
    }
    if (!isObject(result.ui)){
      result.ui = {};
    }
    if (!isObject(result.ui.labels)){
      result.ui.labels = cloneDefaultConfig().ui.labels;
    }
    if (!isObject(result.ui.statusMessages)){
      result.ui.statusMessages = cloneDefaultConfig().ui.statusMessages;
    }
    if (!isObject(result.telemetry)){
      result.telemetry = cloneDefaultConfig().telemetry;
    }
    return result;
  }

  function loadConfig(url, options){
    options = options || {};
    var fetchImpl = options.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
    var fallback = cloneDefaultConfig();

    if (!url || typeof url !== "string" || !fetchImpl){
      return Promise.resolve({
        config: fallback,
        usedFallback: true,
        error: !fetchImpl ? new Error("fetch não disponível") : null
      });
    }

    return fetchImpl(url, { cache: "no-store" })
      .then(function(response){
        if (!response.ok){
          throw new Error("Falha ao carregar configuração: HTTP " + response.status);
        }
        return response.json();
      })
      .then(function(json){
        return {
          config: normalize(json),
          usedFallback: false,
          error: null
        };
      })
      .catch(function(err){
        return {
          config: fallback,
          usedFallback: true,
          error: err
        };
      });
  }

  var api = {
    loadConfig: loadConfig,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    _internal: {
      deepMerge: deepMerge,
      normalize: normalize,
      cloneDefaultConfig: cloneDefaultConfig
    }
  };

  if (typeof module !== "undefined" && module.exports){
    module.exports = api;
  }

  globalScope.SpeedtestConfig = globalScope.SpeedtestConfig || {};
  Object.keys(api).forEach(function(key){
    globalScope.SpeedtestConfig[key] = api[key];
  });

})(typeof window !== "undefined" ? window : globalThis);
