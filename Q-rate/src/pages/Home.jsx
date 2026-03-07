import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  
  // 전체 공개 데이터 상태
  const [publicWorkbooks, setPublicWorkbooks] = useState([]);
  const [publicQuestions, setPublicQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI 상태 관리
  const [activeTab, setActiveTab] = useState('workbooks'); // 'workbooks' 또는 'questions'
  const [searchTerm, setSearchTerm] = useState(''); // 검색어

  // 번역 헬퍼 함수
  const translateDifficulty = (diff) => ({ EASY: '초급', MEDIUM: '중급', HARD: '고급' }[diff] || diff);

  useEffect(() => {
    const fetchPublicData = async () => {
      setLoading(true);
      try {
        // 1. 전체 공개된 문제집 불러오기
        const wbQuery = query(collection(db, 'workbooks'), where('visibility', '==', 'PUBLIC'));
        const wbSnap = await getDocs(wbQuery);
        const fetchedWorkbooks = wbSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // 최신순 정렬
        fetchedWorkbooks.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());
        setPublicWorkbooks(fetchedWorkbooks);

        // 2. 전체 공개된 개별 문제 불러오기
        const qQuery = query(collection(db, 'questions'), where('visibility', '==', 'PUBLIC'));
        const qSnap = await getDocs(qQuery);
        const fetchedQuestions = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // 최신순 정렬
        fetchedQuestions.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());
        setPublicQuestions(fetchedQuestions);

      } catch (error) {
        console.error("데이터 로딩 에러:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicData();
  }, []);

  // 검색어에 따른 데이터 필터링 (제목, 설명, 과목, 문제 내용 등에 검색어가 포함되어 있는지 확인)
  const filteredWorkbooks = publicWorkbooks.filter(w => 
    (w.title && w.title.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (w.description && w.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredQuestions = publicQuestions.filter(q => 
    (q.subject && q.subject.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (q.content && q.content.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      
      {/* 히어로(Hero) & 검색 섹션 */}
      <div style={{ textAlign: 'center', padding: '50px 20px', backgroundColor: '#f0f8ff', borderRadius: '12px', marginBottom: '30px' }}>
        <h1 style={{ color: '#0056b3', margin: '0 0 10px 0', fontSize: '36px' }}>Q-rate에 오신 것을 환영합니다!</h1>
        <p style={{ color: '#555', fontSize: '16px', marginBottom: '30px' }}>가치 있는 문제를 큐레이션하고, 다른 사람들과 지식을 공유해 보세요.</p>
        
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex' }}>
          <input 
            type="text" 
            placeholder="어떤 문제나 문제집을 찾고 계신가요?" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, padding: '15px', fontSize: '16px', borderRadius: '30px 0 0 30px', border: '1px solid #ccc', outline: 'none' }}
          />
          <button style={{ padding: '15px 30px', fontSize: '16px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '0 30px 30px 0', cursor: 'pointer', fontWeight: 'bold' }}>
            검색
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', gap: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px', justifyContent: 'center' }}>
        <button onClick={() => setActiveTab('workbooks')} style={tabStyle(activeTab === 'workbooks')}>
          📚 공개 문제집 ({filteredWorkbooks.length})
        </button>
        <button onClick={() => setActiveTab('questions')} style={tabStyle(activeTab === 'questions')}>
          💡 공개 개별 문제 ({filteredQuestions.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>데이터를 불러오는 중입니다...</div>
      ) : (
        <div style={{ padding: '10px 0' }}>
          
          {/* 문제집 리스트 렌더링 */}
          {activeTab === 'workbooks' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {filteredWorkbooks.length === 0 && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#888' }}>조건에 맞는 문제집이 없습니다.</p>}
              {filteredWorkbooks.map(w => (
                <div key={w.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={badgeStyle(w.difficulty)}>{translateDifficulty(w.difficulty)}</span>
                    <span style={{ fontSize: '12px', color: '#666' }}>{w.questionsInfo?.length}문항 / {w.totalScore}점</span>
                  </div>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#333' }}>{w.title}</h3>
                  <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px', height: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {w.description || '설명이 없습니다.'}
                  </p>
                  <div style={{ borderTop: '1px solid #eee', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#999' }}>{w.requireLogin !== false ? '👤 회원 전용' : '🌐 누구나'}</span>
                    <button onClick={() => navigate(`/solve/${w.id}`)} style={{ padding: '8px 15px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
                      응시하기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 개별 문제 리스트 렌더링 */}
          {activeTab === 'questions' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {filteredQuestions.length === 0 && <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#888' }}>조건에 맞는 문제가 없습니다.</p>}
              {filteredQuestions.map(q => (
                <div key={q.id} style={cardStyle}>
                  <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                    <span style={{...badgeStyle(), backgroundColor: '#e9ecef', color: '#333'}}>{q.subject || '과목미지정'}</span>
                    <span style={badgeStyle(q.difficulty)}>{translateDifficulty(q.difficulty)}</span>
                  </div>
                  <p style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#333', lineHeight: '1.5' }}>
                    {q.content.length > 80 ? q.content.substring(0, 80) + '...' : q.content}
                  </p>
                  <div style={{ textAlign: 'right', marginTop: 'auto' }}>
                    <span style={{ fontSize: '12px', color: '#0056b3', fontWeight: 'bold' }}>
                      [{q.type === 'MULTIPLE_CHOICE' ? '객관식' : q.type === 'SHORT_ANSWER' ? '주관식' : '서술식'}]
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// 스타일 헬퍼
const tabStyle = (isActive) => ({
  padding: '12px 24px', cursor: 'pointer', border: 'none', background: 'none',
  borderBottom: isActive ? '3px solid #0056b3' : '3px solid transparent',
  color: isActive ? '#0056b3' : '#666', fontWeight: isActive ? 'bold' : 'normal', fontSize: '16px'
});

const cardStyle = {
  border: '1px solid #eee', borderRadius: '8px', padding: '20px', backgroundColor: 'white', 
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s',
  ':hover': { transform: 'translateY(-5px)', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }
};

const badgeStyle = (difficulty) => {
  let bg = '#6c757d';
  if (difficulty === 'EASY') bg = '#28a745';
  if (difficulty === 'MEDIUM') bg = '#ffc107';
  if (difficulty === 'HARD') bg = '#dc3545';
  return { padding: '3px 8px', borderRadius: '4px', backgroundColor: bg, color: difficulty === 'MEDIUM' ? '#333' : 'white', fontSize: '12px', fontWeight: 'bold' };
};