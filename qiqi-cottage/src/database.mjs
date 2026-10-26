import { DatabaseSync } from 'node:sqlite';
export function sqliteAdapter(filename) {
  const database = new DatabaseSync(filename);
  database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  const adapter = {
    exec: sql=>database.exec(sql),
    prepare(sql) {
      let args=[];
      return { bind(...values){args=values;return this}, async first(){return database.prepare(sql).get(...args)||null}, async all(){return {results:database.prepare(sql).all(...args)}}, async run(){return database.prepare(sql).run(...args)}, _run(){return database.prepare(sql).run(...args)} };
    },
    async batch(statements) { database.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s._run());database.exec('COMMIT');return results}catch(e){database.exec('ROLLBACK');throw e} },
    close(){database.close()}
  };
  return adapter;
}
