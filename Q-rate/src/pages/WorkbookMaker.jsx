import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function WorkbookMaker() {
  const [questions, setQuestions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]); // 선택된 문제의 ID 배열
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. 컴포넌트가 마운트되면 내 문제 목록 불러오기
  useEffect(() => {
    // Firebase 인증 상태가 확인될 때까지 기다림
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchMyQuestions(user.uid);
      } else {
        setQuestions([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchMyQuestions = async (uid) => {
    try {
      // 내 UID와 일치하는 문제만 가져오는 쿼리 생성
      const q = query(collection(db, 'questions'), where('creatorUid', '==', uid));
      const querySnapshot = await getDocs(q);
      
      const fetchedQuestions = querySnapshot.docs.map(doc => ({
        id: doc.id, // Firestore 문서의 고유 ID
        ...doc.data()
      }));
      
      setQuestions(fetchedQuestions);
    } catch (error) {
      console.error("Error fetching questions: ", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. 체크박스 선택/해제 핸들러
  const handleCheckboxChange = (questionId) => {
    setSelectedIds(prev => 
      prev.includes(questionId) 
        ? prev.filter(id => id !== questionId) // 이미 있으면 제거
        : [...prev, questionId] // 없으면 추가
    );
  };

  // 3. 문제집 생성 (DB 저장) 핸들러
  const handleCreateWorkbook = async (e) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      alert('최소 1개 이상의 문제를 선택해 주세요.');
      return;
    }

    try {
      const workbookData = {
        title: title,
        description: description,
        creatorUid: auth.currentUser.uid,
        questionIds: selectedIds, // 선택한 문제들의 ID 배열만 저장
        createdAt: new Date(),
      };

      // 'workbooks' 컬렉션에 문제집 데이터 저장
      await addDoc(collection(db, 'workbooks'), workbookData);
      
      alert('문제집이 성공적으로 생성되었습니다!');
      setTitle('');
      setDescription('');
      setSelectedIds([]); // 선택 초기화
      
    } catch (error) {
      console.error("Error creating workbook: ", error);
      alert('문제집 생성 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div>데이터를 불러오는 중입니다...</div>;
  if (!auth.currentUser) return <div>로그인이 필요한 서비스입니다.</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px' }}>
      <h2>📚 내 문제집 만들기</h2>
      
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        {/* 왼쪽: 내 문제 목록 */}
        <div style={{ flex: 1, border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
          <h3>내가 만든 문제 목록</h3>
          {questions.length === 0 ? (
            <p>아직 작성한 문제가 없습니다.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {questions.map((q) => (
                <li key={q.id} style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(q.id)}
                      onChange={() => handleCheckboxChange(q.id)}
                      style={{ marginTop: '5px' }}
                    />
                    <div>
                      <span style={{ fontSize: '12px', color: '#007bff', fontWeight: 'bold' }}>
                        [{q.type === 'MULTIPLE_CHOICE' ? '객관식' : q.type === 'SHORT_ANSWER' ? '주관식' : '서술식'}]
                      </span>
                      <p style={{ margin: '5px 0 0 0' }}>{q.content}</p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 오른쪽: 문제집 생성 폼 */}
        <div style={{ flex: 1, border: '1px solid #ddd', padding: '15px', borderRadius: '8px', height: 'fit-content' }}>
          <h3>새 문제집 정보</h3>
          <form onSubmit={handleCreateWorkbook} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="text" 
              placeholder="문제집 제목" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ padding: '8px' }}
            />
            <textarea 
              placeholder="문제집에 대한 설명" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              style={{ padding: '8px' }}
            />
            <p style={{ fontSize: '14px', color: '#666' }}>선택된 문제: <strong>{selectedIds.length}</strong>개</p>
            <button type="submit" style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              문제집 만들기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}