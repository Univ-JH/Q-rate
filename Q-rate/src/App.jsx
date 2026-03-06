import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';
import CreateQuestion from './pages/CreateQuestion';
import WorkbookMaker from './pages/WorkbookMaker';

function App() {
  return (
    <Router>
      <nav style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
        <Link to="/" style={{ marginRight: '10px' }}>홈</Link>
        <Link to="/login" style={{ marginRight: '10px' }}>로그인</Link>
        <Link to="/create" style={{ marginRight: '10px' }}>문제 출제</Link>
        <Link to="/workbook">문제집 만들기</Link> {/* 추가됨 */}
      </nav>

      <div style={{ padding: '20px' }}>
        <Routes>
          <Route path="/" element={<div><h1>홈</h1></div>} />
          <Route path="/login" element={<Login />} />
          <Route path="/create" element={<CreateQuestion />} />
          <Route path="/workbook" element={<WorkbookMaker />} /> {/* 연결 완료 */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;