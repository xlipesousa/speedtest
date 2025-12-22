//INITIALIZE SPEEDTEST
var s = new Speedtest(); 
s.onupdate = function(data) {
    I("ip").textContent = data.clientIp;
    I("dlText").textContent = (data.testState == 1 && data.dlStatus == 0) ? "..." : data.dlStatus;
    I("ulText").textContent = (data.testState == 3 && data.ulStatus == 0) ? "..." : data.ulStatus;
    I("pingText").textContent = data.pingStatus;
    I("jitText").textContent = data.jitterStatus;
};
s.onend = function(aborted) { 
    I("startStopBtn").className = "";
    I("startStopBtn").textContent = "Iniciar Teste"; // Reset text to "Iniciar Teste"
    if (aborted) {
        initUI();
    }
};

function startStop() {
    if (s.getState() == 3) {
        s.abort();
    } else {
        s.start();
        I("startStopBtn").className = "running";
        I("startStopBtn").textContent = "Abortar";
    }
}

function initUI() {
    I("dlText").textContent = "";
    I("ulText").textContent = "";
    I("pingText").textContent = "";
    I("jitText").textContent = "";
    I("ip").textContent = "";
}

function I(id) {
    return document.getElementById(id);
}

initUI();
