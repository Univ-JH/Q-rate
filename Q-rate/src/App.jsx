import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// 임시 페이지 컴포넌트 (나중에 src/pages/ 폴더로 분리합니다)
const Home = () => <div><h1>메인 홈</h1><Link to="/create">문제집 만들기</Link></div>;
const Login = () => <div><h1>로그인 페이지</h1></div>;
const CreateWorkbook = () => <div><h1>문제 및 문제집 생성 페이지</h1></div>;
const SolveWorkbook = () => <div><h1>문제 풀기 및 채점 페이지</h1></div>;

function App() {
  return (
    <Router>
      <nav style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
        <Link to="/" style={{ marginRight: '10px' }}>홈</Link>
        <Link to="/login" style={{ marginRight: '10px' }}>로그인</Link>
        <Link to="/create">문제 출제</Link>
      </nav>

      <div style={{ padding: '20px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create" element={<CreateWorkbook />} />
          <Route path="/solve/:workbookId" element={<SolveWorkbook />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;