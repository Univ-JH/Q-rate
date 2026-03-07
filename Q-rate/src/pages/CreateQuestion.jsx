import { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function CreateQuestion() {
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [visibility, setVisibility] = useState('PRIVATE'); // 신규: 공개 여부 상태 추가 (기본값: 비공개)
  
  const [type, setType] = useState('MULTIPLE_CHOICE');
  const [content, setContent] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState('');
  const [useAIGrading, setUseAIGrading] = useState(false);

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return alert('문제를 등록하려면 로그인이 필요합니다.');

    try {
      const questionData = {
        creatorUid: auth.currentUser.uid,
        subject: subject,
        difficulty: difficulty,
        visibility: visibility, // DB에 공개 상태 저장
        type: type,
        content: content,
        createdAt: new Date(),
      };

      if (type === 'MULTIPLE_CHOICE') {
        questionData.options = options;
        questionData.answer = answer; 
      } else {
        questionData.answer = answer;
        if (type === 'ESSAY') questionData.useAIGrading = useAIGrading;
      }

      await addDoc(collection(db, 'questions'), questionData);
      alert('문제가 성공적으로 저장되었습니다!');
      
      // 폼 초기화
      setContent('');
      setOptions(['', '', '', '']);
      setAnswer('');
      setSubject('');
      setDifficulty('MEDIUM');
      setVisibility('PRIVATE');
      setUseAIGrading(false);
      
    } catch (error) {
      console.error("Error: ", error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2>새로운 문제 등록</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 신규: 공개 설정 */}
        <div>
          <label style={{ fontWeight: 'bold' }}>공개 설정</label>
          <select 
            value={visibility} 
            onChange={(e) => setVisibility(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '8px', backgroundColor: '#f0f8ff' }}
          >
            <option value="PRIVATE">🔒 비공개 (나만 보기)</option>
            <option value="LINK">🔗 링크 공개 (링크가 있는 사람만 풀기 가능)</option>
            <option value="PUBLIC">🌐 전체 공개 (누구나 검색 및 풀기 가능)</option>
          </select>
        </div>

        {/* 과목 및 난이도 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: 'bold' }}>과목명</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="예: 국어, 알고리즘..." required style={{ width: '100%', padding: '8px', marginTop: '8px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: 'bold' }}>난이도</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '8px' }}>
              <option value="EASY">하</option>
              <option value="MEDIUM">중</option>
              <option value="HARD">상</option>
            </select>
          </div>
        </div>

        {/* 문제 유형 및 내용 (이전과 동일) */}
        <div>
          <label style={{ fontWeight: 'bold' }}>문제 유형</label>
          <select value={type} onChange={(e) => { setType(e.target.value); setAnswer(''); }} style={{ width: '100%', padding: '8px', marginTop: '8px' }}>
            <option value="MULTIPLE_CHOICE">객관식</option>
            <option value="SHORT_ANSWER">주관식 (단답형)</option>
            <option value="ESSAY">서술식</option>
          </select>
        </div>

        <div>
          <label style={{ fontWeight: 'bold' }}>문제 내용</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows="4" style={{ width: '100%', padding: '8px', marginTop: '8px' }} />
        </div>

        {/* 유형별 입력 폼 */}
        {type === 'MULTIPLE_CHOICE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {options.map((opt, idx) => (
              <input key={idx} type="text" placeholder={`보기 ${idx + 1}`} value={opt} onChange={(e) => handleOptionChange(idx, e.target.value)} required style={{ padding: '8px' }} />
            ))}
            <label style={{ fontWeight: 'bold' }}>정답 번호 (1~4)</label>
            <input type="number" min="1" max="4" value={answer} onChange={(e) => setAnswer(e.target.value)} required style={{ padding: '8px' }} />
          </div>
        )}
        {type === 'SHORT_ANSWER' && (
          <input type="text" placeholder="정답 (완벽 일치)" value={answer} onChange={(e) => setAnswer(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        )}
        {type === 'ESSAY' && (
          <div>
            <textarea placeholder="모범 답안 및 키워드" value={answer} onChange={(e) => setAnswer(e.target.value)} required rows="3" style={{ width: '100%', padding: '8px' }} />
            <div style={{ marginTop: '10px' }}>
              <input type="checkbox" id="aiGrading" checked={useAIGrading} onChange={(e) => setUseAIGrading(e.target.checked)} />
              <label htmlFor="aiGrading"> AI를 이용해 일치도(%) 채점</label>
            </div>
          </div>
        )}

        <button type="submit" style={{ padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
          문제 저장하기
        </button>
      </form>
    </div>
  );
}