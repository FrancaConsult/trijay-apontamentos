# Trijay Apontamentos

Aplicativo privado de projetos, apontamentos diários e resumo de horas, publicado no [GitHub Pages](https://francaconsult.github.io/trijay-apontamentos/). Os registros ficam no Supabase com acesso restrito a valdemir.franca@trijay.tech. O código é público; os registros e credenciais não são publicados no repositório.

## Primeiro acesso

1. No Supabase, Authentication → Users → Add user → Create new user: crie o usuário com o e-mail autorizado e uma senha exclusiva. Confirme o usuário nesse cadastro administrativo. Não envie a senha no chat nem a coloque no GitHub.
2. Entre no aplicativo e escolha **Importar dados deste navegador**, usando o Chrome onde estão os registros anteriores. A importação é única e preserva IDs e status. Se estiver em outro navegador, restaure seu backup JSON.
3. Em Projetos, confira o nome exato do projeto Tech Pro. Em Apontamentos, revise data, horários e atividade; marque como **Pronto para cadastro**. A duração vem dos horários, inclusive na virada do dia. A descrição segue a coluna H.
4. A opção Atualizar dados busca mudanças feitas pela rotina ou por outro dispositivo. Gravações simultâneas são recusadas para evitar sobrescrita. Faça backups regularmente.

## Rotina semanal

O workflow **Apontamentos semanais Tech Pro** roda às segundas-feiras às 11:00 UTC (08:00 em São Paulo). O GitHub pode atrasar o início do agendamento. Busca apenas a semana anterior, de segunda a domingo, com status Pronto para cadastro. Rascunhos não são enviados.

O workflow usa três GitHub Actions repository secrets:

- TECHPRO_USERNAME
- TECHPRO_PASSWORD
- SUPABASE_SECRET_KEY: chave secreta de backend do projeto Supabase. Nunca use essa chave no navegador, em arquivos ou em mensagens. A chave publicável em config.js é própria para uso público; RLS e funções autenticadas restringem os dados.

Execute primeiro Actions → Apontamentos semanais Tech Pro → Run workflow com Somente conferir marcado. Depois de conferir o resultado, a execução manual com a opção desmarcada realiza cadastros. O agendamento realiza cadastros. Confira falhas em Actions e habilite notificações do GitHub para workflows.

Cada gravação é verificada consultando os registros persistidos no Tech Pro antes de marcar Cadastrado. Registros existentes são conciliados por data, projeto, duração e descrição, preservando a quantidade de períodos idênticos. Uma tentativa sem confirmação bloqueia nova criação até revisão manual; o recibo correspondente em timesheet_automation_receipts permite investigar. Nunca remova um recibo sem conferir o destino. O aplicativo não edita nem exclui registros do Tech Pro automaticamente. Alterações após cadastro exigem ajuste no destino.

Chamados GLPI/GPLI usam AMS do cliente; GLPI 7014 de Taurus Helmets usa Integração GoDeep Hub. CBC Interno Teste ZHYP usa Interno. Não são alteradas datas ou projetos para contornar limites.

## Banco e segurança

O arquivo supabase/schema.sql cria duas tabelas privadas e funções com permissões mínimas. O navegador só lê o próprio documento e salva com revisão otimista. Recibos e funções da rotina são exclusivos do serviço. A chave secreta de backend tem acesso privilegiado ao projeto: limite o acesso ao repositório e rotacione-a se houver exposição.

Nenhum registro de produção deve ser incluído em commits, testes, logs ou artefatos públicos. O workflow mostra somente período e contagens, sem descrições, senhas ou tokens. Não há garantia de disponibilidade contínua dos planos gratuitos.

## Validação

Execute node --test tests/*.cjs. Cobertura: horários, datas, coluna H, exportação, backup, semana em São Paulo, AMS e exceções, multiplicidade e conciliação. A integração real requer usuário, dados importados e os três segredos.
