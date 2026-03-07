import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';

export default function SolveWorkbook() {
  const { workbookId } = useParams(); // URL에서 문제집 ID 가져오기
  const navigate = useNavigate();

  const [workbook, setWorkbook] = useState(null);
  const [questions, setQuestions] = useState([]); // 실제 문제 데이터들
  
  const [currentIndex, setCurrentIndex] = useState(0); // 현재 풀고 있는 문제의 인덱스
  const [userAnswers, setUserAnswers] = useState({}); // 사용자가 입력한 답안 객체 { questionId: "답" }
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. 문제집 및 포함된 문제 데이터 불러오기
  useEffect(() => {
    const fetchWorkbookAndQuestions = async () => {
      try {
        // 문제집 정보 가져오기
        const wbRef = doc(db, 'workbooks', workbookId);
        const wbSnap = await getDoc(wbRef);

        if (!wbSnap.exists()) {
          alert('존재하지 않거나 삭제된 문제집입니다.');
          navigate('/');
          return;
        }

        const wbData = wbSnap.data();

        // 비공개(PRIVATE) 권한 체크
        if (wbData.visibility === 'PRIVATE' && (!auth.currentUser || auth.currentUser.uid !== wbData.creatorUid)) {
          alert('비공개 문제집입니다. 출제자만 접근할 수 있습니다.');
          navigate('/');
          return;
        }

        // 회원 전용(requireLogin) 체크
        // requireLogin이 명시적으로 false가 아니고(예전 데이터는 undefined일 수 있으니 기본 true 취급), 로그인 안 한 상태면 차단
        if (wbData.requireLogin !== false && !auth.currentUser) {
          alert('회원만 응시할 수 있는 문제집입니다. 로그인 후 이용해주세요.');
          navigate('/login');
          return;
        }

        setWorkbook({ id: wbSnap.id, ...wbData });

        // 문제집에 포함된 각 문제들의 실제 데이터를 병렬로 가져오기
        const questionsPromises = wbData.questionsInfo.map(async (info) => {
          const qSnap = await getDoc(doc(db, 'questions', info.questionId));
          return { id: qSnap.id, ...qSnap.data(), score: info.score, order: info.order };
        });

        const fetchedQuestions = await Promise.all(questionsPromises);
        
        // order(순서) 기준으로 정렬
        fetchedQuestions.sort((a, b) => a.order - b.order);
        setQuestions(fetchedQuestions);
        setLoading(false);

      } catch (error) {
        console.error("데이터 로딩 에러:", error);
        alert('데이터를 불러오는 중 문제가 발생했습니다.');
      }
    };

    fetchWorkbookAndQuestions();
  }, [workbookId, navigate]);

  // 2. 답안 입력 핸들러
  const handleAnswerChange = (questionId, value) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // 3. 채점 및 최종 제출 핸들러
  const handleSubmit = async () => {
    if (!window.confirm('정말 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.')) return;
    
    let totalObtainedScore = 0;
    const detailedResults = [];

    // 각 문제별 채점 로직
    for (const q of questions) {
      const userAnswer = userAnswers[q.id] || '';
      let isCorrect = false;
      let scoreObtained = 0;
      let feedback = '';

      if (q.type === 'MULTIPLE_CHOICE') {
        // 객관식: 정확히 일치해야 함
        isCorrect = (userAnswer.toString() === q.answer.toString());
        scoreObtained = isCorrect ? q.score : 0;
      } 
      else if (q.type === 'SHORT_ANSWER') {
        // 주관식: 공백 제거 및 소문자 변환 후 비교
        isCorrect = (userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase());
        scoreObtained = isCorrect ? q.score : 0;
      } 
      else if (q.type === 'ESSAY') {
        // 서술식
        if (q.useAIGrading) {
          // TODO: 향후 Cloud Functions를 통한 AI 채점 API 연동 자리
          // 현재는 임시로 글자 수(10자 이상)가 있으면 부분 점수를 주도록 목업(Mock) 처리
          if (userAnswer.length >= 10) {
            isCorrect = true;
            scoreObtained = Math.round(q.score * 0.8); // 80% 부분 점수 부여
            feedback = "AI 채점 API 연동 전 임시 채점 (80% 인정)";
          } else {
            feedback = "답안이 너무 짧습니다.";
          }
        } else {
          // AI 채점이 아닐 경우: 필수 키워드(콤마로 구분되었다고 가정) 포함 여부 확인
          const keywords = q.answer.split(',').map(k => k.trim());
          const matchCount = keywords.filter(k => userAnswer.includes(k)).length;
          
          if (matchCount > 0) {
            isCorrect = true;
            scoreObtained = q.score; // 키워드가 하나라도 있으면 정답 처리 (로직은 필요에 따라 고도화 가능)
            feedback = "핵심 키워드 포함됨";
          } else {
            feedback = "핵심 키워드 누락";
          }
        }
      }

      totalObtainedScore += scoreObtained;
      detailedResults.push({
        questionId: q.id,
        userAnswer,
        isCorrect,
        scoreObtained,
        feedback
      });
    }

    // 결과 DB에 저장 (results 컬렉션)
    try {
      const resultData = {
        workbookId: workbook.id,
        solverUid: auth.currentUser ? auth.currentUser.uid : 'anonymous',
        myScore: totalObtainedScore,
        totalScore: workbook.totalScore,
        details: detailedResults,
        timestamp: new Date()
      };

      if (auth.currentUser) {
        try {
            await addDoc(collection(db, 'results'), resultData);
          } catch (error) {
            console.error("결과 저장 에러:", error);
           alert('채점 결과를 저장하는 중 오류가 발생했습니다.');
         }
        } else {
          // 비회원은 DB에 저장하지 않고 안내창만 띄움
        alert('비회원으로 응시하여 기록이 데이터베이스에 저장되지 않았습니다. 현재 창에서 결과만 확인 가능합니다.');
        }

        // DB 저장과 무관하게 화면에는 결과를 렌더링
        setScoreResult(resultData);
        setIsSubmitted(true);
        window.scrollTo(0, 0);

    } catch (error) {
      console.error("결과 저장 에러:", error);
      alert('채점 결과를 저장하는 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>문제집을 불러오는 중입니다...</div>;

  // --- 제출 완료 후 결과 화면 ---
  if (isSubmitted && scoreResult) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', textAlign: 'center' }}>
        <h2>🎉 수고하셨습니다!</h2>
        <div style={{ margin: '20px 0', padding: '30px', backgroundColor: '#f0f8ff', borderRadius: '8px' }}>
          <h1 style={{ color: '#0056b3', margin: '0' }}>{scoreResult.myScore} / {scoreResult.totalScore} 점</h1>
        </div>
        
        <div style={{ textAlign: 'left', marginTop: '30px' }}>
          <h3>문항별 상세 결과</h3>
          {questions.map((q, idx) => {
            const detail = scoreResult.details.find(d => d.questionId === q.id);
            return (
              <div key={q.id} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '4px', borderLeft: detail.isCorrect ? '5px solid #28a745' : '5px solid #dc3545' }}>
                <p style={{ fontWeight: 'bold' }}>{idx + 1}번. {q.content}</p>
                <p style={{ color: '#666', fontSize: '14px' }}>내 답안: {detail.userAnswer || '(미입력)'}</p>
                {!detail.isCorrect && <p style={{ color: '#dc3545', fontSize: '14px' }}>모범 답안: {q.answer}</p>}
                {detail.feedback && <p style={{ color: '#888', fontSize: '12px' }}>💡 {detail.feedback}</p>}
                <p style={{ textAlign: 'right', fontWeight: 'bold', margin: '0' }}>{detail.scoreObtained} / {q.score} 점</p>
              </div>
            );
          })}
        </div>
        <button onClick={() => navigate('/')} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>홈으로 돌아가기</button>
      </div>
    );
  }

  // --- 응시 중 화면 (Focus Mode) ---
  const currentQ = questions[currentIndex];

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px' }}>
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>{workbook.title}</h2>
        <p style={{ color: '#666', fontSize: '14px' }}>{workbook.description}</p>
        
        {/* 진행률 바 (Progress Bar) */}
        <div style={{ width: '100%', backgroundColor: '#eee', height: '8px', borderRadius: '4px', marginTop: '20px' }}>
          <div style={{ width: `${((currentIndex + 1) / questions.length) * 100}%`, backgroundColor: '#0056b3', height: '100%', borderRadius: '4px', transition: 'width 0.3s' }}></div>
        </div>
        <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>{currentIndex + 1} / {questions.length}</p>
      </div>

      <div style={{ border: '1px solid #ddd', padding: '25px', borderRadius: '8px', minHeight: '300px', backgroundColor: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <span style={{ fontWeight: 'bold', color: '#0056b3' }}>Q{currentIndex + 1}.</span>
          <span style={{ fontSize: '14px', color: '#666' }}>{currentQ.score}점</span>
        </div>
        
        <p style={{ fontSize: '18px', lineHeight: '1.5', marginBottom: '25px' }}>{currentQ.content}</p>

        {/* 문제 유형별 입력 폼 */}
        {currentQ.type === 'MULTIPLE_CHOICE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentQ.options.map((opt, idx) => (
              <label key={idx} style={{ padding: '12px', border: '1px solid #eee', borderRadius: '4px', cursor: 'pointer', backgroundColor: userAnswers[currentQ.id] === String(idx + 1) ? '#e6f2ff' : 'white' }}>
                <input 
                  type="radio" 
                  name={`question-${currentQ.id}`} 
                  value={idx + 1}
                  checked={userAnswers[currentQ.id] === String(idx + 1)}
                  onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                  style={{ marginRight: '10px' }}
                />
                {opt}
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
            style={{ width: '100%', padding: '12px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        )}

        {currentQ.type === 'ESSAY' && (
          <textarea 
            placeholder="자유롭게 서술해 주세요" 
            value={userAnswers[currentQ.id] || ''}
            onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
            rows="6"
            style={{ width: '100%', padding: '12px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical' }}
          />
        )}
      </div>

      {/* 이전/다음/제출 버튼 네비게이션 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
        <button 
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          style={{ padding: '10px 20px', border: '1px solid #ccc', backgroundColor: currentIndex === 0 ? '#f9f9f9' : 'white', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', borderRadius: '4px' }}
        >
          이전
        </button>

        {currentIndex === questions.length - 1 ? (
          <button 
            onClick={handleSubmit}
            style={{ padding: '10px 30px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            최종 제출하기
          </button>
        ) : (
          <button 
            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
            style={{ padding: '10px 20px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            다음
          </button>
        )}
      </div>
    </div>
  );
}