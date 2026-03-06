import { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function CreateQuestion() {
  const [type, setType] = useState('MULTIPLE_CHOICE'); // 기본값: 객관식
  const [content, setContent] = useState('');
  const [options, setOptions] = useState(['', '', '', '']); // 4지 선다 보기
  const [answer, setAnswer] = useState(''); // 정답 (객관식은 번호, 나머지는 텍스트)
  const [useAIGrading, setUseAIGrading] = useState(false); // 서술형 AI 채점 여부

  // 객관식 보기 텍스트 변경 핸들러
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  // 폼 제출(DB 저장) 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 로그인 체크
    if (!auth.currentUser) {
      alert('문제를 등록하려면 로그인이 필요합니다.');
      return;
    }

    try {
      // DB에 저장할 기본 데이터 구조
      const questionData = {
        creatorUid: auth.currentUser.uid,
        type: type,
        content: content,
        createdAt: new Date(),
      };

      // 문제 유형에 따라 추가 데이터 세팅
      if (type === 'MULTIPLE_CHOICE') {
        questionData.options = options;
        questionData.answer = answer; 
      } else if (type === 'SHORT_ANSWER') {
        questionData.answer = answer;
      } else if (type === 'ESSAY') {
        questionData.answer = answer; // 모범 답안 또는 필수 키워드
        questionData.useAIGrading = useAIGrading;
      }

      // Firestore의 'questions' 컬렉션에 데이터 추가
      await addDoc(collection(db, 'questions'), questionData);
      
      alert('문제가 성공적으로 저장되었습니다!');
      
      // 저장 후 입력창 초기화
      setContent('');
      setOptions(['', '', '', '']);
      setAnswer('');
      setUseAIGrading(false);
      
    } catch (error) {
      console.error("Error adding document: ", error);
      alert('문제 저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2>새로운 문제 등록</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 1. 문제 유형 선택 */}
        <div>
          <label style={{ fontWeight: 'bold' }}>문제 유형</label>
          <select 
            value={type} 
            onChange={(e) => {
              setType(e.target.value);
              setAnswer(''); // 유형 변경 시 정답 초기화
            }}
            style={{ width: '100%', padding: '8px', marginTop: '8px' }}
          >
            <option value="MULTIPLE_CHOICE">객관식</option>
            <option value="SHORT_ANSWER">주관식 (단답형)</option>
            <option value="ESSAY">서술식</option>
          </select>
        </div>

        {/* 2. 문제 내용 입력 */}
        <div>
          <label style={{ fontWeight: 'bold' }}>문제 내용</label>
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="문제를 입력하세요"
            required
            rows="4"
            style={{ width: '100%', padding: '8px', marginTop: '8px' }}
          />
        </div>

        {/* 3. 유형별 동적 입력 폼 (조건부 렌더링) */}
        
        {/* 객관식일 경우: 보기 4개 입력 및 정답 선택 */}
        {type === 'MULTIPLE_CHOICE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>보기 입력</label>
            {options.map((opt, idx) => (
              <input 
                key={idx}
                type="text" 
                placeholder={`보기 ${idx + 1}`}
                value={opt}
                onChange={(e) => handleOptionChange(idx, e.target.value)}
                required
                style={{ padding: '8px' }}
              />
            ))}
            <label style={{ fontWeight: 'bold', marginTop: '10px' }}>정답 번호 (1~4)</label>
            <input 
              type="number" 
              min="1" max="4"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              required
              style={{ padding: '8px' }}
            />
          </div>
        )}

        {/* 주관식일 경우: 정확한 정답 텍스트 입력 */}
        {type === 'SHORT_ANSWER' && (
          <div>
            <label style={{ fontWeight: 'bold' }}>정답 (완벽 일치)</label>
            <input 
              type="text" 
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="정확한 정답을 입력하세요"
              required
              style={{ width: '100%', padding: '8px', marginTop: '8px' }}
            />
          </div>
        )}

        {/* 서술식일 경우: 모범 답안 및 AI 채점 옵션 */}
        {type === 'ESSAY' && (
          <div>
            <label style={{ fontWeight: 'bold' }}>모범 답안 또는 필수 포함 키워드</label>
            <textarea 
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="채점의 기준이 될 모범 답안이나 키워드를 입력하세요"
              required
              rows="3"
              style={{ width: '100%', padding: '8px', marginTop: '8px' }}
            />
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="aiGrading"
                checked={useAIGrading}
                onChange={(e) => setUseAIGrading(e.target.checked)}
              />
              <label htmlFor="aiGrading">이 문제는 AI를 이용해 채점 (일치도 % 계산)</label>
            </div>
          </div>
        )}

        <button type="submit" style={{ padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' }}>
          문제 DB에 저장하기
        </button>
      </form>
    </div>
  );
}