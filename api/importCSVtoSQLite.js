// const fs = require('fs');
// const sqlite3 = require('sqlite3').verbose();
// const csv = require('csv-parser');

// const db = new sqlite3.Database('database.db');

// db.serialize(() => {
//   // Crie a tabela no SQLite com base nas colunas do CSV
//   db.run(`
//     CREATE TABLE IF NOT EXISTS Pacientes (
//       EXAME TEXT,
//       DESIGNACAO TEXT,
//       VALOR REAL,
//       UNIDADE TEXT,
//       LIMITE REAL,
//       EPISODIO TEXT,
//       DATA_NASCIMENTO TEXT,
//       DATA_EXAME TEXT,
//       SEXO TEXT,
//       LOCALIDADE TEXT,
//       NUM_SEQUENCIAL INTEGER
//     );
//   `);

//   // Leia os dados do CSV e insira na tabela do SQLite
//   const stmt = db.prepare(`
//     INSERT INTO Pacientes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
//   `);

//   const filePath = 'data/information.csv';
//   fs.createReadStream(filePath)
//     .pipe(csv())
//     .on('data', (row) => {
//       stmt.run(
//         row.EXAME,
//         row.DESIGNACAO,
//         row.VALOR,
//         row.UNIDADE,
//         row.LIMITE,
//         row.EPISODIO,
//         row.DATA_NASCIMENTO,
//         row.DATA_EXAME,
//         row.SEXO,
//         row.LOCALIDADE,
//         row.NUM_SEQUENCIAL
//       );
//     })
//     .on('error', (error) => {
//       console.error(error.message);
//     })
//     .on('end', () => {
//       stmt.finalize();
//       console.log('Importação concluída.');
//       db.close();
//     });
// });

const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');

const db = new sqlite3.Database('database.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS Pacientes (
      EXAME TEXT,
      DESIGNACAO TEXT,
      VALOR REAL,
      UNIDADE TEXT,
      LIMITE REAL,
      EPISODIO TEXT,
      DATA_NASCIMENTO TEXT,
      DATA_EXAME TEXT,
      SEXO TEXT,
      LOCALIDADE TEXT,
      NUM_SEQUENCIAL INTEGER
    );
  `);

  const stmt = db.prepare(`
    INSERT INTO Pacientes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const filePath = 'data/information.csv';

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      const rowData = [
        row.EXAME,
        row.DESIGNACAO,
        parseFloat(row.VALOR.replace(',', '.')), // Converter VALOR para float
        row.UNIDADE,
        parseFloat(row.LIMITE.replace(',', '.')), // Converter LIMITE para float
        row.EPISODIO,
        row.DATA_NASCIMENTO,
        row.DATA_EXAME,
        row.SEXO,
        row.LOCALIDADE,
        parseInt(row.NUM_SEQUENCIAL, 10), // Converter NUM_SEQUENCIAL para inteiro
      ];

      // Verificar se o número de valores corresponde ao número de colunas na tabela
      if (rowData.length === 11) {
        stmt.run(rowData, function (err) {
          if (err) {
            console.error('Erro ao inserir linha:', rowData, err);
          }
        });
      } else {
        console.error('Número incorreto de valores na linha:', rowData);
      }
    })
    .on('end', () => {
      // Finalizar a declaração e fechar o base de dados após a inserção de todos os dados
      stmt.finalize((err) => {
        if (err) {
          console.error('Erro ao finalizar a declaração:', err);
        } else {
          console.log('Importação concluída.');
        }
        db.close();
      });
    })
    .on('error', (error) => {
      console.error(error.message);
      db.close();
    });
});
