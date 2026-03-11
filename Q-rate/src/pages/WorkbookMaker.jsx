import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function WorkbookMaker() {
  const [questions, setQuestions] = useState([]); 
  const [selectedQuestions, setSelectedQuestions] = useState([]); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('ALL');
  const [filterDifficulty, setFilterDifficulty] = useState('ALL');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('NONE'); 
  const [visibility, setVisibility] = useState('PRIVATE'); 
  const [requireLogin, setRequireLogin] = useState(true); 
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, 'questions'), where('creatorUid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        setQuestions(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => b.createdAt?.toDate() - a.createdAt?.toDate()));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const uniqueSubjects = useMemo(() => {
    return [...new Set(questions.map(q => q.subject || '과목미지정'))];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchSearch = searchTerm === '' || 
        (q.content?.toLowerCase().includes(searchTerm.toLowerCase())) || 
        (q.tags && q.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
      const matchSubject = filterSubject === 'ALL' || (q.subject || '과목미지정') === filterSubject;
      const matchDifficulty = filterDifficulty === 'ALL' || q.difficulty === filterDifficulty;
      return matchSearch && matchSubject && matchDifficulty;
    });
  }, [questions, searchTerm, filterSubject, filterDifficulty]);

  const parseAndValidateTags = (tagString) => { 
    const rawTags = tagString.split(',').map(t => t.trim()).filter(t => t !== '');
    const validTags = [];
    for (const tag of rawTags) {
      let byteLength = 0;
      for (let i = 0; i < tag.length; i++) byteLength += tag.charCodeAt(i) > 127 ? 2 : 1;
      if (byteLength > 20) throw new Error(`태그 "${tag}"가 길이 제한을 초과했습니다.\n(한글 최대 10자, 영문 최대 20자)`);
      validTags.push(tag);
    }
    return validTags;
  };

  const handleAdd = (q) => {
    if (selectedQuestions.find(sq => sq.id === q.id)) return; 
    setSelectedQuestions([...selectedQuestions, { ...q, score: 10 }]);
  };
  const handleRemove = (id) => setSelectedQuestions(selectedQuestions.filter(q => q.id !== id));
  const handleScoreChange = (id, newScore) => setSelectedQuestions(selectedQuestions.map(q => q.id === id ? { ...q, score: Number(newScore) } : q));
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
      const parsedTags = parseAndValidateTags(tagsInput); 
      const structuredQuestions = selectedQuestions.map((q, index) => ({ questionId: q.id, order: index + 1, score: q.score }));
      const totalScore = structuredQuestions.reduce((sum, q) => sum + q.score, 0);

      await addDoc(collection(db, 'workbooks'), {
        title, description, difficulty, visibility, requireLogin, tags: parsedTags,
        creatorUid: auth.currentUser.uid, questionsInfo: structuredQuestions, totalScore, createdAt: new Date()
      });
      alert(`문제집이 성공적으로 생성되었습니다!`);
      setTitle(''); setDescription(''); setDifficulty('NONE'); setVisibility('PRIVATE'); setRequireLogin(true); setTagsInput(''); setSelectedQuestions([]);
    } catch (error) {
      alert(error.message || '생성 중 오류가 발생했습니다.');
    }
  };

  const inputClassName = "w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-sm";

  if (loading) return <div className="text-center py-20">로딩 중...</div>;

  const currentTotalScore = selectedQuestions.reduce((sum, q) => sum + q.score, 0);

  return (
    // 전체 페이지 높이를 뷰포트에 맞추고(스크롤 방지) flex-col을 줌
    <div className="max-w-[1600px] w-full mx-auto h-[calc(100vh-8rem)] flex flex-col overflow-hidden">
      <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b pb-3 shrink-0">📚 맞춤형 문제집 제작</h2>
      
      {/* 3단 분할 레이아웃 컨테이너: 1/4 (25%), 2/4 (50%), 1/4 (25%) 비율 */}
      <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
        
        {/* ========================================================= */}
        {/* 1. 왼쪽: 내 문제 보관함 (25%) */}
        {/* ========================================================= */}
        <div className="w-full xl:w-1/4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col h-full min-h-0">
          <h3 className="text-base font-bold text-gray-800 mb-3 shrink-0">1. 내 문제 보관함</h3>
          
          <div className="flex flex-col gap-2 mb-3 p-2 bg-gray-50 rounded-xl border border-gray-200 shrink-0">
            <input 
              type="text" 
              placeholder="검색어 입력..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none">
                <option value="ALL">전체 과목</option>
                {uniqueSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
              <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none">
                <option value="ALL">모든 난이도</option><option value="NONE">미선택</option><option value="EASY">초급</option><option value="MEDIUM">중급</option><option value="HARD">고급</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar min-h-0">
            {filteredQuestions.length === 0 && <p className="text-gray-500 text-center mt-6 text-sm">조건에 맞는 문제가 없습니다.</p>}
            
            {filteredQuestions.map((q) => {
              const isSelected = selectedQuestions.some(sq => sq.id === q.id);
              return (
                <div 
                  key={q.id} 
                  onClick={() => !isSelected && handleAdd(q)} 
                  className={`p-3 border rounded-xl transition-all ${
                    isSelected 
                      ? 'border-primary bg-indigo-50 opacity-60 cursor-not-allowed' 
                      : 'border-gray-200 cursor-pointer hover:border-primary hover:bg-indigo-50 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-white border border-gray-200 text-gray-600 rounded">
                      {q.subject || '과목미지정'}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-primary flex items-center gap-1">✓ 담김</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-800 line-clamp-2">{q.content}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. 중앙: 선택된 문항 (50% - 더 넓음) */}
        {/* ========================================================= */}
        <div className="w-full xl:w-2/4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col h-full min-h-0">
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h3 className="text-base font-bold text-gray-800">2. 선택된 문항 및 순서/배점 설정</h3>
            <span className="text-xs bg-indigo-100 text-primary font-bold px-3 py-1 rounded-full">총 {selectedQuestions.length}개</span>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex-1 overflow-y-auto space-y-2 custom-scrollbar min-h-0">
            {selectedQuestions.length === 0 && (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                왼쪽 보관함에서 문제를 클릭하여 담아주세요.
              </div>
            )}
            
            {/* 가로가 넓어졌으므로 각 문제 카드를 가로 1줄 배치(Row)로 변경 */}
            {selectedQuestions.map((q, index) => (
              <div key={q.id} className="flex items-center bg-white p-2 border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 transition-colors">
                
                <div className="flex flex-col items-center mr-3 px-1">
                  <button type="button" onClick={() => moveQuestion(index, 'UP')} disabled={index === 0} className="text-gray-400 hover:text-primary disabled:opacity-20 leading-none pb-1">▲</button>
                  <button type="button" onClick={() => moveQuestion(index, 'DOWN')} disabled={index === selectedQuestions.length - 1} className="text-gray-400 hover:text-primary disabled:opacity-20 leading-none pt-1">▼</button>
                </div>
                
                <div className="flex-1 flex items-center gap-3 overflow-hidden mr-4">
                  <strong className="text-primary text-sm whitespace-nowrap">{index + 1}.</strong>
                  <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                    {q.type === 'MULTIPLE_CHOICE' ? '객관식' : q.type === 'SHORT_ANSWER' ? '주관식' : '서술식'}
                  </span>
                  <p className="text-sm text-gray-800 truncate">{q.content}</p>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1">
                    <input type="number" min="1" value={q.score} onChange={(e) => handleScoreChange(q.id, e.target.value)} className="w-12 px-1 py-1 text-sm border border-gray-300 rounded text-center focus:ring-2 focus:ring-primary focus:outline-none" />
                    <span className="text-xs text-gray-600">점</span>
                  </div>
                  <button type="button" onClick={() => handleRemove(q.id)} className="text-xs px-2 py-1.5 bg-red-50 text-red-600 font-bold rounded hover:bg-red-100 transition-colors">삭제</button>
                </div>
                
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center shrink-0">
            <span className="text-sm text-gray-600 font-medium">총 배점</span>
            <span className="text-xl font-extrabold text-primary">{currentTotalScore} <span className="text-sm text-gray-800 font-bold">점</span></span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. 오른쪽: 문제집 정보 (25%) */}
        {/* ========================================================= */}
        <div className="w-full xl:w-1/4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col h-full min-h-0">
          <h3 className="text-base font-bold text-gray-800 mb-3 shrink-0">3. 완성 및 발행</h3>
          
          <form onSubmit={handleCreateWorkbook} className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">문제집 제목</label>
              <input type="text" placeholder="제목 입력" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClassName} />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">설명</label>
              <textarea placeholder="간략한 설명" value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className={`${inputClassName} resize-none`} />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">태그 (선택)</label>
              <input type="text" placeholder="쉼표(,)로 구분" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputClassName} />
            </div>
            
            <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 mt-1">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">난이도</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={`${inputClassName} py-1`}>
                  <option value="NONE">미선택</option><option value="EASY">초급</option><option value="MEDIUM">중급</option><option value="HARD">고급</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">공개 설정</label>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={`${inputClassName} py-1`}>
                  <option value="PRIVATE">🔒 비공개</option><option value="LINK">🔗 링크 공개</option><option value="PUBLIC">🌐 전체 공개</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">응시 권한</label>
                <select value={requireLogin ? 'MEMBER' : 'ANYONE'} onChange={(e) => setRequireLogin(e.target.value === 'MEMBER')} className={`${inputClassName} bg-yellow-50 py-1`}>
                  <option value="MEMBER">👤 회원 전용</option><option value="ANYONE">🌐 누구나</option>
                </select>
              </div>
            </div>

            <button type="submit" className="mt-auto py-3 bg-primary hover:bg-primaryHover text-white font-bold rounded-xl text-base shadow-md transition-colors w-full shrink-0">
              문제집 발행하기
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}