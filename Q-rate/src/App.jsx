import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

import Home from './pages/Home';
import Login from './pages/Login'; 
import CreateQuestion from './pages/CreateQuestion'; 
import WorkbookMaker from './pages/WorkbookMaker'; 
import MyPage from './pages/MyPage'; 
import SolveWorkbook from './pages/SolveWorkbook';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setIsLoggedIn(!!user));
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/'; 
    } catch (error) {
      console.error('로그아웃 에러:', error);
    }
  };

  return (
    <Router>
      <div className="min-h-screen flex flex-col text-gray-800">
        {/* 상단 네비게이션 바 */}
        <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              
              {/* 왼쪽: 로고 및 메인 메뉴 */}
              <div className="flex items-center space-x-8">
                <Link to="/" className="text-2xl font-extrabold text-primary tracking-tight">
                  Q-rate
                </Link>
                <div className="hidden md:flex space-x-6">
                  <Link to="/create" className="text-gray-600 hover:text-primary font-medium transition-colors">문제 출제</Link>
                  <Link to="/workbook" className="text-gray-600 hover:text-primary font-medium transition-colors">문제집 만들기</Link>
                </div>
              </div>
              
              {/* 오른쪽: 인증 메뉴 */}
              <div className="flex items-center space-x-4">
                {isLoggedIn ? (
                  <>
                    <Link to="/mypage" className="text-sm font-medium text-gray-700 hover:text-primary">마이페이지</Link>
                    <button 
                      onClick={handleLogout} 
                      className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      로그아웃
                    </button>
                  </>
                ) : (
                  <Link 
                    to="/login" 
                    className="px-5 py-2 text-sm font-bold text-white bg-primary hover:bg-primaryHover rounded-lg shadow-md transition-colors"
                  >
                    로그인 / 가입
                  </Link>
                )}
              </div>

            </div>
          </div>
        </nav>

        {/* 본문 영역 */}
        <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/create" element={<CreateQuestion />} />
            <Route path="/workbook" element={<WorkbookMaker />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/solve/:workbookId" element={<SolveWorkbook />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;