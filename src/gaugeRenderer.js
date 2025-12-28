(function(globalScope){
  "use strict";

  var DEFAULT_OPTIONS = {
    backgroundColor: "#1f2937",
    foregroundColor: "#4f9bff",
    progressColor: "#94bfff",
    thickness: 12,
    bottomOffset: 58
  };

  function calculateGaugeAmount(mbps){
    var value = Number(mbps);
    if (!isFinite(value) || value <= 0){
      return 0;
    }
    return 1 - (1 / Math.pow(1.3, Math.sqrt(value)));
  }

  function formatSpeed(value){
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

  function createNoopGauge(){
    return {
      draw: function(){},
      reset: function(){}
    };
  }

  function createGauge(canvas, options){
    if (!canvas || typeof canvas.getContext !== "function"){
      return createNoopGauge();
    }
    var ctx = canvas.getContext("2d");
    if (!ctx){
      return createNoopGauge();
    }
    var config = Object.assign({}, DEFAULT_OPTIONS, options || {});

    function computeRadius(metrics, ctx){
      var lineWidth = ctx.lineWidth;
      var centerY = metrics.ch - config.bottomOffset * metrics.dp;
      var maxRadiusX = Math.max(0, metrics.cw / 2 - lineWidth * 0.8);
      var maxRadiusY = Math.max(0, centerY - lineWidth * 0.8);
      return Math.max(0, Math.min(maxRadiusX, maxRadiusY));
    }

    function resize(){
      var dp = globalScope.devicePixelRatio || 1;
      var cw = canvas.clientWidth * dp;
      var ch = canvas.clientHeight * dp;
      if (!cw || !ch){
        return { dp: dp, cw: canvas.width, ch: canvas.height };
      }
      if (canvas.width !== cw || canvas.height !== ch){
        canvas.width = cw;
        canvas.height = ch;
      }
      return { dp: dp, cw: cw, ch: ch };
    }

    function drawBase(ctx, metrics){
      ctx.beginPath();
      ctx.strokeStyle = config.backgroundColor;
      ctx.lineCap = "round";
      ctx.lineWidth = config.thickness * metrics.dp;
      var radius = computeRadius(metrics, ctx);
      ctx.arc(metrics.cw / 2, metrics.ch - config.bottomOffset * metrics.dp, radius, -Math.PI * 1.1, Math.PI * 0.1);
      ctx.stroke();
    }

    function drawForeground(ctx, metrics, amount){
      var clamped = Math.max(0, Math.min(1, amount || 0));
      ctx.beginPath();
      ctx.strokeStyle = config.foregroundColor;
      ctx.lineCap = "round";
      ctx.lineWidth = config.thickness * metrics.dp;
      var radius = computeRadius(metrics, ctx);
      var endAngle = clamped * Math.PI * 1.2 - Math.PI * 1.1;
      ctx.arc(metrics.cw / 2, metrics.ch - config.bottomOffset * metrics.dp, radius, -Math.PI * 1.1, endAngle);
      ctx.stroke();
    }

    function drawProgress(ctx, metrics, progress){
      if (typeof progress === "undefined" || progress === null){
        return;
      }
      var clamped = Math.max(0, Math.min(1, progress));
      var barHeight = 4 * metrics.dp;
      var barWidth = metrics.cw * 0.4 * clamped;
      ctx.fillStyle = config.progressColor;
      ctx.fillRect(metrics.cw * 0.3, metrics.ch - 16 * metrics.dp, barWidth, barHeight);
    }

    function clearCanvas(ctx, metrics){
      ctx.clearRect(0, 0, metrics.cw, metrics.ch);
    }

    function draw(amount, progress){
      var metrics = resize();
      clearCanvas(ctx, metrics);
      drawBase(ctx, metrics);
      drawForeground(ctx, metrics, amount);
      drawProgress(ctx, metrics, progress);
    }

    function reset(){
      draw(0, 0);
    }

    return {
      draw: draw,
      reset: reset
    };
  }

  var api = {
    createGauge: createGauge,
    calculateGaugeAmount: calculateGaugeAmount,
    formatSpeed: formatSpeed,
    DEFAULT_OPTIONS: DEFAULT_OPTIONS
  };

  if (typeof module !== "undefined" && module.exports){
    module.exports = api;
  }

  globalScope.SpeedtestGauge = globalScope.SpeedtestGauge || {};
  Object.keys(api).forEach(function(key){
    globalScope.SpeedtestGauge[key] = api[key];
  });
})(typeof window !== "undefined" ? window : globalThis);
