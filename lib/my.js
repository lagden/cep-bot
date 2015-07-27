'use strict';

var mysql = require('mysql');
var config = require('../config-mysql.json');
var pool = mysql.createPool({
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
  return new Promise(function(resolve, reject) {
    pool.getConnection(function(errPool, conn) {
      if (errPool) {
        reject(errPool);
      } else {
        conn.query(query, param, function(err, rows, fields) {
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

// Executa todas as queries
function runAllQueries(queries) {
  return Promise.all(queries.map(function(query) {
    return q(query);
  }));
}

module.exports = {
  'q': q,
  'runAllQueries': runAllQueries,
};
