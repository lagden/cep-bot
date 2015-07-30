'use strict';

import mysql from 'mysql';
import config from '../config-mysql.json';

let pool = mysql.createPool({
  connectionLimit: 1,
  waitForConnections: true,
  host: config.host,
  user: config.user,
  password: config.pass,
  database: config.db
});

// Executa query
function q(query, param) {
  param = param || null;
  return new Promise((resolve, reject) => {
    pool.getConnection((errPool, conn) => {
      if (errPool) {
        reject(errPool);
      } else {
        conn.query(query, param, (err, rows, fields) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows, fields);
          }
          conn.release();
        });
      }
    });
  });
}

// Executa todas as queries em paralelo
function runAllQueries(queries) {
  return Promise.all(queries.map(q));
}

export {q, runAllQueries};
