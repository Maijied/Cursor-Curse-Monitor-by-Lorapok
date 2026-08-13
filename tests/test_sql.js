const initSqlJs = require('sql.js');

async function test() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("CREATE TABLE ItemTable (key TEXT, value TEXT);");
  db.run("INSERT INTO ItemTable VALUES (?, ?)", ['cursorAuth/accessToken', 'test_token']);
  
  try {
    const resExec = db.exec("SELECT value FROM ItemTable WHERE key = ?", ['cursorAuth/accessToken']);
    console.log("exec with params worked:", JSON.stringify(resExec));
  } catch (e) {
    console.log("exec with params FAILED:", e.message);
  }
}
test();
