# Quais são os IPs da Condfy?

 A Condfy opera com microsserviços hospedados na AWS. Isso garante escalabilidade e redundância, mas os endereços IP das instâncias podem mudar em casos de falha ou necessidade de escalabilidade.
Sobre a liberação de IPs:
* Atualmente, a liberação de um único IP é o bastante para liberar comunicação do Condfy com uma rede com segurança mais robusta: 
IP: 54.232.91.74.

====================================================================

# Repasse de Portas no MikroTik para Equipamentos Faciais, DVRs, NVRs e Câmeras IP

Pré-requisitos:
* MikroTik configurado e acessível via Winbox ou SSH;
* Conhecimento básico de roteamento e firewall no MikroTik;
* Endereços IP dos equipamentos faciais, DVRs, NVRs e câmeras IP (usaremos IPs de exemplo neste guia);
* Portas de acesso específicas para cada equipamento (usaremos portas de 4 dígitos neste guia).
Passo a Passo:
1. Acessar o MikroTik:
* Abra o Winbox e conecte-se ao seu MikroTik usando o IP ou nome do host;
* Se preferir, utilize o SSH com o comando ssh user@mikrotik_ip (substituindo "user" pelo seu nome de usuário e "mikrotik_ip" pelo IP do MikroTik);
1. Criar Regras de Firewall:
* Navegue até IP → Firewall no menu principal do Winbox;
* Clique em Nat na aba superior;
* Na seção NAT Rules, clique no botão Add;
1. Configurar a Regra de NAT:
* Exemplo 1: DVR com IP 192.168.1.10 e porta de acesso interna 8080:
* No campo Protocol, selecione TCP;
* No campo Dst. Port, digite a porta externa que você deseja mapear para o DVR (por exemplo, 12345);
* No campo Public Port, digite a mesma porta que você definiu em Dst. Port (12345);
* No campo In Interface, selecione a interface de rede pela qual o tráfego externo chegará (geralmente a interface WAN);
* No campo Dst. Address, digite o IP interno do DVR (192.168.1.10);
* No campo To Ports, digite a porta de acesso interna do DVR (8080);
* Marque a caixa de seleção Comment e adicione uma descrição para identificar facilmente a regra (por exemplo, "Acesso DVR");
* Clique no botão Apply para salvar a regra;
* Exemplo 2: Câmera IP com IP 192.168.1.20 e porta de acesso interna 80:
* Repita os passos acima, mas utilize as seguintes configurações:
* Dst. Port: 43210;
* To Ports: 80;
* Comment: "Acesso Câmera IP".
* Repita para Outros Equipamentos:
* Siga os passos 2 e 3 para cada equipamento facial, DVR, NVR ou câmera IP que você deseja acessar remotamente;
* Certifique-se de usar portas diferentes para cada equipamento e de anotar as configurações em um local seguro para referência futura.
Observações Importantes:
* As regras de NAT devem ser configuradas na ordem correta para funcionar corretamente.
* Utilize portas de 4 dígitos para aumentar a segurança da sua rede.
* Anote as portas e IPs utilizados para cada equipamento para facilitar o acesso futuro.
* É importante habilitar o firewall no MikroTik para proteger sua rede de acessos não autorizados.
* Este guia é um ponto de partida básico. Para configurações mais complexas ou personalizações, consulte um especialista em redes ou o suporte do fabricante do seu equipamento.
Considerações: Lembre-se que este material serve apenas como apoio e não substitui o conhecimento técnico especializado. Em caso de dúvidas ou problemas, entre em contato com o técnico de rede ou suporte do equipamento para obter ajuda personalizada.
Detalhe final: Este guia é fornecido apenas para fins informativos e não se destina a ser um substituto para o aconselhamento profissional. A implementação das configurações descritas neste guia é de sua responsabilidade e pode ter consequências imprevisíveis. Não assumimos nenhuma responsabilidade por danos ou perdas que possam resultar da utilização deste material.

====================================================================

# CGNAT - Métodos para liberação de portas

Quando não é possível fazer uma liberação de porta no local, isso quer dizer que a rede está em CGNAT.
CGNAT é uma técnica usada por provedores que permite compartilhar um único IP público entre vários usuários, economizando endereços IP devido ao esgotamento dos endereços IPv4, com isso dificulta a liberação de porta externa.
Dessa forma, temos dois caminhos para resolver;
1. Solicitar um IP Público: Peça ao seu provedor de internet um IP público dedicado. Isso pode permitir que você configure a liberação de portas sem a restrição do CGNAT.
1. Utilizar um Serviço de VPN: Alguns serviços de VPN oferecem a possibilidade de redirecionar portas, o que pode contornar as limitações do CGNAT.
a) Você pode configurar uma VPN entre o condomínio e sua empresa. Com isso, você libera a porta na rede da empresa e permite que o Condfy se conecte e poderá redirecionar o tráfego para o condomínio através da VPN.
b) Você pode contratar um serviço de VPN de terceiros que permita a liberação de portas através do servidor, sem que você precise se preocupar com a configuração.
Por exemplo:
* Empresa CVIT, contato Diego 14 99727-1421

====================================================================

# [Control iD] Conexão dos leitores faciais

Para conectar uma leitora facial da Control iD no Condfy, é necessário abrir uma porta no Roteador/modem do local onde o equipamento está conectado e direcionar para a porta HTTP do equipamento, pois o Condfy é um software executado em nuvem e por isso, precisa acessar os equipamentos instalados em redes locais pela internet (acesso externo).
Para saber como liberar uma porta no roteador/modem do local, acesse o tutorial Liberando uma porta para acesso externo no roteador/modem
1 - No menu superior da licença onde deseja cadastrar a leitora facial, acesse a opção “Equipamentos”;
2 - Na parte superior direita da tela, clique no botão “+ Novo equipamento”;
3 - Clique na caixa “Empresa” e selecione na lista o fabricante Control iD;
4 - Clique na caixa “Modelo” e selecione na lista o modelo “iD Face”;
5 - Digite uma “Descrição” para o equipamento, assim ficará mais fácil identificá-lo na lista de equipamentos;
6 - Em “URL”, digite o IP público fixo ou o DDNS configurado no /roteador/modem do local;
7 - Em “Porta”, digite a numeração da porte que liberou no roteador/modem e direcionou para a porta HTTP do equipamento;
8 - Digite o “Usuário” e “Senha” de acesso à interface do equipamento;
9 - Se deseja receber no Condfy os eventos de acessos do equipamento, em “Receber eventos” coloque o botão na posição “Sim”;
10 - Em “Habilitar recurso de captura de fotos”, mantenha habilitado se deseja utilizar esse recurso;
11 - Clique no botão “Salvar” na parte inferior da tela para concluir as configurações da LPR.
Obs: Caso uma das informações inseridas ou o direcionamento estiver incorreto, será mostrada uma tarja vermelha na parte superior direita da tela com a seguinte mensagem de erro: “Não foi possível conectar ao equipamento. Verifique a conexão e regras de direcionamento.” Nesse caso, verifique e ajuste as configurações e tente novamente até salvar sem gerar erros.

====================================================================

# [Control ID] Conexão dos equipamentos de controle de acesso no Condfy

Esse tutorial serve para a configuração e conexão dos seguinte equipamentos da Control ID no Condfy:
* Catraca;
* iDAccess;
* iDAccess Nano;
* iDAccess Pro;
* iDBox;
* iDFace;
* iDFace Pro;
* iDFace Max;
* iDFit;
* iDFlex;
* iDUHF;
* iDBlock Next.
1 - A porta de conexão dos equipamentos Control ID é a HTTP, padrão 80. O Condfy está em nuvem e se conecta no equipamento através da internet, então devemos primeiramente liberar a porta 80 no roteador do local onde o equipamento está fisicamente, recomendamos que a porta externa criada na liberação contenha 4 dígitos.
Obs: A liberação de portas para a iDBlock Next, deverá ser feita para o equipamento primário (facial principal).
Caso tenha duvidas sobre como liberar a porta, clique aqui;
2 - No menu superior da licença, selecione a opção “Equipamentos”;
3 - Clique no botão “+ Novo equipamento” na parte superior direita da tela;
4 - Clique na caixa “Empresa” e selecione na lista o fabricante “Control ID”;
5 - Clique na caixa “Modelo” e selecione na lista o equipamento que deseja conectar;
6 - Digite uma “Descrição” para identificar o equipamento;
7 - Informe a “URL” (IP fixo público ou o DDNS configurados no roteador/modem do local);
8 - Informe a porta que foi liberada no roteador/modem do local e direcionada para a porta HTTP do equipamento;
9 - Informe o “Usuário” e “Senha” de acesso ao equipamento;
10 - Habilite o botão “Receber eventos” e clique no botão “Salvar” para conectar o equipamento ao Condfy;
Obs: Os ID Faces terão mais 2 opções para habilitar no passo 10:
* “Habilitar recurso de captura de foto”: Recurso que habilitado, utilizará a câmera do ID Face para capturar fotos para cadastros;
* “Cadastro fácil”: Recurso que dispensa a confirmação do cadastro na tela do equipamento.

====================================================================

# Teste de string RTSP no VLC Player

1) Abra o VLC Player em seu computador.
2) Selecione "Mídia" no menu superior e escolha "Abrir transmissão de rede";
3) Na janela "Abrir Mídia", digite o endereço RTSP que deseja testar na caixa "Por favor insira uma URL de rede";
4) Clique no botão "Reproduzir" para iniciar a transmissão do vídeo RTSP;
5) O VLC Player deve começar a reproduzir o vídeo RTSP se a URL estiver correta e o servidor RTSP estiver ativo;
Obs.: Se a transmissão não começar ou se você receber uma mensagem de erro, verifique se o endereço RTSP foi digitado corretamente e se o servidor RTSP está ativo e respondendo. Também pode ser necessário verificar as configurações do firewall em seu computador ou roteador para garantir que o tráfego RTSP esteja sendo permitido.
Passo 1 e 2
VLC1.png
Passo 3
VLC2.png
Passo 4
VLC3.png
Passo 5
VLC4.png
Obs.
VLC5.png

====================================================================

# Requisitos para conectar Porteiro Eletrônico no Voicy Cloud PABX

Se for IP:
* SIP puro (SIP customizado pode não funcionar)
Codecs suportados:
* G711 µ-law (PCMU)
* G711 A-law (PCMA)
* G722
* G729
* OPUS
* VP8
* H264
Se for analógico:
Necessário ligar a um ATA (Grandstream)

====================================================================

# Contratando e configurando um DDNS gratuito na plataforma No-IP

O DDNS (Dynamic Domain Name System) é um serviço essencial para quem deseja acessar remotamente seus dispositivos em uma rede doméstica, mesmo com um endereço IP dinâmico que muda frequentemente. Com o DDNS, você configura um nome de host permanente (como "minhacasa.no-ip.org") que aponta para o seu IP dinâmico, facilitando o acesso remoto a servidores, câmeras de segurança, e outros dispositivos.
Pré-requisitos:
* Computador com acesso à internet;
* Conta de e-mail válida;
* Roteador com acesso à internet.
Passo 1: Criando uma conta no No-IP:
* Acesse o site do No-IP: https://www.noip.com/login;
* Clique em "Criar conta" no canto superior direito da tela;
* Preencha o formulário com suas informações pessoais e escolha um nome de usuário e senha seguros;
* Marque a caixa de seleção para concordar com os termos de serviço e a política de privacidade.
* Clique em "Criar conta";
* Verifique sua caixa de entrada de e-mail para confirmar seu endereço de e-mail.
Passo 2: Adicionando um Host DDNS:
* Faça login na sua conta No-IP;
* No menu principal, clique em "Meus Serviços";
* Selecione "DNS Dinâmico" no menu suspenso;
* Clique em "Adicionar um host";
* No campo "Nome do host", digite um nome de host exclusivo e memorável que deseja usar para o seu DDNS (por exemplo: "minhacasa");
* Selecione o tipo de host "A" no menu suspenso;
* Clique no botão "Criar host".
Passo 3: Testando o DDNS:
* Para verificar se o DDNS está funcionando corretamente, acesse um site como o "https://www.iplocation.net/" em um navegador da web;
* Anote o endereço IP exibido na tela;
* Abra um novo navegador e digite o nome de host DDNS que você criou (por exemplo: "minhacasa.no-ip.org") na barra de endereço;
* Se a página web do seu dispositivo for exibida, o DDNS está configurado e funcionando corretamente.
Considerações Importantes:
* Certifique-se de digitar o nome de usuário, senha e nome do host DDNS corretamente nas configurações do roteador;
* Se você alterar seu provedor de internet ou mover seu roteador para uma nova localização, poderá ser necessário reconfigurar o DDNS;
* Alguns provedores de internet bloqueiam o acesso a sites como o No-IP. Se você estiver com problemas para configurar o DDNS, entre em contato com o seu provedor de internet para obter mais informações.

====================================================================

# Dois links de internet no condomínio - Failover e DDNS

Tenho dois links de internet no condomínio. Quando o link principal cai, preciso trocar manualmente todos os IPs dos equipamentos no Condfy para o IP do link secundário. Qual a melhor solução pra isso?
R: A solução ideal é usar um DDNS (Dynamic DNS) no lugar do IP fixo no Condfy. Assim, em vez de cadastrar o IP público direto, você cadastra um endereço tipo meucondominio.ddns.net.
Quando o link principal cai e entra o secundário, você só precisa atualizar o IP no DDNS — e o Condfy continua acessando normalmente os equipamentos.
Esse processo pode ser:
* Manual: você acessa o painel do serviço DDNS e atualiza o IP.
* Automático: alguns equipamentos, como roteadores MikroTik, fazem esse controle de link e atualizam o DDNS automaticamente sempre que o IP mudar.
Com isso, você evita trocar IP por IP no Condfy e garante mais estabilidade pro cliente, mesmo em quedas de link.

====================================================================

