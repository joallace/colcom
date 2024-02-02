- Containerizar a aplicação;

- Permitir títulos repetidos em posts e críticas:
  - Dropar a característica UNIQUE do title da tabela;
  - Fazer vericação pelo back somente para tópico;

- Trocar o nome do Topic para Frame ou Card, já que há vários elementos, como o post

- Retornar header Location no 201;
<!-- Será que precisa mesmo? Afinal, o front não vai redirecionar para essa rota -->

- Criar o topic searchable por embedding com content e tags e topic title;

- Implementar tratamento de interações:
  - Voto;
  - Bookmark;
  - Edição;
  - Crítica;
- Implementar agrupamento por resposta;
- Implementar linha do tempo;

# Maybe later
- Implementar adição de tags;
- Implementar testes unitários;
- Implementar testes de carga;
- Tags com customização de estilo;

# BUGS
- repositório git não criando a devida branch para o post em um tópico CASO seja resposta múltipla;
  - PS: trocar o nome da branch gerada para "{id}_{uuidV4}" ao invés de somente uuidV4