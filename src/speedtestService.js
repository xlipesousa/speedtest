(function(globalScope){
  "use strict";

  var SUPPORTED_EVENTS = ["start", "update", "end", "error", "state"];

  function createSpeedtestService(options){
    options = options || {};
    var SpeedtestCtor = options.SpeedtestCtor;
    var defaultSettings = options.defaultSettings || {};

    if (!SpeedtestCtor || typeof SpeedtestCtor !== "function"){
      throw new Error("SpeedtestCtor deve ser uma função construtora válida");
    }

    var listeners = SUPPORTED_EVENTS.reduce(function(map, eventName){
      map[eventName] = new Set();
      return map;
    }, {});

    var currentTester = null;
    var isRunning = false;
    var lastSnapshot = null;

    function emit(eventName, payload){
      if (!listeners[eventName]){
        return;
      }
      listeners[eventName].forEach(function(handler){
        try {
          handler(payload);
        } catch(err){
          // evitar quebra geral do fluxo caso um listener lance erro
          setTimeout(function(){ throw err; }, 0);
        }
      });
    }

    function clearCurrentTester(){
      currentTester = null;
      isRunning = false;
    }

    function buildTester(settings){
      var tester = new SpeedtestCtor();
      var mergedSettings = Object.assign({}, defaultSettings, settings || {});

      Object.keys(mergedSettings).forEach(function(key){
        tester.setParameter(key, mergedSettings[key]);
      });

      tester.onupdate = function(data){
        lastSnapshot = data;
        emit("update", data);
        emit("state", data.testState);
      };

      tester.onend = function(aborted){
        emit("end", { aborted: !!aborted, snapshot: lastSnapshot });
        emit("state", tester.getState());
        clearCurrentTester();
      };

      return tester;
    }

    function start(settings){
      if (isRunning){
        throw new Error("Já existe um teste em execução");
      }
      currentTester = buildTester(settings);
      isRunning = true;
      emit("start", { settings: Object.assign({}, defaultSettings, settings || {}) });

      try {
        currentTester.start();
      } catch(err){
        emit("error", err);
        clearCurrentTester();
        throw err;
      }
    }

    function abort(){
      if (!currentTester){
        return false;
      }
      try {
        currentTester.abort();
        return true;
      } catch(err){
        emit("error", err);
        throw err;
      }
    }

    function getState(){
      if (!currentTester){
        return -1;
      }
      return currentTester.getState();
    }

    function getLastSnapshot(){
      return lastSnapshot;
    }

    function on(eventName, handler){
      if (SUPPORTED_EVENTS.indexOf(eventName) === -1){
        throw new Error("Evento não suportado: " + eventName);
      }
      if (typeof handler !== "function"){
        throw new Error("Handler deve ser uma função");
      }
      listeners[eventName].add(handler);
      return function unsubscribe(){
        listeners[eventName].delete(handler);
      };
    }

    function reset(){
      if (currentTester){
        try {
          currentTester.abort();
        } catch(err){
          emit("error", err);
        }
      }
      clearCurrentTester();
      lastSnapshot = null;
    }

    return {
      start: start,
      abort: abort,
      getState: getState,
      isRunning: function(){ return isRunning; },
      getLastSnapshot: getLastSnapshot,
      on: on,
      reset: reset
    };
  }

  if (typeof module !== "undefined" && module.exports){
    module.exports = {
      createSpeedtestService: createSpeedtestService
    };
  }

  if (typeof globalScope !== "undefined"){
    globalScope.SpeedtestService = globalScope.SpeedtestService || {};
    globalScope.SpeedtestService.createSpeedtestService = createSpeedtestService;
  }
})(typeof window !== "undefined" ? window : globalThis);
