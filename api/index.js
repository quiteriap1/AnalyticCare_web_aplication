const express = require('express');

const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = 3000;
app.use(cors());

app.use(bodyParser.json());

const db = new sqlite3.Database('database.db');

db.run(`
  CREATE TABLE IF NOT EXISTS Utilizadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT,
    lastName TEXT,
    email TEXT UNIQUE,
    password TEXT
  );
`);

app.post('/signup', (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  db.run(
    `
      INSERT INTO Utilizadores (firstName, lastName, email, password)
      VALUES (?, ?, ?, ?);
    `,
    [firstName, lastName, email, password],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Este email já está em uso.' });
        } else {
          console.error(err);
          return res
            .status(500)
            .json({ error: 'Erro interno do servidor.', details: err.message });
        }
      }

      res.json({ id: this.lastID });
    }
  );
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  db.get(
    `
      SELECT id, firstName, lastName, email
      FROM Utilizadores
      WHERE email = ? AND password = ?;
    `,
    [email, password],
    (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro interno do servidor.' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }

      // Generate JWT TOKEN
      const token = jwt.sign(
        {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
        'quiteria_key',
        { expiresIn: '1h' }
      );

      res.json({ token });
    }
  );
});

app.get('/utentes', (req, res) => {
  const page = req.query.page || 1;
  const pageSize = req.query.pageSize || 25;
  const searchTerm = req.query.searchTerm || '';

  const searchTermString = searchTerm.toString();

  const offset = (page - 1) * pageSize;

  const queryItems = `
  SELECT DISTINCT NUM_SEQUENCIAL, DATA_NASCIMENTO, SEXO, LOCALIDADE FROM Pacientes
  WHERE (CAST(NUM_SEQUENCIAL AS TEXT) LIKE ? OR DATA_NASCIMENTO LIKE ?)
  LIMIT ? OFFSET ?;
`;

  const queryTotalItems = `
  SELECT COUNT(DISTINCT NUM_SEQUENCIAL) AS totalItems FROM Pacientes
  WHERE (CAST(NUM_SEQUENCIAL AS TEXT) LIKE ? OR DATA_NASCIMENTO LIKE ?)
`;

  db.all(
    queryItems,
    [`%${searchTermString}%`, `%${searchTermString}%`, pageSize, offset],
    (err, items) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno do servidor' });
      } else {
        db.get(
          queryTotalItems,
          [`%${searchTermString}%`, `%${searchTermString}%`],
          (err, result) => {
            if (err) {
              console.error(err);
              res.status(500).json({ error: 'Erro interno do servidor' });
            } else {
              const totalItems = result ? result.totalItems : 0;

              // Retorne os itens paginados e o número total de registros
              res.json({ items, totalItems });
            }
          }
        );
      }
    }
  );
});

app.get('/exames/:num_sequencial', (req, res) => {
  const num_sequencial = req.params.num_sequencial;
  const searchTerm = req.query.searchTerm || '';

  let query;
  let params;

  if (searchTerm) {
    // If searchTerm is provided, filter by DESIGNACAO, DATA_EXAME, and EPISODIO
    query = `
      SELECT EXAME, DESIGNACAO, VALOR, UNIDADE, LIMITE, EPISODIO, DATA_EXAME, DATA_NASCIMENTO, SEXO, LOCALIDADE, NUM_SEQUENCIAL
      FROM Pacientes
      WHERE NUM_SEQUENCIAL = ?
        AND (DESIGNACAO LIKE ? OR DATA_EXAME LIKE ? OR EPISODIO LIKE ?);
    `;
    params = [
      num_sequencial,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
    ];
  } else {
    // If searchTerm is not provided, retrieve all records for the given NUM_SEQUENCIAL
    query = `
      SELECT EXAME, DESIGNACAO, VALOR, UNIDADE, LIMITE, EPISODIO, DATA_EXAME, DATA_NASCIMENTO, SEXO, LOCALIDADE, NUM_SEQUENCIAL
      FROM Pacientes
      WHERE NUM_SEQUENCIAL = ?;
    `;
    params = [num_sequencial];
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      res.json(rows);
    }
  });
});

app.get('/utentes-por-exame', (req, res) => {
  const designacao = req.query.designacao;

  if (!designacao) {
    return res
      .status(400)
      .json({ error: 'O parâmetro "designacao" é obrigatório.' });
  }

  const query = `
    SELECT NUM_SEQUENCIAL, DATA_NASCIMENTO, SEXO, LOCALIDADE, EXAME, DESIGNACAO, VALOR, UNIDADE, LIMITE, EPISODIO, DATA_EXAME
    FROM Pacientes
    WHERE DESIGNACAO LIKE ?
    ORDER BY DATA_EXAME DESC;
  `;

  // '%' para permitir correspondências parciais
  const partialDesignacao = `%${designacao}%`;

  db.all(query, [partialDesignacao], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      res.json(rows);
    }
  });
});

app.get('/exames-por-utente-designacao', (req, res) => {
  const { numSequencial, designacao } = req.query;

  if (!numSequencial || !designacao) {
    return res.status(400).json({
      error: 'Os parâmetros "numSequencial" e "designacao" são obrigatórios.',
    });
  }

  const query = `
    SELECT NUM_SEQUENCIAL, DATA_NASCIMENTO, SEXO, LOCALIDADE, EXAME, DESIGNACAO, VALOR, UNIDADE, LIMITE, EPISODIO, DATA_EXAME
    FROM Pacientes
    WHERE NUM_SEQUENCIAL = ? AND DESIGNACAO LIKE ?
    ORDER BY DATA_EXAME DESC;
  `;

  // '%' para permitir correspondências parciais
  const partialDesignacao = `%${designacao}%`;

  db.all(query, [numSequencial, partialDesignacao], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      res.json(rows);
    }
  });
});

app.get('/informacoes-gerais-exames-localidades', (req, res) => {
  const queryLocalidades = `
    SELECT DISTINCT LOCALIDADE
    FROM Pacientes
    WHERE LOCALIDADE IS NOT NULL AND LOCALIDADE <> ''
    GROUP BY LOCALIDADE;
  `;

  const queryExames = `
    SELECT DISTINCT DESIGNACAO
    FROM Pacientes
    WHERE DESIGNACAO IS NOT NULL AND DESIGNACAO <> ''
    GROUP BY DESIGNACAO;
  `;

  const formatResults = (results) =>
    results.map((result) => result[Object.keys(result)[0]]);

  db.all(queryLocalidades, [], (errLocalidades, localidades) => {
    if (errLocalidades) {
      console.error(errLocalidades);
      res.status(500).json({ error: 'Erro interno do servidor (localidades)' });
    } else {
      db.all(queryExames, [], (errExames, exames) => {
        if (errExames) {
          console.error(errExames);
          res.status(500).json({ error: 'Erro interno do servidor (exames)' });
        } else {
          res.json({
            localidades: formatResults(localidades),
            exames: formatResults(exames),
          });
        }
      });
    }
  });
});

app.get('/informacoes-gerais-exames-idades', (req, res) => {
  const queryDatas = `
    SELECT DISTINCT DATA_NASCIMENTO
    FROM Pacientes
    WHERE DATA_NASCIMENTO IS NOT NULL AND DATA_NASCIMENTO <> ''
    GROUP BY DATA_NASCIMENTO;
  `;

  const queryExames = `
    SELECT DISTINCT DESIGNACAO
    FROM Pacientes
    WHERE DESIGNACAO IS NOT NULL AND DESIGNACAO <> ''
    GROUP BY DESIGNACAO;
  `;

  const formatResults = (results) =>
    results.map((result) => result[Object.keys(result)[0]]);

  db.all(queryDatas, [], (errDatas, datas) => {
    if (errDatas) {
      console.error(errDatas);
      res.status(500).json({ error: 'Erro interno do servidor (datas)' });
    } else {
      db.all(queryExames, [], (errExames, exames) => {
        if (errExames) {
          console.error(errExames);
          res.status(500).json({ error: 'Erro interno do servidor (exames)' });
        } else {
          res.json({
            datas: formatResults(datas),
            exames: formatResults(exames),
          });
        }
      });
    }
  });
});

app.get('/utentes-por-localidade-designacao', (req, res) => {
  const { localidade, designacao } = req.query;

  if (!localidade || !designacao) {
    return res.status(400).json({
      error: 'Os parâmetros "localidade" e "designacao" são obrigatórios.',
    });
  }

  const query = `
    SELECT NUM_SEQUENCIAL, DATA_NASCIMENTO, SEXO, LOCALIDADE, EXAME, DESIGNACAO, VALOR, UNIDADE, LIMITE, EPISODIO, DATA_EXAME
    FROM Pacientes
    WHERE LOCALIDADE LIKE ? AND DESIGNACAO LIKE ?
    ORDER BY DATA_EXAME DESC;
  `;

  // '%' para permitir correspondências parciais
  const partialLocalidade = `%${localidade}%`;
  const partialDesignacao = `%${designacao}%`;

  db.all(query, [partialLocalidade, partialDesignacao], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } else {
      res.json(rows);
    }
  });
});

app.get('/utentes-por-idade-designacao', (req, res) => {
  const { exame, intervaloDataNascimento } = req.query;

  if (!exame || !intervaloDataNascimento) {
    return res.status(400).json({
      error:
        'Os parâmetros "exame" e "intervaloDataNascimento" são obrigatórios.',
    });
  }

  const [anoInicio, restante] = intervaloDataNascimento.split(' - ');
  const [anoFinal] = restante.split(' (');

  const startYear = parseInt(2021);

  if (isNaN(startYear)) {
    return res
      .status(400)
      .json({ error: 'Ano do intervaloDataNascimento inválido.' });
  }

  const query = `
    SELECT NUM_SEQUENCIAL, DATA_NASCIMENTO, SEXO, LOCALIDADE, EXAME, DESIGNACAO, VALOR, UNIDADE, LIMITE, EPISODIO, DATA_EXAME
    FROM Pacientes
    WHERE DESIGNACAO LIKE ? AND strftime('%Y', DATA_NASCIMENTO) BETWEEN ? AND ?
    ORDER BY DATA_NASCIMENTO ASC;
  `;

  db.all(
    query,
    [exame, anoInicio.toString(), anoFinal.toString()],
    (err, rows) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno do servidor' });
      } else {
        res.json(rows);
      }
    }
  );
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
