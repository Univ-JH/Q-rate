import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { updateProfile, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function MyPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState({}); 
  
  const [myQuestions, setMyQuestions] = useState([]);
  const [myWorkbooks, setMyWorkbooks] = useState([]);
  const [myResults, setMyResults] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info'); 

  // UI 상태 관리
  const [expandedWorkbookId, setExpandedWorkbookId] = useState(null); // 클릭한 문제집 ID
  const [isEditing, setIsEditing] = useState(false); // 프로필 수정 상태
  const [editNickname, setEditNickname] = useState('');
  const [editInterests, setEditInterests] = useState('');

  // 데이터 간편 수정(Edit)용 모달 상태
  const [editingItem, setEditingItem] = useState(null); // { type: 'question' | 'workbook', data: {...} }

  // 번역 헬퍼 함수
  const translateVisibility = (vis) => ({ PUBLIC: '전체 공개', LINK: '링크 공개', PRIVATE: '비공개' }[vis] || vis);
  const translateDifficulty = (diff) => ({ NONE: '미선택', EASY: '초급', MEDIUM: '중급', HARD: '고급' }[diff] || diff);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchMyData(currentUser.uid);
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchMyData = async (uid) => {
    setLoading(true);
    try {
      const userDocSnap = await getDoc(doc(db, 'users', uid));
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        setUserProfile(data);
        setEditNickname(data.nickname || '');
        setEditInterests(data.interests ? data.interests.join(', ') : '');
      }

      const qSnap = await getDocs(query(collection(db, 'questions'), where('creatorUid', '==', uid)));
      setMyQuestions(qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const wSnap = await getDocs(query(collection(db, 'workbooks'), where('creatorUid', '==', uid)));
      setMyWorkbooks(wSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const rSnap = await getDocs(query(collection(db, 'results'), where('solverUid', '==', uid)));
      const resultsWithInfo = await Promise.all(rSnap.docs.map(async (rDoc) => {
        const rData = rDoc.data();
        const wbDocSnap = await getDoc(doc(db, 'workbooks', rData.workbookId));
        return { 
          id: rDoc.id, 
          ...rData, 
          workbookTitle: wbDocSnap.exists() ? wbDocSnap.data().title : '삭제된 문제집',
          workbookDifficulty: wbDocSnap.exists() ? wbDocSnap.data().difficulty : '-'
        };
      }));
      setMyResults(resultsWithInfo);
    } catch (error) {
      console.error("데이터 로딩 에러:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- 프로필 저장 ---
  const handleSaveProfile = async () => {
    try {
      const interestsArray = editInterests.split(',').map(i => i.trim()).filter(i => i);
      await updateProfile(auth.currentUser, { displayName: editNickname });
      await updateDoc(doc(db, 'users', user.uid), { nickname: editNickname, interests: interestsArray });
      setUserProfile({ ...userProfile, nickname: editNickname, interests: interestsArray });
      setIsEditing(false);
      alert('프로필이 수정되었습니다.');
    } catch {
      alert('수정 중 오류가 발생했습니다.');
    }
  };

  // --- 삭제(Delete) 로직 ---
  const handleDelete = async (collectionName, id) => {
    if (!window.confirm('정말 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      if (collectionName === 'questions') setMyQuestions(prev => prev.filter(q => q.id !== id));
      if (collectionName === 'workbooks') setMyWorkbooks(prev => prev.filter(w => w.id !== id));
      alert('삭제되었습니다.');
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // --- 간편 수정(Edit) 저장 로직 ---
  const handleSaveItemEdit = async () => {
    try {
      const { type, data } = editingItem;
      const collectionName = type === 'question' ? 'questions' : 'workbooks';
      
      await updateDoc(doc(db, collectionName, data.id), data);
      
      // 화면 상태 즉시 업데이트
      if (type === 'question') {
        setMyQuestions(prev => prev.map(q => q.id === data.id ? data : q));
      } else {
        setMyWorkbooks(prev => prev.map(w => w.id === data.id ? data : w));
      }
      
      setEditingItem(null);
      alert('성공적으로 수정되었습니다.');
    } catch {
      alert('수정 중 오류가 발생했습니다.');
    }
  };

  // --- 링크 복사 유틸 ---
  const copyToClipboard = (workbookId) => {
    const link = `${window.location.origin}/solve/${workbookId}`;
    navigator.clipboard.writeText(link).then(() => alert('링크가 클립보드에 복사되었습니다!'));
  };

  if (loading) return <div style={{ padding: '20px' }}>데이터를 불러오는 중입니다...</div>;
  if (!user) return null;

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px' }}>
      <h2>👤 마이페이지</h2>
      
      <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('info')} style={tabStyle(activeTab === 'info')}>개인정보</button>
        <button onClick={() => setActiveTab('questions')} style={tabStyle(activeTab === 'questions')}>등록한 문제 ({myQuestions.length})</button>
        <button onClick={() => setActiveTab('workbooks')} style={tabStyle(activeTab === 'workbooks')}>등록한 문제집 ({myWorkbooks.length})</button>
        <button onClick={() => setActiveTab('results')} style={tabStyle(activeTab === 'results')}>내가 푼 문제 ({myResults.length})</button>
      </div>

      <div style={{ padding: '10px' }}>
        {/* 1. 개인정보 탭 (이전과 동일) */}
        {activeTab === 'info' && (
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
             {/* ... 이전과 동일한 프로필 렌더링 코드 ... */}
            <h3>내 정보</h3>
            <p><strong>이메일:</strong> {user.email}</p>
            {isEditing ? (
              <div className="flex flex-col gap-4 mt-6 p-6 bg-gray-50 border border-gray-200 rounded-xl">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">별명</label>
                  <input type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} className="w-full max-w-xs px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">관심분야 (쉼표 구분)</label>
                  <input type="text" value={editInterests} onChange={(e) => setEditInterests(e.target.value)} placeholder="예: 수학, 디자인" className="w-full max-w-md px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow" />
                </div>
                <div className="mt-2 flex gap-3">
                  <button onClick={handleSaveProfile} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors">저장</button>
                  <button onClick={() => setIsEditing(false)} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg transition-colors">취소</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '10px' }}>
                <p><strong>별명:</strong> {userProfile.nickname}</p>
                <p><strong>관심분야:</strong> {userProfile.interests?.length > 0 ? userProfile.interests.join(', ') : '등록된 관심분야가 없습니다.'}</p>
                <button onClick={() => setIsEditing(true)} style={{ marginTop: '10px', padding: '5px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>프로필 수정</button>
              </div>
            )}
          </div>
        )}

        {/* 2. 등록한 문제 탭 */}
        {activeTab === 'questions' && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {myQuestions.length === 0 && <p>등록한 문제가 없습니다.</p>}
            {myQuestions.map(q => (
              <li key={q.id} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 'bold', color: '#0056b3' }}>[{q.subject || '과목미지정'}]</span> {q.content.substring(0, 40)}... 
                  <span style={{ fontSize: '12px', color: '#888', marginLeft: '10px' }}>({translateVisibility(q.visibility)} | {translateDifficulty(q.difficulty)})</span>
                </div>
                <div>
                  <button onClick={() => setEditingItem({ type: 'question', data: { ...q } })} style={{ marginRight: '8px', cursor: 'pointer' }}>수정</button>
                  <button onClick={() => handleDelete('questions', q.id)} style={{ color: 'red', cursor: 'pointer' }}>삭제</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 3. 등록한 문제집 탭 */}
        {activeTab === 'workbooks' && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {myWorkbooks.length === 0 && <p>등록한 문제집이 없습니다.</p>}
            {myWorkbooks.map(w => (
              <li key={w.id} style={{ border: '1px solid #ddd', marginBottom: '10px', borderRadius: '4px', overflow: 'hidden' }}>
                {/* 헤더 영역 (클릭 시 아코디언 토글) */}
                <div 
                  onClick={() => setExpandedWorkbookId(expandedWorkbookId === w.id ? null : w.id)} 
                  style={{ padding: '15px', backgroundColor: '#fdfdfd', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <strong style={{ fontSize: '16px' }}>{w.title}</strong> 
                    <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>({w.questionsInfo?.length}문항 / {w.totalScore}점)</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', marginRight: '15px', color: w.visibility === 'PRIVATE' ? '#dc3545' : '#28a745' }}>{translateVisibility(w.visibility)}</span>
                    <span style={{ fontSize: '12px' }}>{expandedWorkbookId === w.id ? '▲ 접기' : '▼ 펼치기'}</span>
                  </div>
                </div>

                {/* 확장된 상세 내용 영역 */}
                {expandedWorkbookId === w.id && (
                  <div style={{ padding: '15px', borderTop: '1px solid #eee', backgroundColor: '#fff' }}>
                    <p style={{ margin: '0 0 10px 0', color: '#555' }}><strong>설명:</strong> {w.description || '설명이 없습니다.'}</p>
                    <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#888' }}>난이도: {translateDifficulty(w.difficulty)} | 제작일: {new Date(w.createdAt?.toDate()).toLocaleDateString()}</p>
                    
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button onClick={() => navigate(`/solve/${w.id}`)} style={{ padding: '8px 15px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        📝 바로 응시하기
                      </button>
                      
                      {/* 링크 공개 또는 전체 공개일 경우 링크 버튼 표시 */}
                      {(w.visibility === 'LINK' || w.visibility === 'PUBLIC') && (
                        <button onClick={() => copyToClipboard(w.id)} style={{ padding: '8px 15px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                          🔗 공유 링크 복사
                        </button>
                      )}
                      
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <button onClick={() => setEditingItem({ type: 'workbook', data: { ...w } })} style={{ padding: '8px 15px', marginRight: '5px', cursor: 'pointer' }}>수정</button>
                        <button onClick={() => handleDelete('workbooks', w.id)} style={{ padding: '8px 15px', color: 'white', backgroundColor: '#dc3545', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>삭제</button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* 4. 내가 푼 문제 탭 */}
        {activeTab === 'results' && (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {myResults.length === 0 && <p>아직 응시한 기록이 없습니다.</p>}
            {myResults.map(r => (
              <li key={r.id} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0' }}>{r.workbookTitle}</h4>
                    <span style={{ fontSize: '12px', color: '#888', backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
                      난이도: {translateDifficulty(r.workbookDifficulty)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h3 style={{ margin: '0', color: r.myScore === r.totalScore ? '#28a745' : '#0056b3' }}>{r.myScore} / {r.totalScore} 점</h3>
                    <span style={{ fontSize: '12px', color: '#aaa' }}>{new Date(r.timestamp?.toDate()).toLocaleDateString()}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 간편 수정 모달 (팝업 형태) */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6 border-b pb-3">
              {editingItem.type === 'question' ? '문제 간편 수정' : '문제집 간편 수정'}
            </h3>
            
            <div className="flex flex-col gap-4">
              {/* 공통 적용할 테두리 클래스 변수화 */}
              {(() => {
                const modalInputClass = "w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow";
                return (
                  <>
                    {editingItem.type === 'workbook' && (
                      <>
                        <input type="text" value={editingItem.data.title} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, title: e.target.value } })} placeholder="제목" className={modalInputClass} />
                        <textarea value={editingItem.data.description} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, description: e.target.value } })} placeholder="설명" rows="3" className={modalInputClass} />
                        <input type="text" value={editingItem.data.tags ? editingItem.data.tags.join(', ') : ''} 
                          onChange={(e) => {
                            // 입력 시 배열 형태로 억지로 바꾸지 않고 원시 텍스트를 담아둘 임시 속성을 활용하거나 바로 파싱
                            const rawArray = e.target.value.split(',');
                            setEditingItem({ ...editingItem, data: { ...editingItem.data, tags: rawArray } });
                          }} 
                          placeholder="태그 수정 (쉼표로 구분)" className={modalInputClass} 
                        />
                      </>
                    )}
                    
                    {editingItem.type === 'question' && (
                      <>
                        <input type="text" value={editingItem.data.subject || ''} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, subject: e.target.value } })} placeholder="과목명" className={modalInputClass} />
                        <textarea value={editingItem.data.content} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, content: e.target.value } })} placeholder="문제 내용" rows="4" className={modalInputClass} />
                        <input type="text" value={editingItem.data.tags ? editingItem.data.tags.join(', ') : ''} 
                          onChange={(e) => {
                            const rawArray = e.target.value.split(',');
                            setEditingItem({ ...editingItem, data: { ...editingItem.data, tags: rawArray } });
                          }} 
                          placeholder="태그 수정 (쉼표로 구분)" className={modalInputClass} 
                        />
                      </>
                    )}

                    {/* 공통: 난이도 수정 */}
                    <select value={editingItem.data.difficulty} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, difficulty: e.target.value } })} className={modalInputClass}>
                      <option value="NONE">미선택</option>
                      <option value="EASY">초급</option>
                      <option value="MEDIUM">중급</option>
                      <option value="HARD">고급</option>
                    </select>

                    {/* 공개 설정 (문제는 링크 제외, 문제집은 링크 포함) */}
                    {editingItem.type === 'question' ? (
                      <select value={editingItem.data.visibility} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, visibility: e.target.value } })} className={modalInputClass}>
                        <option value="PRIVATE">🔒 비공개</option>
                        <option value="PUBLIC">🌐 전체 공개</option>
                      </select>
                    ) : (
                      <select value={editingItem.data.visibility} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, visibility: e.target.value } })} className={modalInputClass}>
                        <option value="PRIVATE">🔒 비공개</option>
                        <option value="LINK">🔗 링크 공개</option>
                        <option value="PUBLIC">🌐 전체 공개</option>
                      </select>
                    )}

                    {editingItem.type === 'workbook' && (
                      <select value={editingItem.data.requireLogin !== false ? 'MEMBER' : 'ANYONE'} onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, requireLogin: e.target.value === 'MEMBER' } })} className={modalInputClass}>
                        <option value="MEMBER">👤 회원만 응시 가능</option>
                        <option value="ANYONE">🌐 누구나 응시 가능</option>
                      </select>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setEditingItem(null)} className="px-5 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors">취소</button>
              <button onClick={handleSaveItemEdit} className="px-5 py-2 bg-primary hover:bg-primaryHover text-white font-bold rounded-lg shadow-md transition-colors">수정 내용 저장</button>
            </div>
            
            {editingItem.type === 'question' && <p className="text-xs text-gray-500 mt-4 leading-relaxed">* 문제의 정답 및 보기를 근본적으로 변경하려면 새 문제를 생성하는 것을 권장합니다.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const tabStyle = (isActive) => ({
  padding: '10px 15px', cursor: 'pointer', border: 'none',
  backgroundColor: isActive ? '#0056b3' : '#f0f0f0', color: isActive ? 'white' : '#333',
  fontWeight: isActive ? 'bold' : 'normal', borderRadius: '4px'
});