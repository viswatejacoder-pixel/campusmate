import TaskItem from './TaskItem.jsx';

// `locked`, `pendingTaskId` and the three handlers (T-080 M3) are passed straight to each TaskItem; all are optional.
// `noMatch` (T-080 M5): the user has tasks but none match the current filters, which is not the same as having no tasks.
export default function TaskList({ tasks, noMatch = false, locked = false, pendingTaskId = null, onToggle, onEdit, onDelete }) {
  if (tasks.length === 0) {
    return <p className="empty-state">{noMatch ? 'No tasks match your current filters. Try changing or clearing them.' : 'You have no tasks yet.'}</p>;
  }
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          locked={locked}
          pending={pendingTaskId === task.id}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
