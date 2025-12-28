(function(globalScope){
  "use strict";

  var DEFAULT_OPTIONS = {
    enabled: false,
    endpoint: "",
    includeIp: false,
    method: "POST"
  };

  function createTelemetryClient(options){
    var config = Object.assign({}, DEFAULT_OPTIONS, options || {});
    var fetchImpl = config.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);

    function isEnabled(){
      return !!(config.enabled && config.endpoint);
    }

    function buildPayload(event){
      if (!event || typeof event !== "object"){
        return null;
      }
      var snapshot = event.snapshot || {};
      var payload = {
        result: {
          download: snapshot.dlStatus || null,
          upload: snapshot.ulStatus || null,
          ping: snapshot.pingStatus || null,
          jitter: snapshot.jitterStatus || null
        },
        timestamps: {
          created: Date.now()
        },
        meta: {
          aborted: !!event.aborted
        }
      };
      if (config.includeIp){
        payload.meta.clientIp = snapshot.clientIp || null;
      }
      return payload;
    }

    function send(event){
      if (!isEnabled()){
        return Promise.resolve({ skipped: true });
      }
      if (!fetchImpl){
        return Promise.reject(new Error("fetch não disponível para telemetria"));
      }
      if (!event || event.aborted){
        return Promise.resolve({ skipped: true });
      }
      var payload = buildPayload(event);
      if (!payload){
        return Promise.resolve({ skipped: true });
      }
      return fetchImpl(config.endpoint, {
        method: config.method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).then(function(response){
        return { skipped: false, status: response.status };
      }).catch(function(err){
        console.warn("Falha ao enviar telemetria", err);
        return { skipped: false, error: err };
      });
    }

    return {
      isEnabled: isEnabled,
      send: send
    };
  }

  var api = {
    createTelemetryClient: createTelemetryClient,
    DEFAULT_OPTIONS: DEFAULT_OPTIONS
  };

  if (typeof module !== "undefined" && module.exports){
    module.exports = api;
  }

  globalScope.SpeedtestTelemetry = globalScope.SpeedtestTelemetry || {};
  Object.keys(api).forEach(function(key){
    globalScope.SpeedtestTelemetry[key] = api[key];
  });

})(typeof window !== "undefined" ? window : globalThis);
