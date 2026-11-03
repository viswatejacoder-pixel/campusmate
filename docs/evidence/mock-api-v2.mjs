// Mock API used only for the T-090 `-v2` screenshots. Fake data, no Express, no MySQL. Run: node docs/evidence/mock-api-v2.mjs (port 3000).
import http from 'node:http';
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const subjects = [{ id: 1, name: 'Data Structures' }, { id: 2, name: 'DBMS' }, { id: 3, name: 'Operating Systems' }];
const mk = (id, title, sid, due, priority, o = {}) => ({ id, title, description: '', subjectId: sid, subjectName: subjects[sid - 1].name, dueDate: day(due), priority, isCompleted: false, isOverdue: false, isDueSoon: false, ...o });
const tasks = [
  mk(1, 'Linked list assignment', 1, -2, 'high', { isOverdue: true }),
  mk(2, 'DBMS normalization worksheet', 2, 1, 'high', { isDueSoon: true }),
  mk(3, 'OS scheduling lab report', 3, 2, 'medium', { isDueSoon: true }),
  mk(4, 'Revise B-trees', 1, 5, 'low'),
  mk(5, 'SQL joins practice set', 2, 7, 'medium'),
  mk(6, 'Read process synchronization chapter', 3, 9, 'low'),
  mk(7, 'Stack and queue quiz', 1, -5, 'medium', { isCompleted: true }),
  mk(8, 'ER diagram', 2, -4, 'low', { isCompleted: true }),
  mk(9, 'Memory management notes', 3, -3, 'low', { isCompleted: true }),
  mk(10, 'Graph traversal lab', 1, -1, 'high', { isCompleted: true }),
];
const summary = { pending: 6, completed: 4, overdue: 1, dueSoon: 2 };
const send = (res, body) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/auth/me') return send(res, { user: { id: 1, name: 'Asha Verma', email: 'asha.test@example.com' } });
  if (url.pathname === '/api/subjects') return send(res, { subjects });
  if (url.pathname === '/api/tasks/summary') return send(res, summary);
  if (url.pathname === '/api/tasks') {
    let list = tasks.slice();
    if (url.searchParams.get('status') === 'pending') list = list.filter((t) => !t.isCompleted);
    const from = url.searchParams.get('dueFrom');
    if (from) list = list.filter((t) => t.dueDate >= from);
    list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return send(res, { tasks: list });
  }
  res.writeHead(404); res.end('{}');
}).listen(3000, () => console.log('mock api on 3000'));
