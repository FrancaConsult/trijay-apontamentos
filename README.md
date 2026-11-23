# Trijay Apontamentos

Aplicativo HTML, CSS e JavaScript, sem instalação, para cadastro de projetos, apontamentos diários e resumo de horas por cliente e projeto.

## Abrir

Abra `index.html` no Chrome ou publique a pasta no GitHub Pages. Em GitHub: **Settings → Pages → Deploy from a branch → main → /(root) → Save**.

## Usar

1. Em **Projetos**, confira os projetos iniciais e cadastre os seus. O campo **Projeto no Tech Pro** deve conter o nome exato usado no sistema.
2. Em **Apontamentos**, cadastre data, projeto, início, fim e atividade. Para um período como 23:00–00:00, marque **Termina no dia seguinte**. Cada período é um registro separado.
3. A descrição é gerada no formato `DD/MM/AAAA - [CLIENTE] Atividade - 1h30`, equivalente à coluna H da planilha.
4. Marque como **Pronto para cadastro** quando terminar de revisar. **Exportar para Tech Pro** baixa um JSON apenas com os registros prontos e dentro dos filtros. A exportação não grava no Tech Pro nem muda o status para cadastrado.
5. Depois da confirmação de gravação no Tech Pro, edite o status para **Cadastrado no Tech Pro**.
6. Em **Resumo de horas**, filtre o período e consulte os totais por cliente e projeto.

## Dados e backup

Os dados ficam no armazenamento local deste navegador e endereço. Abrir em outro computador, navegador ou endereço não compartilha os dados. A limpeza dos dados do navegador pode apagá-los. Use **Exportar backup** regularmente. **Restaurar backup** valida e substitui os dados após confirmação.

O aplicativo começa sem apontamentos históricos. Os projetos iniciais refletem os destinos anteriormente confirmados; não representam integração ou consulta ao Tech Pro. O nome Trijay é usado para identificar o aplicativo solicitado, sem dependência de ativos oficiais de marca.

O CSV segue as colunas A–H da planilha original, com campos adicionais de projeto Tech Pro, status e ID. Datas são locais, durações usam minutos inteiros e os totais não acumulam erros decimais. A coluna Total Dia considera os registros da exportação.

## Cadastro semanal automático

GitHub Pages publica o aplicativo, mas **não recebe nem armazena os registros digitados**. Um agente agendado não consegue ler os dados locais deste navegador apenas pelo link público. Nesta versão, exporte o JSON e disponibilize-o em uma fonte acessível ao agente.

Para eliminar esse envio manual, será necessário adicionar armazenamento compartilhado autenticado (por exemplo, um serviço com banco de dados e API) e fornecer acesso autorizado ao agente. Não coloque tokens ou senhas no código HTML/JavaScript ou no repositório. Não publique apontamentos ou backups no repositório público sem decidir explicitamente expor esses dados.

## Validação

Execute `node --test tests/core.test.cjs`. Os testes cobrem duração, virada de dia, datas, descrição, exportação CSV e validação do backup.
