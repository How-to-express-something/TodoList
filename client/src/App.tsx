import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TodoList from './components/TodoList';
import TodoDetail from './components/TodoDetail';
import NewIdeasPage from './components/NewIdeasPage';
import CategoriesPage from './components/CategoriesPage';
import AudioPage from './components/AudioPage';
import LogsPage from './components/LogsPage';
import ProfilePage from './components/ProfilePage';
import './styles/sidebar.css';

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/todos" replace />} />
          <Route path="/todos" element={<TodoList />} />
          <Route path="/todos/:id" element={<TodoDetail />} />
          <Route path="/ideas" element={<NewIdeasPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/audio" element={<AudioPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </main>
    </div>
  );
}
