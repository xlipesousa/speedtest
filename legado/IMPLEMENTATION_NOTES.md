# Speedtest Modernization Notes

## Contexto e descobertas
- Sistema legado baseado em LibreSpeed anterior, front-end HTML/CSS/JS puro e múltiplos arquivos redundantes.
- Backend em PHP limitado a fornecer garbage.php, empty.php e getIP.php; sem logs ou persistência.
- iperf3 servidor disponível, mas dependia de cliente externo; decisão atual é descontinuar.
- Execução em rede dedicada, sem HTTPS, sem Docker, sem armazenamento de histórico ou logs persistentes.

## Stack alvo
- Front-end: SvelteKit + TypeScript + Tailwind, gerando bundle estático leve.
- Worker TCP: reaproveitar lógica LibreSpeed para download/upload/latência via fetch/XHR multistream.
- Módulo UDP: Go (pion/webrtc) expondo canal WebRTC DataChannel para medir jitter/perda sem instalação cliente.
- Backend: serviço Go único servindo assets estáticos, endpoints TCP e sessão WebRTC.
- Operação: processo systemd self-hosted, sem containers, sem TLS.

## Plano de implementação
1. **Limpeza do repositório**
   - Remover duplicatas (por exemplo speedtest (1).js, iperf_test.php) e arquivos não usados.
   - Inventariar e manter apenas worker LibreSpeed, scripts PHP úteis e assets necessários até substituição total.
2. **Fundação do projeto**
   - Inicializar monorepo com diretórios `frontend/` (SvelteKit) e `backend/` (Go).
   - Configurar lint/build (`npm run lint`, `npm run build`, `go fmt`, `go test`).
   - Preparar arquivo README interno e this notes file.
3. **Backend Go**
   - Endpoints `/download`, `/upload`, `/latency`, `/ip` mapeando para funcionalidades LibreSpeed.
   - Implementar sessão WebRTC: negociar oferta/resposta, enviar fluxo UDP controlado e calcular jitter/perda/packet loss.
   - Servir bundle estático do frontend e expor endpoint `/diagnostics` para acionar ping/traceroute sob demanda.
4. **Frontend SvelteKit**
   - Tela principal com cartões de métricas TCP (download/upload/ping/jitter).
   - Controle para iniciar teste WebRTC e exibir métricas UDP.
   - Seção com instruções para o cliente repassar dados ao suporte.
   - Ajustes responsivos e fallback para ambientes antigos.
5. **Integração e testes**
   - Verificar comunicação WebSocket/WebRTC entre frontend e backend.
   - Testar performance em diferentes larguras de banda; ajustar limites de streams.
   - Realizar testes manuais de rede (latência injetada, perda simulada) para validar métricas.
6. **Entrega operacional**
   - Criar scripts `scripts/build.sh` (compilar frontend + backend) e `scripts/run.sh` para execução direta.
   - Elaborar unidade systemd simples apontando para binário Go.
   - Documentar procedimentos de atualização e fallback para versão legada caso necessário.

## Passo a passo self-hosted
1. Instalar dependências de build (Node.js LTS, npm, Go >= 1.21).
2. Executar `npm install` dentro de `frontend/` e `go mod tidy` em `backend/`.
3. Rodar `npm run build` para gerar bundle em `frontend/build/`.
4. Compilar backend com `go build -o speedtest-service ./cmd/server` servindo o bundle estatico.
5. Configurar arquivo de unidade systemd `/etc/systemd/system/speedtest.service` apontando para o binário com diretório de trabalho do projeto.
6. Executar `systemctl daemon-reload` e `systemctl enable --now speedtest`.
7. Validar acesso pelo cliente interno, executar testes TCP e UDP, confirmar métricas esperadas.
8. Manter instruções rápidas para suporte: URL do painel, interpretação dos resultados, como pedir traceroute.

## Considerações finais
- Nenhum dado é armazenado: desabilitar logs persistentes e evitar escrita em disco.
- Validar periodicamente se recursos (CPU/RAM/BW) da VM atendem a WebRTC e carga simultânea.
- Planejar fallback manual para scripts PHP antigos apenas se o novo serviço estiver indisponível.
