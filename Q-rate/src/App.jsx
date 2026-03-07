import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase'; // firebase.js 경로 확인

import Login from './pages/Login'; 
import CreateQuestion from './pages/CreateQuestion'; 
import WorkbookMaker from './pages/WorkbookMaker'; 
import MyPage from './pages/MyPage';
import SolveWorkbook from './pages/SolveWorkbook';
import Home from './pages/Home';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 앱이 실행될 때 로그인 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user); // user가 있으면 true, 없으면 false
    });
    return () => unsubscribe();
  }, []);

  // 로그아웃 처리 함수
  const handleLogout = async () => {
    try {
      await signOut(auth);
      alert('로그아웃 되었습니다.');
      window.location.href = '/'; // 홈으로 리다이렉트
    } catch (error) {
      console.error('로그아웃 에러:', error);
    }
  };

  return (
    <Router>
      <nav style={{ padding: '15px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link to="/" style={{ marginRight: '15px', fontWeight: 'bold', fontSize: '18px', textDecoration: 'none', color: '#0056b3' }}>Q-rate</Link>
          <Link to="/create" style={{ marginRight: '15px', textDecoration: 'none', color: '#333' }}>문제 출제</Link>
          <Link to="/workbook" style={{ textDecoration: 'none', color: '#333' }}>문제집 만들기</Link>
        </div>
        
        {/* 로그인 상태에 따라 버튼 동적 변경 */}
        <div>
          {isLoggedIn ? (
            <>
              <Link to="/mypage" style={{ marginRight: '15px', textDecoration: 'none', color: '#333' }}>마이페이지</Link>
              <button onClick={handleLogout} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                로그아웃
              </button>
            </>
          ) : (
            <Link to="/login" style={{ textDecoration: 'none', color: '#0056b3', fontWeight: 'bold' }}>로그인</Link>
          )}
        </div>
      </nav>

      <div style={{ padding: '20px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create" element={<CreateQuestion />} />
          <Route path="/workbook" element={<WorkbookMaker />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/solve/:workbookId" element={<SolveWorkbook />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;