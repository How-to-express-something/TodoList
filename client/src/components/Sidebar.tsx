import { NavLink } from 'react-router-dom';
import MiniPlayer from './MiniPlayer';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header" style={{ color: 'var(--accent)' }}>TodoList</div>
      <nav className="sidebar-nav">
        <NavLink to="/todos" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>📋</span> 事务
        </NavLink>
        <NavLink to="/ideas" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>💡</span> New Ideas
        </NavLink>
        <NavLink to="/categories" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>📁</span> 分类
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>👤</span> 我的
        </NavLink>
      </nav>
      <MiniPlayer />
    </aside>
  );
}
