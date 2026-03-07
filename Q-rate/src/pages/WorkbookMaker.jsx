import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function WorkbookMaker() {
  const [questions, setQuestions] = useState([]); 
  const [selectedQuestions, setSelectedQuestions] = useState([]); 
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PRIVATE'); // 신규: 문제집 공개 여부 상태
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [loading, setLoading] = useState(true);
  const [requireLogin, setRequireLogin] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) await fetchMyQuestions(user.uid);
      else setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchMyQuestions = async (uid) => {
    const q = query(collection(db, 'questions'), where('creatorUid', '==', uid));
    const querySnapshot = await getDocs(q);
    const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setQuestions(fetched);
    setLoading(false);
  };

  const handleAdd = (q) => {
    if (selectedQuestions.find(sq => sq.id === q.id)) return; 
    setSelectedQuestions([...selectedQuestions, { ...q, score: 10 }]);
  };

  const handleRemove = (id) => setSelectedQuestions(selectedQuestions.filter(q => q.id !== id));

  const handleScoreChange = (id, newScore) => {
    setSelectedQuestions(selectedQuestions.map(q => q.id === id ? { ...q, score: Number(newScore) } : q));
  };

  const moveQuestion = (index, direction) => {
    const newArr = [...selectedQuestions];
    if (direction === 'UP' && index > 0) [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
    else if (direction === 'DOWN' && index < newArr.length - 1) [newArr[index + 1], newArr[index]] = [newArr[index], newArr[index + 1]];
    setSelectedQuestions(newArr);
  };

  const handleCreateWorkbook = async (e) => {
    e.preventDefault();
    if (selectedQuestions.length === 0) return alert('최소 1개의 문제를 담아주세요.');

    try {
      const structuredQuestions = selectedQuestions.map((q, index) => ({ questionId: q.id, order: index + 1, score: q.score }));
      const totalScore = structuredQuestions.reduce((sum, q) => sum + q.score, 0);

      const workbookData = {
        title,
        description,
        difficulty, // DB에 난이도 추가 저장
        visibility, 
        requireLogin,
        creatorUid: auth.currentUser.uid,
        questionsInfo: structuredQuestions, 
        totalScore,
        createdAt: new Date(),
      };

      // Firestore에 저장 후 생성된 문서 참조(docRef) 받기
      const docRef = await addDoc(collection(db, 'workbooks'), workbookData);
      
      alert(`문제집이 생성되었습니다!\n(총점: ${totalScore}점)`);
      
      // 링크 공개일 경우 바로 링크를 알려주기
      if (visibility === 'LINK' || visibility === 'PUBLIC') {
        const shareLink = `${window.location.origin}/solve/${docRef.id}`;
        alert(`공유 링크: ${shareLink}\n(클립보드에 복사해서 사용하세요)`);
        console.log("공유 링크:", shareLink);
      }

      setTitle(''); setDescription(''); setDifficulty('MEDIUM'); setVisibility('PRIVATE'); setSelectedQuestions([]);
    } catch (error) {
      console.error(error);
      alert('생성 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div>데이터 로딩 중...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px' }}>
      <h2>📚 맞춤형 문제집 제작</h2>
      
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        <div style={{ flex: 1, border: '1px solid #ddd', padding: '15px', borderRadius: '8px', maxHeight: '600px', overflowY: 'auto' }}>
          <h3>보관함 (클릭하여 추가)</h3>
          {questions.map((q) => (
            <div key={q.id} onClick={() => handleAdd(q)} style={{ border: '1px solid #eee', padding: '10px', marginBottom: '10px', cursor: 'pointer', borderRadius: '4px', backgroundColor: '#fdfdfd' }}>
              <span style={{ fontSize: '12px', color: '#888', marginRight:'10px' }}>{q.subject || '과목미지정'}</span>
              <p style={{ margin: '5px 0 0 0' }}>{q.content.substring(0, 30)}...</p>
            </div>
          ))}
        </div>

        <div style={{ flex: 2, border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
          <h3>새 문제집 정보</h3>
          <form onSubmit={handleCreateWorkbook} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="text" placeholder="문제집 제목" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ padding: '8px' }} />
            <textarea placeholder="설명" value={description} onChange={(e) => setDescription(e.target.value)} rows="2" style={{ padding: '8px' }} />
            
            {/* 신규: 문제집 난이도 설정 */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '14px' }}>문제집 난이도</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px' }}>
                  <option value="EASY">초급</option>
                  <option value="MEDIUM">중급</option>
                  <option value="HARD">고급</option>
                </select>
              </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={{ fontWeight: 'bold', fontSize: '14px' }}>문제집 공개 설정</label>
              <select 
                value={visibility} 
                onChange={(e) => setVisibility(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px', backgroundColor: '#f0f8ff' }}
              >
                <option value="PRIVATE">🔒 비공개 (나만 응시 가능)</option>
                <option value="LINK">🔗 링크 공개 (링크를 아는 사람만 응시 가능)</option>
                <option value="PUBLIC">🌐 전체 공개 (누구나 검색 및 응시 가능)</option>
              </select>
            </div>
            
            <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontWeight: 'bold', fontSize: '14px' }}>응시 권한</label>
                <select 
                  value={requireLogin ? 'MEMBER' : 'ANYONE'} 
                  onChange={(e) => setRequireLogin(e.target.value === 'MEMBER')} 
                  style={{ width: '100%', padding: '8px', marginTop: '5px', backgroundColor: '#fff3cd' }}
                >
                  <option value="MEMBER">👤 회원만 응시 가능 (기록 저장됨)</option>
                  <option value="ANYONE">🌐 누구나 응시 가능 (비회원은 기록 안됨)</option>
                </select>
              </div>
            </div>
            
            <h4 style={{ margin: '10px 0 0 0' }}>선택된 문항 및 배점 (총 {selectedQuestions.length}문항)</h4>
            
            <div style={{ border: '1px solid #eee', padding: '10px', minHeight: '200px', backgroundColor: '#f9f9f9' }}>
              {selectedQuestions.length === 0 && <p style={{ color: '#999', textAlign: 'center' }}>보관함에서 문제를 추가하세요.</p>}
              
              {selectedQuestions.map((q, index) => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '10px', marginBottom: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', marginRight: '15px' }}>
                    <button type="button" onClick={() => moveQuestion(index, 'UP')} disabled={index === 0}>▲</button>
                    <button type="button" onClick={() => moveQuestion(index, 'DOWN')} disabled={index === selectedQuestions.length - 1}>▼</button>
                  </div>
                  <div style={{ flex: 1 }}><strong>{index + 1}번.</strong> {q.content.substring(0, 20)}...</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input type="number" min="1" value={q.score} onChange={(e) => handleScoreChange(q.id, e.target.value)} style={{ width: '60px', padding: '5px' }} />
                    <span>점</span>
                    <button type="button" onClick={() => handleRemove(q.id)} style={{ marginLeft: '15px', backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>

            <button type="submit" style={{ padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              문제집 완성하기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}