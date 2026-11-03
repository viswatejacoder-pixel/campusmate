// Mock API used only for the T-090 `-v3` screenshots. Fake data, no Express, no MySQL. Run: node docs/evidence/mock-api-v3.mjs (port 3000).
// 8 pending tasks (2 overdue, deliberately not in rank order) + 4 completed, so the five-task preview and "View all tasks" are visible.
import http from 'node:http';
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const subjects = [{ id: 1, name: 'Data Structures' }, { id: 2, name: 'DBMS' }, { id: 3, name: 'Operating Systems' }];
const mk = (id, title, sid, due, priority, o = {}) => ({ id, title, description: '', subjectId: sid, subjectName: subjects[sid - 1].name, dueDate: day(due), priority, isCompleted: false, isOverdue: false, isDueSoon: false, ...o });
const tasks = [
  mk(1, 'Read process synchronization chapter', 3, 9, 'low'),
  mk(2, 'Linked list assignment', 1, -2, 'high', { isOverdue: true }),
  mk(3, 'SQL joins practice set', 2, 7, 'medium'),
  mk(4, 'DBMS normalization worksheet', 2, 1, 'high', { isDueSoon: true }),
  mk(5, 'Binary tree viva notes', 1, -6, 'medium', { isOverdue: true }),
  mk(6, 'OS scheduling lab report', 3, 2, 'medium', { isDueSoon: true }),
  mk(7, 'Revise B-trees', 1, 5, 'low'),
  mk(8, 'Deadlock handling summary', 3, 12, 'low'),
  mk(9, 'Stack and queue quiz', 1, -5, 'medium', { isCompleted: true }),
  mk(10, 'ER diagram', 2, -4, 'low', { isCompleted: true }),
  mk(11, 'Memory management notes', 3, -3, 'low', { isCompleted: true }),
  mk(12, 'Graph traversal lab', 1, -1, 'high', { isCompleted: true }),
];
const summary = { pending: 8, completed: 4, overdue: 2, dueSoon: 2 };
const send = (res, body) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/auth/me') return send(res, { user: { id: 1, name: 'Asha Verma', email: 'asha.test@example.com' } });
  if (url.pathname === '/api/subjects') return send(res, { subjects });
  if (url.pathname === '/api/tasks/summary') return send(res, summary);
  if (url.pathname === '/api/tasks') {
    let list = tasks.slice();
    const p = url.searchParams;
    if (p.get('status') === 'pending') list = list.filter((t) => !t.isCompleted);
    if (p.get('status') === 'completed') list = list.filter((t) => t.isCompleted);
    if (p.get('dueFrom')) list = list.filter((t) => t.dueDate >= p.get('dueFrom'));
    if (p.get('q')) list = list.filter((t) => t.title.toLowerCase().includes(p.get('q').toLowerCase()));
    list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return send(res, { tasks: list });
  }
  res.writeHead(404); res.end('{}');
}).listen(3000, () => console.log('mock api on 3000'));
