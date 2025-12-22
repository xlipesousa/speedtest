<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  type MetricDefinition<K extends string> = {
    id: K;
    label: string;
    unit: string;
    description: string;
  };

  const initialTcpValues = {
    download: null,
    upload: null,
    ping: null
  } as const;
  type TcpKey = keyof typeof initialTcpValues;

  const tcpDefinitions: MetricDefinition<TcpKey>[] = [
    { id: 'download', label: 'Download', unit: 'Mbit/s', description: 'Velocidade média de recebimento' },
    { id: 'upload', label: 'Upload', unit: 'Mbit/s', description: 'Velocidade média de envio' },
    { id: 'ping', label: 'Ping', unit: 'ms', description: 'Latência ida e volta' }
  ];

  const initialUdpValues = {
    jitter: null,
    loss: null
  } as const;
  type UdpKey = keyof typeof initialUdpValues;

  const udpDefinitions: MetricDefinition<UdpKey>[] = [
    { id: 'jitter', label: 'Jitter', unit: 'ms', description: 'Variação entre pacotes UDP' },
    { id: 'loss', label: 'Perda', unit: '%', description: 'Pacotes UDP descartados' }
  ];

  let tcpValues: Record<TcpKey, number | null> = { ...initialTcpValues };
  let udpValues: Record<UdpKey, number | null> = { ...initialUdpValues };

  let running = false;
  let statusMessage = 'Pronto para iniciar o teste.';
  let errorMessage: string | null = null;
  let clientIp: string | null = null;
  let apiBase = '';

  const setTcpValue = (key: TcpKey, value: number | null) => {
    tcpValues = { ...tcpValues, [key]: value };
  };

  const setUdpValue = (key: UdpKey, value: number | null) => {
    udpValues = { ...udpValues, [key]: value };
  };

  const resetMetrics = () => {
    tcpValues = { ...initialTcpValues };
    udpValues = { ...initialUdpValues };
  };

  onMount(() => {
    if (browser) {
      apiBase = resolveApiBase();
      void refreshIp();
    }
  });

  function resolveApiBase(): string {
    if (!browser) return '';
    const fromEnv = import.meta.env.VITE_API_BASE;
    if (fromEnv && fromEnv.length > 0) {
      return fromEnv.replace(/\/$/, '');
    }
    const { protocol, hostname, port } = window.location;
    const targetPort = port === '5173' ? '8080' : port;
    const portSegment = targetPort ? `:${targetPort}` : '';
    return `${protocol}//${hostname}${portSegment}`;
  }

  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  async function refreshIp() {
    if (!browser) return;
    try {
      const response = await fetch(`${apiBase}/ip`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Resposta inválida do endpoint /ip.');
      }
      const payload: { ip: string } = await response.json();
      clientIp = payload.ip;
    } catch (error) {
      console.warn('Falha ao descobrir IP do cliente', error);
    }
  }

  async function startTest() {
    if (running) return;
    if (browser && !apiBase) {
      apiBase = resolveApiBase();
    }

    resetMetrics();
    running = true;
    errorMessage = null;
    statusMessage = 'Iniciando diagnóstico...';

    try {
      statusMessage = 'Obtendo informações de IP...';
      await refreshIp();

      statusMessage = 'Medindo latência (ping)...';
      const ping = await measureLatency();
      setTcpValue('ping', ping);

      statusMessage = 'Medindo velocidade de download...';
      const download = await measureDownload();
      setTcpValue('download', download);

      statusMessage = 'Medindo velocidade de upload...';
      const upload = await measureUpload();
      setTcpValue('upload', upload);

      statusMessage = 'Medindo jitter e perda via UDP...';
      try {
        const udp = await runUdpProbe();
        setUdpValue('jitter', udp.jitter);
        setUdpValue('loss', udp.loss);
        statusMessage = 'Teste concluído com sucesso.';
      } catch (udpError) {
        console.warn('Teste UDP falhou', udpError);
        errorMessage =
          udpError instanceof Error
            ? `Teste UDP indisponível: ${udpError.message}`
            : 'Teste UDP indisponível por erro desconhecido.';
        statusMessage = 'Teste TCP concluído. UDP indisponível.';
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Falha inesperada durante o teste.';
      statusMessage = 'Teste interrompido.';
    } finally {
      running = false;
    }
  }

  async function measureLatency(samples = 5): Promise<number> {
    if (!browser) {
      throw new Error('Contexto de navegador necessário para medir latência.');
    }
    const durations: number[] = [];
    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      const response = await fetch(`${apiBase}/latency`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Falha ao consultar o endpoint de latência.');
      }
      await response.json();
      durations.push(performance.now() - start);
      await delay(120);
    }
    const total = durations.reduce((acc, value) => acc + value, 0);
    return parseFloat((total / durations.length).toFixed(2));
  }

  async function measureDownload(sizeBytes = 8 * 1024 * 1024): Promise<number> {
    if (!browser) {
      throw new Error('Contexto de navegador necessário para medir download.');
    }
    const start = performance.now();
    const response = await fetch(`${apiBase}/download?size=${sizeBytes}`, {
      cache: 'no-store'
    });
    if (!response.ok || !response.body) {
      throw new Error('Falha ao iniciar download de teste.');
    }
    const reader = response.body.getReader();
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        bytes += value.length;
      }
    }
    const elapsedMs = performance.now() - start;
    const megabits = (bytes * 8) / (elapsedMs / 1000) / 1_000_000;
    return parseFloat(megabits.toFixed(2));
  }

  async function measureUpload(sizeBytes = 6 * 1024 * 1024): Promise<number> {
    if (!browser) {
      throw new Error('Contexto de navegador necessário para medir upload.');
    }
    const payload = new Uint8Array(sizeBytes);
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
      crypto.getRandomValues(payload);
    }

    const start = performance.now();
    const response = await fetch(`${apiBase}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: payload
    });
    if (!response.ok) {
      throw new Error('Falha ao enviar dados de upload.');
    }
    const elapsedMs = performance.now() - start;
    const megabits = (sizeBytes * 8) / (elapsedMs / 1000) / 1_000_000;
    return parseFloat(megabits.toFixed(2));
  }

  async function runUdpProbe(): Promise<{ jitter: number | null; loss: number | null }> {
    if (!browser) {
      throw new Error('Contexto de navegador necessário para medir UDP.');
    }
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('Navegador não suporta WebRTC.');
    }

    const pc = new RTCPeerConnection();
    const channel = pc.createDataChannel('udp-test', {
      ordered: false,
      maxRetransmits: 0
    });

    type PacketSample = { seq: number; sendNs: number; arrival: number };
    const samples: PacketSample[] = [];
    const receivedSeq = new Set<number>();
    let expectedTotal: number | null = null;

    let resolveCompletion: ((value: { jitter: number | null; loss: number | null }) => void) | null = null;
    let rejectCompletion: ((reason?: unknown) => void) | null = null;
    const completion = new Promise<{ jitter: number | null; loss: number | null }>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });

    let settled = false;
    const settle = (result: { jitter: number | null; loss: number | null }) => {
      if (!settled && resolveCompletion) {
        settled = true;
        resolveCompletion(result);
      }
    };
    const fail = (error: Error) => {
      if (!settled && rejectCompletion) {
        settled = true;
        rejectCompletion(error);
      }
    };

    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    const clearInactivity = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
      }
    };

    channel.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const parts = event.data.split('|');
      if (parts[0] === 'END') {
        expectedTotal = Number(parts[1] ?? '0');
        channel.close();
        return;
      }
      const seq = Number(parts[0]);
      const sendNs = Number(parts[1]);
      if (!Number.isFinite(seq) || !Number.isFinite(sendNs)) {
        return;
      }

      receivedSeq.add(seq);
      samples.push({ seq, sendNs, arrival: performance.now() });

      clearInactivity();
      inactivityTimer = setTimeout(() => {
        channel.close();
      }, 4000);
    };

    channel.onopen = () => {
      inactivityTimer = setTimeout(() => {
        channel.close();
      }, 6000);
    };

    channel.onerror = () => {
      fail(new Error('Canal UDP encontrou um erro inesperado.'));
      channel.close();
    };

    channel.onclose = () => {
      clearInactivity();
      const received = receivedSeq.size;
      const expected =
        expectedTotal ?? (samples.length > 0 ? Math.max(...samples.map((item) => item.seq)) + 1 : 0);
      const loss =
        expected === 0 ? 0 : (Math.max(0, expected - received) / Math.max(expected, 1)) * 100;

      let jitter: number | null = null;
      if (samples.length > 1) {
        samples.sort((a, b) => a.seq - b.seq);
        let sum = 0;
        let count = 0;
        for (let i = 1; i < samples.length; i++) {
          const prev = samples[i - 1];
          const curr = samples[i];
          const arrivalDelta = curr.arrival - prev.arrival;
          const sendDelta = (curr.sendNs - prev.sendNs) / 1_000_000;
          sum += Math.abs(arrivalDelta - sendDelta);
          count += 1;
        }
        jitter = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
      }

      settle({ jitter, loss: parseFloat(loss.toFixed(2)) });
    };

    pc.oniceconnectionstatechange = () => {
      if (
        pc.iceConnectionState === 'failed' ||
        pc.iceConnectionState === 'disconnected' ||
        pc.iceConnectionState === 'closed'
      ) {
        fail(new Error(`Conexão WebRTC encerrada (${pc.iceConnectionState}).`));
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    const localDescription = pc.localDescription;
    if (!localDescription) {
      throw new Error('Descrição local ausente para oferta WebRTC.');
    }

    const response = await fetch(`${apiBase}/webrtc/offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp: localDescription.sdp })
    });
    if (!response.ok) {
      throw new Error('Falha ao negociar WebRTC com o servidor.');
    }

    const payload: { sdp: string } = await response.json();
    await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });

    const watchdog = setTimeout(() => {
      fail(new Error('Tempo limite do teste UDP atingido.'));
      channel.close();
      pc.close();
    }, 15000);

    try {
      return await completion;
    } finally {
      clearTimeout(watchdog);
      pc.close();
    }
  }

  function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', checkState);
    });
  }

  const formatValue = (value: number | null, unit: string) =>
    value === null ? '--' : `${value.toFixed(2)} ${unit}`;
</script>

<svelte:head>
  <title>Speedtest EBNet</title>
</svelte:head>

<main class="container">
  <header class="hero">
    <div class="hero__copy">
      <h1>Speedtest EBNet</h1>
      <p>Monitore download, upload, ping e jitter com visão unificada.</p>
      {#if clientIp}
        <p class="hero__meta">IP detectado: {clientIp}</p>
      {/if}
      <p class="hero__status">{statusMessage}</p>
    </div>
    <button on:click={startTest} disabled={running}>
      {running ? 'Testando...' : 'Iniciar teste'}
    </button>
  </header>

  {#if errorMessage}
    <div class="alert">{errorMessage}</div>
  {/if}

  <section class="panel">
    <div class="panel__header">
      <h2>TCP</h2>
      <span>Download • Upload • Ping</span>
    </div>
    <div class="grid">
      {#each tcpDefinitions as metric}
        <article class="card" aria-labelledby={`metric-${metric.id}`}>
          <h3 id={`metric-${metric.id}`}>{metric.label}</h3>
          <p class="card__value">{formatValue(tcpValues[metric.id], metric.unit)}</p>
          <p class="card__hint">{metric.description}</p>
        </article>
      {/each}
    </div>
  </section>

  <section class="panel">
    <div class="panel__header">
      <h2>UDP</h2>
      <span>Jitter • Perda</span>
    </div>
    <div class="grid">
      {#each udpDefinitions as metric}
        <article class="card" aria-labelledby={`metric-${metric.id}`}>
          <h3 id={`metric-${metric.id}`}>{metric.label}</h3>
          <p class="card__value">{formatValue(udpValues[metric.id], metric.unit)}</p>
          <p class="card__hint">{metric.description}</p>
        </article>
      {/each}
    </div>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background-color: #0c1220;
    color: #f5f7fa;
  }

  .container {
    max-width: 960px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    background: linear-gradient(145deg, rgba(33, 51, 98, 0.85), rgba(13, 24, 48, 0.95));
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  }

  .hero__copy {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .hero h1 {
    margin: 0;
    font-size: 2rem;
  }

  .hero p {
    margin: 0;
    color: rgba(245, 247, 250, 0.75);
    max-width: 420px;
  }

  .hero__meta {
    font-size: 0.9rem;
    color: rgba(245, 247, 250, 0.65);
  }

  .hero__status {
    font-size: 0.95rem;
    color: rgba(245, 247, 250, 0.85);
  }

  .hero button {
    background: #3a7bfa;
    color: #f5f7fa;
    border: none;
    border-radius: 999px;
    padding: 0.85rem 1.75rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .hero button[disabled] {
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: none;
  }

  .hero button:not([disabled]):hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(58, 123, 250, 0.35);
  }

  .alert {
    border-radius: 12px;
    padding: 1rem 1.25rem;
    background: rgba(255, 102, 102, 0.18);
    border: 1px solid rgba(255, 102, 102, 0.35);
    color: #ffbaba;
  }

  .panel {
    background: rgba(19, 29, 52, 0.92);
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .panel__header {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }

  .panel__header h2 {
    margin: 0;
    font-size: 1.4rem;
  }

  .panel__header span {
    color: rgba(245, 247, 250, 0.55);
    font-size: 0.95rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.25rem;
  }

  .card {
    background: rgba(11, 18, 34, 0.9);
    border-radius: 14px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border: 1px solid rgba(69, 110, 209, 0.25);
  }

  .card h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .card__value {
    margin: 0;
    font-size: 1.8rem;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .card__hint {
    margin: 0;
    font-size: 0.9rem;
    color: rgba(245, 247, 250, 0.6);
  }

  @media (max-width: 720px) {
    .hero {
      flex-direction: column;
      align-items: flex-start;
    }

    .hero button {
      width: 100%;
      text-align: center;
    }
  }
</style>
