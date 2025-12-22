# Guia Inicial do Speedtest

## Introdução
Este documento apresenta os passos essenciais para utilizar e administrar o sistema de speedtest hospedado em /var/www/html. Utilize este guia como ponto de partida e atualize-o conforme novas funcionalidades sejam adicionadas.

## Guia do Usuário
1. Abra o navegador e acesse a URL pública do servidor speedtest.
2. Aguarde o carregamento da página inicial. O teste é iniciado ao clicar no botão disponibilizado.
3. Durante o teste, acompanhe as métricas exibidas (download, upload, ping e jitter).
4. Ao término, registre capturas ou exporte os dados conforme a necessidade do atendimento.
5. Caso o teste não seja concluído, recarregue a página ou contate o administrador.

## Guia do Administrador
### Pré-requisitos
- Acesso SSH ao servidor.
- Usuário com privilégios sudo.

### Instalação de dependências
1. Acesse /var/www/html.
2. Execute o comando sudo ./install.sh para instalar ou atualizar dependências de pacotes.

### Atualização do código
1. Garanta que alterações locais estejam commitadas.
2. Execute o script ./update.sh para sincronizar com o repositório remoto configurado.

### Deploy de novas versões
1. Valide o funcionamento em ambiente de testes antes de promover a produção.
2. Em produção, reinicie os serviços necessários (por exemplo, sudo systemctl reload apache2).
3. Monitore os logs do servidor web em `/var/log/apache2` para identificar erros.

### Segurança e manutenção
- Revise periodicamente permissões em /var/www/html e subpastas.
- Mantenha as credenciais de acesso ao GitHub e à infraestrutura em local seguro.
- Documente qualquer alteração importante no repositório para rastreabilidade.
