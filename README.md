# Trijay Apontamentos

Aplicativo privado de projetos, apontamentos diários e resumo de horas, publicado no [GitHub Pages](https://francaconsult.github.io/trijay-apontamentos/). Os registros ficam no Supabase com acesso restrito a valdemir.franca@trijay.tech. O código é público; os registros e credenciais não são publicados no repositório.

## Primeiro acesso

1. A conta autorizada no Supabase é valdemir.franca@trijay.tech. No aplicativo, clique em **Enviar link de acesso** e abra o link recebido por e-mail. Não há senha para digitar ou redefinir no aplicativo. O envio não cria novas contas. Links expirados ou já usados exigem um novo envio.
2. Após entrar pelo link, escolha **Importar dados deste navegador**, usando o Chrome onde estão os registros anteriores. A importação é única e preserva IDs e status. Se estiver em outro navegador, restaure seu backup JSON.
3. Em Projetos, confira o nome exato do projeto Tech Pro. Em Apontamentos, revise data, horários e atividade; marque como **Pronto para cadastro**. A duração vem dos horários, inclusive na virada do dia. A descrição segue a coluna H.
4. A opção Atualizar dados busca mudanças feitas pela rotina ou por outro dispositivo. Gravações simultâneas são recusadas para evitar sobrescrita. Faça backups regularmente.

## Envio dos links de acesso

O Supabase precisa de um serviço SMTP configurado para enviar os links ao e-mail autorizado. A opção escolhida foi o Brevo gratuito. A configuração real do envio ainda depende da ativação da conta Brevo e do cadastro das credenciais no Supabase.

Em Supabase → Authentication → Emails → SMTP Settings, use o remetente validado no Brevo, nome Trijay Apontamentos, host smtp-relay.brevo.com, porta 465 e o SMTP login exibido pelo Brevo. No campo Password, cadastre uma **chave SMTP**, não a senha do Brevo nem uma chave de API. O próprio usuário deve criar e cadastrar essa credencial, sem enviá-la pelo chat ou incluí-la no repositório.

Depois de salvar e testar o envio, o login por link mantém as mesmas regras privadas do banco. Não habilite leitura ou escrita anônima nas tabelas. O destinatário é fixo no código e também é verificado pelo banco.

## Rotina diária

O workflow **Apontamentos diários Tech Pro** roda todos os dias às 21h05 de São Paulo (00h05 UTC do dia seguinte), inclusive fins de semana. O GitHub pode atrasar o início do agendamento. Busca apenas os apontamentos do dia com status Pronto para cadastro. Se a execução noturna atrasar e começar depois da meia-noite, mantém a data do último disparo de 21h05, até o próximo horário diário. Rascunhos não são enviados.

O workflow usa três GitHub Actions repository secrets:

- TECHPRO_USERNAME
- TECHPRO_PASSWORD
- SUPABASE_SECRET_KEY: chave secreta de backend do projeto Supabase. Nunca use essa chave no navegador, em arquivos ou em mensagens. A chave publicável em config.js é própria para uso público; RLS e funções autenticadas restringem os dados.

Execute primeiro Actions → Apontamentos diários Tech Pro → Run workflow com Somente conferir marcado. Depois de conferir o resultado, a execução manual com a opção desmarcada realiza cadastros. O agendamento realiza cadastros. Confira falhas em Actions e habilite notificações do GitHub para workflows.

Para cadastrar outro dia ou período específico, use os campos opcionais Data inicial e Data final no Run workflow, em formato AAAA-MM-DD. A data final vazia usa a mesma data inicial. Na execução manual sem datas, usa o dia atual em São Paulo. O agendamento ignora esses campos manuais. Confira primeiro com Somente conferir marcado; desmarque para realizar o cadastro.

Cada gravação é verificada consultando os registros persistidos no Tech Pro antes de marcar Cadastrado. Registros existentes são conciliados por data, projeto, duração e descrição, preservando a quantidade de períodos idênticos. Uma tentativa sem confirmação bloqueia nova criação até revisão manual; o recibo correspondente em timesheet_automation_receipts permite investigar. Nunca remova um recibo sem conferir o destino. O aplicativo não edita nem exclui registros do Tech Pro automaticamente. Alterações após cadastro exigem ajuste no destino.

Chamados GLPI/GPLI usam AMS do cliente; GLPI 7014 de Taurus Helmets usa Integração GoDeep Hub. CBC Interno Teste ZHYP usa Interno. Não são alteradas datas ou projetos para contornar limites.

## Banco e segurança

O arquivo supabase/schema.sql cria duas tabelas privadas e funções com permissões mínimas. O navegador só lê o próprio documento e salva com revisão otimista. Recibos e funções da rotina são exclusivos do serviço. A chave secreta de backend tem acesso privilegiado ao projeto: limite o acesso ao repositório e rotacione-a se houver exposição.

Nenhum registro de produção deve ser incluído em commits, testes, logs ou artefatos públicos. O workflow mostra somente período e contagens, sem descrições, senhas ou tokens. Não há garantia de disponibilidade contínua dos planos gratuitos.

## Validação

Execute node --test tests/*.cjs. Cobertura: horários, datas, coluna H, exportação, backup, dia em São Paulo e atraso após meia-noite, AMS e exceções, multiplicidade e conciliação. A integração real requer usuário, dados importados e os três segredos.
