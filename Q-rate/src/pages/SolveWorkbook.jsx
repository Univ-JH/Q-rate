import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, addDoc } from 'firebase/firestore';

export default function SolveWorkbook() {
  const { workbookId } = useParams();
  const navigate = useNavigate();

  const [workbook, setWorkbook] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [checkedQuestions, setCheckedQuestions] = useState({}); // 신규: 체크(별표) 표시한 문항 상태
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkbookAndQuestions = async () => {
      try {
        const wbRef = doc(db, 'workbooks', workbookId);
        const wbSnap = await getDoc(wbRef);

        if (!wbSnap.exists()) {
          alert('존재하지 않거나 삭제된 문제집입니다.');
          navigate('/');
          return;
        }

        const wbData = wbSnap.data();

        if (wbData.visibility === 'PRIVATE' && (!auth.currentUser || auth.currentUser.uid !== wbData.creatorUid)) {
          alert('비공개 문제집입니다. 출제자만 접근할 수 있습니다.');
          navigate('/');
          return;
        }

        if (wbData.requireLogin !== false && !auth.currentUser) {
          alert('회원만 응시할 수 있는 문제집입니다. 로그인 후 이용해주세요.');
          navigate('/login');
          return;
        }

        const questionsPromises = wbData.questionsInfo.map(async (info) => {
          const qSnap = await getDoc(doc(db, 'questions', info.questionId));
          if (!qSnap.exists()) return null;
          return { id: qSnap.id, ...qSnap.data(), score: info.score, order: info.order };
        });

        const fetchedResults = await Promise.all(questionsPromises);
        const validQuestions = fetchedResults.filter(q => q !== null);

        if (validQuestions.length === 0) {
          alert('이 문제집에 포함된 모든 문제가 삭제되어 응시할 수 없습니다.');
          navigate('/');
          return;
        }

        if (validQuestions.length < wbData.questionsInfo.length) {
          const updatedQuestionsInfo = validQuestions.map((q, idx) => ({ questionId: q.id, order: idx + 1, score: q.score }));
          const updatedTotalScore = updatedQuestionsInfo.reduce((sum, info) => sum + info.score, 0);
          try {
            await updateDoc(wbRef, { questionsInfo: updatedQuestionsInfo, totalScore: updatedTotalScore });
            wbData.questionsInfo = updatedQuestionsInfo;
            wbData.totalScore = updatedTotalScore;
          } catch (updateError) {
            console.error("문제집 자동 갱신 중 에러:", updateError);
          }
        }

        setWorkbook({ id: wbSnap.id, ...wbData });
        validQuestions.sort((a, b) => a.order - b.order);
        setQuestions(validQuestions);
        setLoading(false);

      } catch (error) {
        console.error("데이터 로딩 에러:", error);
        alert('데이터를 불러오는 중 문제가 발생했습니다.');
      }
    };

    fetchWorkbookAndQuestions();
  }, [workbookId, navigate]);

  // 답안 입력 핸들러
  const handleAnswerChange = (questionId, value) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // 신규: 체크(별표) 토글 핸들러
  const toggleCheck = (questionId) => {
    setCheckedQuestions(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  // 신규: 해당 문항을 풀었는지 확인하는 헬퍼 함수
  const isAnswered = (questionId) => {
    const ans = userAnswers[questionId];
    if (ans === undefined || ans === null) return false;
    return String(ans).trim() !== '';
  };

  // 신규: 안 푼 문제로 바로가기 핸들러
  const goToUnanswered = () => {
    const unAnsweredIndex = questions.findIndex(q => !isAnswered(q.id));
    if (unAnsweredIndex !== -1) {
      setCurrentIndex(unAnsweredIndex);
    } else {
      alert('모든 문제를 풀었습니다! 🎉\n우측 하단의 제출 버튼을 눌러주세요.');
    }
  };

  // 최종 제출 및 채점 로직
  const handleSubmit = async () => {
    const unansweredCount = questions.filter(q => !isAnswered(q.id)).length;
    const confirmMsg = unansweredCount > 0 
      ? `아직 풀지 않은 문제가 ${unansweredCount}개 있습니다. 그래도 제출하시겠습니까?`
      : '정말 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.';
      
    if (!window.confirm(confirmMsg)) return;
    
    let totalObtainedScore = 0;
    const detailedResults = [];

    for (const q of questions) {
      const userAnswer = userAnswers[q.id] || '';
      let isCorrect = false;
      let scoreObtained = 0;
      let feedback = '';

      if (q.type === 'MULTIPLE_CHOICE') {
        isCorrect = (userAnswer.toString() === q.answer.toString());
        scoreObtained = isCorrect ? q.score : 0;
      } 
      else if (q.type === 'SHORT_ANSWER') {
        isCorrect = (userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase());
        scoreObtained = isCorrect ? q.score : 0;
      } 
      else if (q.type === 'ESSAY') {
        if (q.useAIGrading) {
          if (userAnswer.length >= 10) {
            isCorrect = true;
            scoreObtained = Math.round(q.score * 0.8);
            feedback = "AI 채점 API 연동 전 임시 채점 (80% 인정)";
          } else {
            feedback = "답안이 너무 짧습니다.";
          }
        } else {
          const keywords = q.answer.split(',').map(k => k.trim());
          const matchCount = keywords.filter(k => userAnswer.includes(k)).length;
          if (matchCount > 0) {
            isCorrect = true;
            scoreObtained = q.score;
            feedback = "핵심 키워드 포함됨";
          } else {
            feedback = "핵심 키워드 누락";
          }
        }
      }

      totalObtainedScore += scoreObtained;
      detailedResults.push({ questionId: q.id, userAnswer, isCorrect, scoreObtained, feedback });
    }

    const resultData = {
      workbookId: workbook.id,
      solverUid: auth.currentUser ? auth.currentUser.uid : 'anonymous',
      myScore: totalObtainedScore,
      totalScore: workbook.totalScore,
      details: detailedResults,
      timestamp: new Date()
    };

    if (auth.currentUser) {
      try { await addDoc(collection(db, 'results'), resultData); } 
      catch (error) { console.error(error); alert('결과 저장 중 오류가 발생했습니다.'); }
    } else {
      alert('비회원으로 응시하여 기록이 데이터베이스에 저장되지 않았습니다. 현재 창에서 결과만 확인 가능합니다.');
    }

    setScoreResult(resultData);
    setIsSubmitted(true);
    window.scrollTo(0, 0); 
  };

  if (loading) return <div className="text-center py-20">문제집을 불러오는 중입니다...</div>;

  // --- 제출 완료 후 결과 화면 ---
  if (isSubmitted && scoreResult) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">🎉 수고하셨습니다!</h2>
          <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-10 inline-block shadow-sm">
            <span className="text-gray-500 font-bold block mb-2">나의 점수</span>
            <h1 className="text-6xl font-extrabold text-primary m-0 tracking-tight">
              {scoreResult.myScore} <span className="text-3xl text-gray-400 font-medium">/ {scoreResult.totalScore}</span>
            </h1>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">문항별 상세 결과</h3>
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const detail = scoreResult.details.find(d => d.questionId === q.id);
              return (
                <div key={q.id} className={`border p-5 rounded-xl transition-all ${detail.isCorrect ? 'border-l-8 border-l-green-500 bg-white' : 'border-l-8 border-l-red-500 bg-red-50/30'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <p className="font-bold text-gray-900 pr-4 leading-relaxed"><span className="text-primary mr-1">{idx + 1}.</span> {q.content}</p>
                    <span className="shrink-0 text-sm font-bold bg-white px-2 py-1 rounded border border-gray-200">
                      {detail.scoreObtained} / {q.score} 점
                    </span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1"><strong>내 답안:</strong> {detail.userAnswer || '(미입력)'}</p>
                    {!detail.isCorrect && <p className="text-sm text-red-600"><strong>모범 답안:</strong> {q.answer}</p>}
                    {detail.feedback && <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">💡 {detail.feedback}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => navigate('/')} className="mt-8 w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-colors text-lg">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // --- 응시 중 화면 ---
  const currentQ = questions[currentIndex];
  // 푼 문항 수 계산
  const answeredCount = questions.filter(q => isAnswered(q.id)).length;

  return (
    <div className="max-w-[1200px] mx-auto py-8 px-4 flex flex-col lg:flex-row gap-8">
      
      {/* ========================================= */}
      {/* 1. 좌측 메인: 문제 풀이 영역 */}
      {/* ========================================= */}
      <div className="flex-1 flex flex-col min-h-[600px]">
        
        {/* 헤더 정보 */}
        <div className="mb-6 text-center lg:text-left">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{workbook.title}</h2>
          <p className="text-sm text-gray-500">{workbook.description}</p>
        </div>

        {/* 문제 카드 */}
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col relative overflow-hidden">
          
          {/* 상단 프로그레스 바 */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            ></div>
          </div>

          <div className="p-8 flex-1 flex flex-col mt-2">
            
            {/* 문제 번호 및 체크, 배점 영역 */}
            <div className="flex justify-between items-center mb-8 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-extrabold text-primary">Q{currentIndex + 1}.</span>
                <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-md">{currentQ.score}점</span>
              </div>
              
              {/* 신규: 헷갈리는 문제 체크(Flag) 버튼 */}
              <button 
                onClick={() => toggleCheck(currentQ.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                  checkedQuestions[currentQ.id] 
                    ? 'bg-yellow-50 border-yellow-400 text-yellow-700 shadow-sm' 
                    : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                }`}
              >
                <svg className={`w-5 h-5 ${checkedQuestions[currentQ.id] ? 'fill-current text-yellow-500' : 'fill-none stroke-current'}`} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                {checkedQuestions[currentQ.id] ? '체크됨' : '헷갈림 체크'}
              </button>
            </div>
            
            <p className="text-xl text-gray-800 leading-relaxed mb-10 whitespace-pre-wrap">{currentQ.content}</p>

            {/* 문제 유형별 입력 폼 */}
            <div className="mt-auto">
              {currentQ.type === 'MULTIPLE_CHOICE' && (
                <div className="flex flex-col gap-3">
                  {currentQ.options.map((opt, idx) => (
                    <label 
                      key={idx} 
                      className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
                        userAnswers[currentQ.id] === String(idx + 1) 
                          ? 'border-primary bg-indigo-50 shadow-sm ring-1 ring-primary' 
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name={`question-${currentQ.id}`} 
                        value={idx + 1}
                        checked={userAnswers[currentQ.id] === String(idx + 1)}
                        onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                        className="w-5 h-5 text-primary border-gray-300 focus:ring-primary mr-4"
                      />
                      <span className="text-base text-gray-800 flex-1">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {currentQ.type === 'SHORT_ANSWER' && (
                <input 
                  type="text" 
                  placeholder="정답을 입력하세요" 
                  value={userAnswers[currentQ.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                  className="w-full px-5 py-4 text-lg bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                />
              )}

              {currentQ.type === 'ESSAY' && (
                <textarea 
                  placeholder="자유롭게 서술해 주세요" 
                  value={userAnswers[currentQ.id] || ''}
                  onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                  rows="6"
                  className="w-full px-5 py-4 text-lg bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all resize-none custom-scrollbar"
                />
              )}
            </div>
          </div>
        </div>

        {/* 이전 / 다음 네비게이션 */}
        <div className="flex justify-between items-center mt-6">
          <button 
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="px-8 py-3 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            ← 이전 문항
          </button>

          {currentIndex < questions.length - 1 ? (
            <button 
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              className="px-8 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primaryHover transition-colors shadow-md"
            >
              다음 문항 →
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              className="px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-md"
            >
              최종 제출하기
            </button>
          )}
        </div>
      </div>

      {/* ========================================= */}
      {/* 2. 우측 OMR (답안 마킹 현황) 패널 */}
      {/* ========================================= */}
      <div className="w-full lg:w-80 flex-shrink-0 flex flex-col">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sticky top-24">
          
          <div className="flex justify-between items-end mb-6 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">OMR 마킹 현황</h3>
              <p className="text-sm text-gray-500 mt-1">
                진행률: <span className="font-bold text-primary">{answeredCount}</span> / {questions.length}
              </p>
            </div>
          </div>

          {/* OMR 그리드 (번호 나열) */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            {questions.map((q, idx) => {
              const answered = isAnswered(q.id);
              const checked = checkedQuestions[q.id];
              const isCurrent = currentIndex === idx;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`
                    relative h-10 w-full rounded-lg flex items-center justify-center text-sm font-bold transition-all
                    ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}
                    ${answered 
                      ? 'bg-primary text-white border border-primary hover:bg-primaryHover' 
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
                    }
                  `}
                >
                  {idx + 1}
                  
                  {/* 별표(체크) 아이콘 오버레이 */}
                  {checked && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                      <svg className="w-2.5 h-2.5 text-white fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* OMR 범례(Legend) */}
          <div className="flex gap-4 justify-center text-xs text-gray-500 mb-8">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-white border border-gray-300 rounded-sm"></span> 안 푼 문제</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-primary rounded-sm"></span> 푼 문제</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-yellow-400 rounded-full"></span> 헷갈림</div>
          </div>

          {/* 하단 단축 버튼들 */}
          <div className="flex flex-col gap-3">
            <button 
              onClick={goToUnanswered}
              className="w-full py-3 bg-indigo-50 text-primary font-bold rounded-xl hover:bg-indigo-100 transition-colors text-sm border border-indigo-100"
            >
              🔎 안 푼 문제 바로가기
            </button>
            <button 
              onClick={handleSubmit}
              className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors text-sm shadow-md"
            >
              제출 및 채점하기
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}