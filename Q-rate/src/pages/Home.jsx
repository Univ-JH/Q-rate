import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [publicWorkbooks, setPublicWorkbooks] = useState([]);
  const [publicQuestions, setPublicQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('workbooks');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false); 

  // 신규: 클릭한 문제집의 상세 정보를 담을 상태
  const [previewWorkbook, setPreviewWorkbook] = useState(null);

  const translateDifficulty = (diff) => ({ NONE: '미선택', EASY: '초급', MEDIUM: '중급', HARD: '고급' }[diff] || diff);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      if (!user && activeTab === 'questions') setActiveTab('workbooks');
    });

    const fetchPublicData = async () => {
      setLoading(true);
      try {
        const wbQuery = query(collection(db, 'workbooks'), where('visibility', '==', 'PUBLIC'));
        const wbSnap = await getDocs(wbQuery);
        setPublicWorkbooks(wbSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()));

        const qQuery = query(collection(db, 'questions'), where('visibility', '==', 'PUBLIC'));
        const qSnap = await getDocs(qQuery);
        setPublicQuestions(qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()));
      } catch (error) {
        console.error("데이터 로딩 에러:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPublicData();
    return () => unsubscribe();
  }, [activeTab]);

  const filteredWorkbooks = publicWorkbooks.filter(w => {
    if (!isLoggedIn && w.requireLogin !== false) return false;
    return (w.title && w.title.toLowerCase().includes(searchTerm.toLowerCase())) || 
           (w.description && w.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
           (w.tags && w.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
  });

  const filteredQuestions = publicQuestions.filter(q => 
    (q.subject && q.subject.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (q.content && q.content.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (q.tags && q.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const getBadgeColor = (diff) => {
    if (diff === 'EASY') return 'bg-green-100 text-green-700';
    if (diff === 'MEDIUM') return 'bg-yellow-100 text-yellow-700';
    if (diff === 'HARD') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700'; // NONE
  };

  return (
    <div className="w-full flex flex-col gap-8">
      
      {/* Hero 섹션 */}
      <div className="bg-gradient-to-br from-indigo-50 to-white rounded-3xl p-10 md:p-16 text-center shadow-sm border border-indigo-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 translate-x-1/3 translate-y-1/3"></div>
        
        <h1 className="relative text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
          지식을 <span className="text-primary">Q-rate</span> 하세요
        </h1>
        <p className="relative text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          가치 있는 문제를 탐색하고, 나만의 맞춤형 문제집을 만들어 공유해 보세요.
        </p>
        
        <div className="relative max-w-2xl mx-auto flex shadow-lg rounded-full overflow-hidden border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
          <div className="pl-6 flex items-center justify-center text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input 
            type="text" 
            placeholder="어떤 과목이나 문제집을 찾고 계신가요?" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-4 px-4 text-gray-700 outline-none text-base bg-transparent"
          />
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex justify-center space-x-2 md:space-x-8 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('workbooks')} 
          className={`py-4 px-2 text-lg font-semibold border-b-4 transition-colors ${activeTab === 'workbooks' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          📚 문제집 둘러보기 <span className="ml-1 text-sm bg-gray-100 px-2 py-0.5 rounded-full">{filteredWorkbooks.length}</span>
        </button>
        {isLoggedIn && (
          <button 
            onClick={() => setActiveTab('questions')} 
            className={`py-4 px-2 text-lg font-semibold border-b-4 transition-colors ${activeTab === 'questions' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            💡 낱개 문제 검색 <span className="ml-1 text-sm bg-gray-100 px-2 py-0.5 rounded-full">{filteredQuestions.length}</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="min-h-[400px]">
          {/* 문제집 리스트 */}
          {activeTab === 'workbooks' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWorkbooks.length === 0 && <p className="col-span-full text-center text-gray-500 py-10">조건에 맞는 문제집이 없습니다.</p>}
              
              {filteredWorkbooks.map(w => (
                // 카드 클릭 시 미리보기 모달을 띄우도록 수정
                <div key={w.id} onClick={() => setPreviewWorkbook(w)} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${getBadgeColor(w.difficulty)}`}>
                      {translateDifficulty(w.difficulty)}
                    </span>
                    <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                      {w.questionsInfo?.length}문항 • {w.totalScore}점
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors line-clamp-1">{w.title}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-grow">
                    {w.description || '설명이 제공되지 않은 문제집입니다.'}
                  </p>
                  
                  {w.tags && w.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {w.tags.slice(0, 3).map(t => <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{t}</span>)}
                      {w.tags.length > 3 && <span className="text-[10px] text-gray-400">+{w.tags.length - 3}</span>}
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100 flex justify-between items-center mt-auto">
                    <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                      {w.requireLogin !== false ? (
                        <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg> 회원 전용</>
                      ) : (
                        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg> 누구나</>
                      )}
                    </span>
                    <span className="text-sm font-bold text-primary group-hover:underline">정보 보기</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 개별 문제 리스트 */}
          {activeTab === 'questions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredQuestions.length === 0 && <p className="col-span-full text-center text-gray-500 py-10">조건에 맞는 문제가 없습니다.</p>}
              
              {filteredQuestions.map(q => (
                <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col shadow-sm hover:shadow-md transition-all">
                  <div className="flex gap-2 mb-3">
                    <span className="px-2 py-1 text-xs font-bold rounded-md bg-gray-100 text-gray-600">{q.subject || '과목미지정'}</span>
                    <span className={`px-2 py-1 text-xs font-bold rounded-md ${getBadgeColor(q.difficulty)}`}>{translateDifficulty(q.difficulty)}</span>
                  </div>
                  <p className="text-gray-800 font-medium mb-4 line-clamp-3 flex-grow">
                    {q.content}
                  </p>
                  
                  {q.tags && q.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {q.tags.slice(0, 3).map(t => <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{t}</span>)}
                    </div>
                  )}

                  <div className="mt-auto pt-3 border-t border-gray-100 flex justify-between items-center">
                     <span className="text-xs font-bold text-secondary bg-purple-50 px-2 py-1 rounded-md">
                      {q.type === 'MULTIPLE_CHOICE' ? '객관식' : q.type === 'SHORT_ANSWER' ? '주관식' : '서술식'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 신규: 문제집 미리보기 모달 */}
      {previewWorkbook && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4"
          onClick={() => setPreviewWorkbook(null)} // 여백 클릭 시 닫기
        >
          <div 
            className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()} // 모달 내부 클릭 시 닫히는 것 방지
          >
            {/* 상단 헤더 */}
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900 pr-8 leading-tight">
                {previewWorkbook.title}
              </h2>
              <button 
                onClick={() => setPreviewWorkbook(null)} 
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-800 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            {/* 배지 정보 */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className={`px-3 py-1 text-xs font-bold rounded-md ${getBadgeColor(previewWorkbook.difficulty)}`}>
                {translateDifficulty(previewWorkbook.difficulty)}
              </span>
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-md text-xs font-bold">
                총 {previewWorkbook.questionsInfo?.length}문항
              </span>
              <span className="bg-indigo-50 text-primary px-3 py-1 rounded-md text-xs font-bold">
                총 {previewWorkbook.totalScore}점
              </span>
            </div>

            {/* 설명 영역 */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                {previewWorkbook.description || '문제집에 대한 설명이 제공되지 않았습니다.'}
              </p>
            </div>

            {/* 태그 영역 */}
            {previewWorkbook.tags && previewWorkbook.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {previewWorkbook.tags.map(t => (
                  <span key={t} className="text-xs font-medium text-gray-500 border border-gray-200 bg-white px-2.5 py-1 rounded-full shadow-sm">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* 하단 액션 버튼 */}
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
              <button 
                onClick={() => setPreviewWorkbook(null)} 
                className="px-5 py-2.5 text-sm text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors"
              >
                돌아가기
              </button>
              <button 
                onClick={() => navigate(`/solve/${previewWorkbook.id}`)} 
                className="px-6 py-2.5 text-sm bg-primary hover:bg-primaryHover text-white font-bold rounded-xl shadow-md transition-colors flex items-center gap-2"
              >
                📝 응시 시작하기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}