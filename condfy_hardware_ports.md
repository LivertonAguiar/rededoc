### [Hikvision] Conexão dos leitores faciais

Para conectar uma leitora facial da Hikvision no Condfy, é necessário abrir uma porta no Roteador/modem do local onde o equipamento está conectado e direcionar para a porta HTTP do equipamento, pois o Condfy é um software executado em nuvem e por isso, precisa acessar os equipamentos instalados em redes locais pela internet (acesso externo).
Para saber como liberar uma porta no roteador/modem do local, acesse o tutorial ‣ 
1 - No menu superior da licença onde deseja cadastrar a leitora facial, acesse a opção “Equipamentos”;
2 - Na parte superior direita da tela, clique no botão “+ Novo equipamento”;
3 - Clique na caixa “Empresa” e selecione na lista o fabricante Hikvision;
4 - Clique na caixa “Modelo” e selecione na lista o modelo da leitora homologada que deseja conectar;
5 - Digite uma “Descrição” para o equipamento, assim ficará mais fácil identificá-lo na lista de equipamentos;
6 - Em “URL”, digite o IP público fixo ou o DDNS configurado no /roteador/modem do local;
7 - Em “Porta”, digite a numeração da porte que liberou no roteador/modem e direcionou para a porta HTTP da LPR;
8 - Digite o “Usuário” e “Senha” de acesso à interface do equipamento;
9 - Se deseja receber no Condfy os eventos de acessos do equipamento, em “Receber eventos” coloque o botão na posição “Sim”;
10 - Em “Habilitar recurso de captura de fotos”, mantenha habilitado se deseja utilizar esse recurso;
11 - Clique no botão “Salvar” na parte inferior da tela para concluir as configurações da LPR.
Obs: Caso uma das informações inseridas ou o direcionamento estiver incorreto, será mostrada uma tarja vermelha na parte superior direita da tela com a seguinte mensagem de erro: “Não foi possível conectar ao equipamento. Verifique a conexão e regras de direcionamento.” Nesse caso, verifique e ajuste as configurações e tente novamente até salvar sem gerar erros.

------------------------------------------------------------

### [Intelbras] Conexão dos leitores faciais da linha SS

A porta de conexão dos faciais Intelbras utilizada para comunicação com o Condfy é a porta HTTP, por padrão interno é a porta 80. Como o Condfy está em nuvem e se conecta ao equipamento através da internet, será necessário liberar uma porta no roteador/modem do local onde o equipamento está conectado fisicamente. Recomendamos utilizar um valor de porta externa com 4 dígitos. Caso tenha duvidas sobre como liberar portas clique aqui;

Etapa 1 - Plataforma Web Condfy
1 - No menu superior da licença, selecione a opção “Equipamentos”;
3 - Clique no botão “+ Novo equipamento” na parte superior direita da tela;
4 - Clique na caixa “Empresa” e selecione na lista o fabricante “Intelbras”;
5 - Clique na caixa “Modelo” e selecione na lista o modelo do equipamento facial que deseja conectar;
6 - Digite uma “Descrição” para o equipamento, assim ficará mais fácil identifica-lo na lista de equipamentos da licença depois de conectado;
7 - Informe a “URL” (IP fixo público ou o DDNS configurados no roteador/modem do local);
8 - Informe a porta que foi liberada no roteador/modem do local e direcionada para a porta HTTP do equipamento;
9 - Informe o “Usuário” e “Senha” de acesso ao equipamento;
10 - Habilite o botão “Receber eventos” e clique no botão “Salvar” para conectar o equipamento ao Condfy;
Etapa 2 - Interface Web do equipamento
Para que o log de eventos registrado nas leitoras faciais Intelbras, seja reportado também para o Condfy, é necessário direcionar os eventos do equipamento para o Condfy, conforme os passos a seguir:
1 - Acesse a interface Web da leitora facial através do IP e porta e faça o login de acesso;
2 - No menu lateral selecione a opção “Geren. config → Servidor de Envio de Eventos”;
3 - Por padrão de fábrica, a configuração estará como “Standalone/Offline ou Online”, altere para “POST Eventos” e serão carregadas algumas informações como “Endereço de IP”, “Porta” e “Path do servidor”, não altere nenhum dos dados, basta clicar em “Ok” e pode sair da interface Web.
A partir de agora, todos os eventos carreados no log da leitora serão reportados para o Condfy e ficarão visíveis na tela “Portaria” além de permanecerem no “Histórico de acessos” da licença, armazenados em nuvem por até 2 anos.
Obs: dependendo do modelo do equipamento ou da versão de firmware, o caminho até o “Servidor de Envio de eventos” pode ser diferente. Caso não encontre seguindo os passos acima, entre em contato com nosso time de Suporte Técnico clicando aqui.

------------------------------------------------------------

### [Intelbras] Conexão do MIP 1000 IP no Condfy

1 - Para iniciar as configurações do MIP 1000 IP, comece baixando o software SGA da Intelbras, utilizando o link: https://backend.intelbras.com/sites/default/files/2023-06/Instalador SGA 1000 IP - 230602.zip;
2 - Abra o SGA e com o MIP 1000 IP já conectado na rede local, acesse a opção "Inicio" e clique em "Buscar MIPs na rede";
3 - Você irá identificar o IP interno do equipamento e a porta interna de integração. (Porta padrão: 12356);
4 - A porta de conexão padrão do MIP 1000 IP é 12356. Como o Condfy está em nuvem e se conecta ao equipamento através da internet, será necessário liberar a porta 12356 no roteador/modem do local onde o equipamento está conectado fisicamente. Recomendamos utilizar uma porta externa com 4 dígitos. Caso tenha duvidas sobre como liberar portas clique aqui;
5 - Acesse a  plataforma Web do Condfy e no menu lateral, acesse a opção “Licenças”;
6 - Selecione a licença desejada e no menu superior da licença, selecione a opção “Equipamentos”;
7 - Clique no botão “+ Novo equipamento” na parte superior direita da tela;
8 - Clique na caixa “Empresa” e selecione Intelbras na lista;
9 - Clique na caixa “Modelo” e selecione MIP 1000 IP” na lista;
10 - Insira uma “Descrição” para o equipamento;
11 - Em “IP ou DDNS (ex: 200.200.0.60 ou ddns.xpto.com)*”, informe o IP fixo ou o DDNS configurado no roteador/modem do local;
12 - Informe a “Porta*” que liberou e direcionou para a porta interna de integração do equipamento no roteador/modem do local. Como sugestão, o Condfy já traz preenchido o valor 12356, padrão do equipamento;
13 - Informe o “Usuário*” e “Senha*” de acesso ao equipamento. Como sugestão, o Condfy já traz preenchido o usuário e senha padrão do equipamento;
14 - Habilite “Receber eventos” e clique no botão “Salvar” na parte inferior da tela para finalizar as configurações do equipamento.

------------------------------------------------------------

### [Nice] Conexão do Módulo Guarita no Condfy

O processo de configuração e conexão do Módulo Guarita Nice no Condfy é realizado em 3 etapas: a primeira é realizada na plataforma Web do Condfy, a segunda pelo aplicativo Nice Guarita ou acesso Web do equipamento e a terceira novamente na plataforma Web do Condfy para finalização.
A porta do equipamento Módulo Guarita da Nice, utilizada para comunicação com o Condfy, é a porta TCP, que, por padrão, é a porta 9000. Como o Condfy está em nuvem e se conecta ao equipamento através da internet, será necessário liberar a porta no roteador/modem do local onde o equipamento está conectado fisicamente. Recomendamos utilizar um valor de porta externa com 4 dígitos. Caso tenha dúvidas sobre como liberar portas, clique aqui;
Etapa 1 - Plataforma Web Condfy
1 - No menu superior da licença, acesse a opção “Equipamentos”;
2 - Clique no botão “+ Novo equipamento” na parte superior direita da tela;
3 - Clique na caixa “Empresa” e selecione “Nice” na lista;
4 - Clique na caixa “Modelo” e selecione “Módulo Guarita” na lista;
5 - Digite uma “Descrição” para o módulo, assim ficará mais fácil identificar o equipamento na lista de equipamentos da licença depois de conectado;
6 - Digite a “URL” (IP fixo público ou o DDNS configurados no roteador/modem do local);
7 - Informe a porta que foi liberada no roteador/modem do local e direcionada para a porta TCP do equipamento;
8 - Habilite o botão “Receber eventos” e, em “Origem dos eventos”, selecione a opção “Conversor serial IP” para que o Condfy mostre as seguintes informações:
Palavra pós-conexão: XXXXXXXX (sequência numérica com 8 dígitos)
Host remoto 1: ip.condfy.com.br
Porta 1: 22149
Keep alive: 5
No Guarita, o protocolo de saída deve ser "Linear-HCS (Padrão)". Verifique no HCS em Avançado → Programação → Eventos (Porta 2) → Protocolo de saída;
Mantenha a tela de configuração do módulo aberta no Condfy para concluir depois de configurar o Módulo Guarita na etapa 2 a seguir. 👇
Etapa 2 - Aplicativo Guarita IP ou acesso à interface Web do equipamento:
1 - Execute o software e, no menu superior na tela principal, clique em ”Liberar Menus”. No pop-up que será aberto no centro da tela, digite ”nice” e confirme para liberar o acesso ao menu superior;
2 - Selecione ”Configurar → Programa” no menu superior e, na primeira opção ”Comunicação (Guarita IP)” habilite a opção ”TCP/IP (Modo Client)” e, logo abaixo, clique em ”Gerenciar”;
3 - Em ”Gerenciar conexões TCP/IP”, insira uma “Identificação” para o módulo que irá conectar, em ”Host ou IP”, insira o IP do equipamento (IP da rede interna se seu computador estiver conectado na mesma rede do Módulo Guarita ou IP externo, se estiver fazendo o acesso remotamente, a partir da internet), insira também a ”Porta TCP” e o ”Código de acesso” (se houver cadastrado), clique em ”Adicionar” e depois em ”Fechar”, clique em ”Salvar” na tela ”Configurar Programa” que será fechada e então no menu superior, clique em ”Conectar” e clique em ”Sim” para ”Deseja sincronizar os dados do Guarita IP?”;
4 - Aguarde o término da sincronização e então acesse no menu superior “Avançado → Guarita IP → Programação”;
5 - No menu superior de ”Programação Guarita IP”, acesse ”Eventos (Porta 2)” e verifique se o ”Protocolo de saída” está configurado como ”Próprio (Padrão)”;
6 - Navegue no menu superior até “Ethernet (Comunicação)”, onde serão inseridas as demais informações obtidas no Condfy (item 13). Em “Comunicação”, caso queira, poderá cadastrar/alterar o código de acesso (insira o novo código nas configurações do Módulo Guarita no Condfy (item 8));
7 - Ainda na aba ”Ethernet (Comunicação)”, agora na opção ”Secundária”, habilite a opção ”Modo CLIENT”, insira a ”Palavra pós-conexão”, o ”Host remoto/IP 1”, a ”Porta 1” com as informações fornecidas pelo Condfy (item 12) e altere o ”Keep Alive” para ”5 min.”.
8 - Clique em ”Alterar” no canto inferior esquerdo e será gerada a seguinte mensagem: ”As alterações só terão efeito após o reinício do equipamento. Reiniciar agora?”, clique ”Sim” para confirmar as alterações;
9 - Feche o software “Guarita IP” e volte à tela de configuração no Condfy. 
Etapa 3 - Plataforma Web Condfy
Em ”De onde serão reportados os eventos?”, altere para ”Do próprio guarita” ou mantenha a opção “Conversor Serial IP” se for utilizar um, inserindo o MAC Address dele. Em seguida, selecione uma opção em “Para efetivar as alterações é necessário reiniciar o Guarita” e depois clique em ”Salvar” para finalizar a configuração.

------------------------------------------------------------

### [Nice] Conexão do Módulo Ethernet2 no Condfy

A porta do equipamento Módulo Ethernet2 da Nice utilizada para comunicação com o Condfy é a porta TCP. Como o Condfy está em nuvem e se conecta ao equipamento através da internet, será necessário liberar a porta no roteador/modem do local onde o equipamento está conectado fisicamente. Recomendamos utilizar um valor de porta externa com 4 dígitos. Caso tenha duvidas sobre como liberar portas clique aqui;
1 - No menu superior da licença, acesse a opção “Equipamentos”;
2 - Clique no botão “+ Novo equipamento” na parte superior direita da tela;
3 - Clique na caixa, “Empresa” e selecione “Nice” na lista;
4 - Clique na caixa “Modelo” e selecione “Ethernet 2” na lista;
5 - Digite uma “Descrição” para o módulo, assim ficará mais fácil identificar o equipamento na lista de equipamentos da licença depois de conectado;
6 - Digite a “URL” (IP fixo público ou o DDNS configurados no roteador/modem do local);
7 - Informe a porta que foi liberada no roteador/modem do local e direcionada para a porta TCP do equipamento;
8 - Habilite o botão “Receber eventos” e clique no botão “Salvar” para conectar o equipamento ao Condfy;

------------------------------------------------------------

### [Intelbras] Equipamento não aceita a conexão no Condfy, mas abre pela Web

Essa situação é comum quando o protocolo HTTPS está habilitado nas configurações de segurança do equipamento.
Acesse o equipamento pelo navegador, e verifique se o endereço completo contem o S em HTTP 
Ex: https://140.22.55.154:6200
Entre com o usuário e senha e no menu lateral, procure pelo menu Segurança (ou similar, dependendo do firmware), Serviços e desmarque a caixa HTTPS;
O equipamento irá reiniciar após salvar as alterações. Aguarde ele retornar e tente conectar na plataforma.
Caso apareça a mensagem para atualizar o firmware, é sinal que o Condfy obteve sucesso em conectar com o equipamento. Agora basta atualizar o firmware para concluir o processo.

------------------------------------------------------------

