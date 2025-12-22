<script lang="ts">
	type Metric = {
		id: string;
		label: string;
		unit: string;
		description: string;
		value: number | null;
	};

	const tcpMetrics: Metric[] = [
		{ id: "download", label: "Download", unit: "Mbit/s", description: "Velocidade média de recebimento", value: null },
		{ id: "upload", label: "Upload", unit: "Mbit/s", description: "Velocidade média de envio", value: null },
		{ id: "ping", label: "Ping", unit: "ms", description: "Latência ida e volta", value: null }
	];

	const udpMetrics: Metric[] = [
		{ id: "jitter", label: "Jitter", unit: "ms", description: "Variação entre pacotes UDP", value: null },
		{ id: "loss", label: "Perda", unit: "%", description: "Pacotes UDP descartados", value: null }
	];

	const formatValue = (value: number | null, unit: string) =>
		value === null ? "--" : `${value.toFixed(2)} ${unit}`;
</script>

<svelte:head>
	<title>Speedtest EBNet</title>
</svelte:head>

<main class="container">
	<header class="hero">
		<div>
			<h1>Speedtest EBNet</h1>
			<p>Monitore download, upload, ping e jitter com visão unificada.</p>
		</div>
		<button disabled title="Em desenvolvimento">Iniciar teste</button>
	</header>

	<section class="panel">
		<div class="panel__header">
			<h2>TCP</h2>
			<span>Download • Upload • Ping</span>
		</div>
		<div class="grid">
			{#each tcpMetrics as metric}
				<article class="card" aria-labelledby={`metric-${metric.id}`}>
					<h3 id={`metric-${metric.id}`}>{metric.label}</h3>
					<p class="card__value">{formatValue(metric.value, metric.unit)}</p>
					<p class="card__hint">{metric.description}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="panel">
		<div class="panel__header">
			<h2>UDP (prévia)</h2>
			<span>Jitter • Perda</span>
		</div>
		<div class="grid">
			{#each udpMetrics as metric}
				<article class="card" aria-labelledby={`metric-${metric.id}`}>
					<h3 id={`metric-${metric.id}`}>{metric.label}</h3>
					<p class="card__value">{formatValue(metric.value, metric.unit)}</p>
					<p class="card__hint">{metric.description}</p>
				</article>
			{/each}
		</div>
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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

	.hero h1 {
		margin: 0 0 0.5rem;
		font-size: 2rem;
	}

	.hero p {
		margin: 0;
		color: rgba(245, 247, 250, 0.75);
		max-width: 420px;
	}

	.hero button {
		background: #3a7bfa;
		color: #f5f7fa;
		border: none;
		border-radius: 999px;
		padding: 0.85rem 1.75rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: not-allowed;
		opacity: 0.65;
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
