<?php
  // Define o tempo de teste em segundos
  $test_duration = 10; 

  // Define o servidor iperf como a própria máquina
  $iperf_server = "127.0.0.1"; 

  // Define a porta do servidor iperf
  $iperf_port = 5201; 

  // Define o comando iperf a ser executado
  $iperf_command = "/usr/bin/iperf3 -s -i 1 -t $test_duration";

  // Inicia o processo iperf em segundo plano
  $output = shell_exec("$iperf_command > /dev/null 2>&1 &");

  // Cria o HTML da página
  echo "<!DOCTYPE html>
  <html>
  <head>
  <title>Teste de Rede com iperf3</title>
  </head>
  <body>
  <h1>Teste de Rede com iperf3</h1>
  <p>Este teste irá executar por $test_duration segundos. Você pode fechar esta página após o término do teste.</p>

  <script>
    // Define o endereço do cliente
    var client_address = '". $_SERVER['REMOTE_ADDR'] ."';

    // Função para iniciar o teste
    function startTest() {
      // Cria um novo objeto XMLHttpRequest
      var xhr = new XMLHttpRequest();
      
      // Define a URL do servidor iperf
      xhr.open('GET', 'http://"'.$iperf_server.":".$iperf_port."', true);

      // Define a função de callback para o evento load
      xhr.onload = function() {
        // Exibe os resultados do teste
        document.getElementById('results').innerHTML = xhr.responseText;
      };

      // Define a função de callback para o evento error
      xhr.onerror = function() {
        document.getElementById('results').innerHTML = 'Erro ao realizar o teste de rede.';
      };

      // Envia a requisição para o servidor iperf
      xhr.send();
    }
  </script>

  <button onclick='startTest()'>Iniciar Teste</button>
  <div id='results'></div>

  </body>
  </html>";
?>
