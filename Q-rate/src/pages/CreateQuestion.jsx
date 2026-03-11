import { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { generateSingleQuestion } from '../services/geminiService';

export default function CreateQuestion() {
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('NONE');
  const [visibility, setVisibility] = useState('PRIVATE');
  
  const [type, setType] = useState('MULTIPLE_CHOICE');
  const [content, setContent] = useState('');
  const [options, setOptions] = useState(['', '', '', '']); // 기본 4지선다
  const [answer, setAnswer] = useState('');
  const [useAIGrading, setUseAIGrading] = useState(false);
  
  const [tagsInput, setTagsInput] = useState(''); // 신규: 태그 입력 상태

  // AI 생성 로딩 및 키워드 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState('');

  // 태그 파싱 및 글자 수 검증 함수 (한글 10자, 영문 20자 제한)
  const parseAndValidateTags = (tagString) => {
    const rawTags = tagString.split(',').map(t => t.trim()).filter(t => t !== '');
    const validTags = [];
    
    for (const tag of rawTags) {
      let byteLength = 0;
      for (let i = 0; i < tag.length; i++) {
        // 아스키 코드가 127보다 크면 한글/다국어로 간주하여 길이 2 추가
        byteLength += tag.charCodeAt(i) > 127 ? 2 : 1;
      }
      if (byteLength > 20) {
        throw new Error(`태그 "${tag}"가 길이 제한을 초과했습니다.\n(한글 최대 10자, 영문 최대 20자)`);
      }
      validTags.push(tag);
    }
    return validTags;
  };

  // 객관식 보기 조작 핸들러
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    if (options.length < 10) setOptions([...options, '']);
  };

  const removeOption = () => {
    if (options.length > 2) {
      setOptions(options.slice(0, -1));
      // 삭제된 보기가 정답이었을 경우 정답 초기화
      if (Number(answer) === options.length) setAnswer('');
    }
  };

  // AI로 문제 생성하기 핸들러
  const handleGenerateAI = async () => {
    if (!aiTopic.trim()) {
      alert('AI에게 출제를 부탁할 주제나 키워드를 입력해 주세요!');
      return;
    }

    setIsGenerating(true);
    try {
      // geminiService의 함수 호출
      const generatedData = await generateSingleQuestion(aiTopic, type, difficulty);
      
      // 결과값을 React 상태(Form 필드)에 자동 채우기
      setContent(generatedData.content || '');
      
      if (type === 'MULTIPLE_CHOICE') {
        // AI가 준 보기가 4개 미만일 경우 빈 문자열로 채움
        const newOptions = generatedData.options || [];
        while (newOptions.length < 4) newOptions.push('');
        setOptions(newOptions);
        setAnswer(generatedData.answer || '');
      } else {
        setAnswer(generatedData.answer || '');
      }

      // 태그도 자동으로 하나 달아주기 (편의성)
      setTagsInput(aiTopic.split(' ')[0]); // 첫 단어를 태그로 임시 설정

      alert('✨ AI가 성공적으로 문제를 생성했습니다! 내용을 확인하고 수정해 보세요.');
    } catch (error) {
      alert(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return alert('문제를 등록하려면 로그인이 필요합니다.');

    try {
      // 태그 검증 시도
      const parsedTags = parseAndValidateTags(tagsInput);

      const questionData = {
        creatorUid: auth.currentUser.uid,
        subject, difficulty, visibility, type, content,
        tags: parsedTags, // 신규: 검증된 태그 배열 저장
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
      
      // 초기화
      setContent(''); setOptions(['', '', '', '']); setAnswer(''); setTagsInput('');
      setSubject(''); setDifficulty('NONE'); setVisibility('PRIVATE'); setUseAIGrading(false);
    } catch (error) {
      alert(error.message || '저장 중 오류가 발생했습니다.');
    }
  };

  const inputClassName = "w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow";

  return (
    <div className="max-w-2xl mx-auto my-1 p-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">새로운 문제 출제</h2>

      {/* ========================================================= */}
      {/* 신규: AI 출제 도우미 패널 */}
      {/* ========================================================= */}
      <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl shadow-sm">
        <h3 className="text-lg font-bold text-purple-900 mb-2 flex items-center gap-2">
          <span>✨</span> AI 자동 출제 도우미
        </h3>
        <p className="text-sm text-purple-700 mb-4">
          원하는 주제를 입력하면 AI가 아래 선택된 <strong>[유형]</strong>과 <strong>[난이도]</strong>에 맞춰 폼을 자동으로 채워줍니다.
        </p>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="예: 대한민국 헌법 제1조, 파이썬 반복문, 뉴턴의 제2법칙..." 
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            disabled={isGenerating}
            className="flex-1 px-4 py-3 bg-white border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
          />
          <button 
            type="button" 
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-2"
          >
            {isGenerating ? (
              <><span className="animate-spin h-4 w-4 border-2 border-white border-b-transparent rounded-full"></span> 생성 중...</>
            ) : (
              '마법 생성'
            )}
          </button>
        </div>
      </div>
      {/* ========================================================= */}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">과목명</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="예: 국어, 프로그래밍..." required className={inputClassName} />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">난이도</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputClassName}>
              <option value="NONE">미선택</option><option value="EASY">초급</option><option value="MEDIUM">중급</option><option value="HARD">고급</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">문제 유형</label>
            <select value={type} onChange={(e) => { setType(e.target.value); setAnswer(''); }} className={inputClassName}>
              <option value="MULTIPLE_CHOICE">객관식</option>
              <option value="SHORT_ANSWER">주관식 (단답형)</option>
              <option value="ESSAY">서술식</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">공개 설정</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={`${inputClassName} bg-blue-50`}>
              <option value="PRIVATE">🔒 비공개 (나만 보기)</option>
              <option value="PUBLIC">🌐 전체 공개</option>
            </select>
          </div>
        </div>

        {/* 신규: 태그 입력란 */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">태그 (선택)</label>
          <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="쉼표(,)로 구분하여 입력 (예: 수능기출, 핵심요약)" className={inputClassName} />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">문제 내용</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows="4" placeholder="문제를 입력하세요" className={inputClassName} />
        </div>

        {/* 객관식일 경우 동적 보기 UI */}
        {type === 'MULTIPLE_CHOICE' && (
          <div className="p-5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-bold text-gray-700">보기 입력 (현재 {options.length}개)</label>
              <div className="flex gap-2">
                <button type="button" onClick={removeOption} disabled={options.length <= 2} className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50">- 삭제</button>
                <button type="button" onClick={addOption} disabled={options.length >= 10} className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-100 disabled:opacity-50">+ 추가</button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {options.map((opt, idx) => (
                <input key={idx} type="text" placeholder={`보기 ${idx + 1}`} value={opt} onChange={(e) => handleOptionChange(idx, e.target.value)} required className={inputClassName} />
              ))}
            </div>
            <div className="mt-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">정답 번호 (1~{options.length})</label>
              <input type="number" min="1" max={options.length} value={answer} onChange={(e) => setAnswer(e.target.value)} required className={inputClassName} />
            </div>
          </div>
        )}

        {/* ... (주관식/서술식 폼 코드는 이전과 동일) ... */}
        {type === 'SHORT_ANSWER' && (
          <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-2">정답 (완벽 일치)</label>
            <input type="text" placeholder="정확한 정답을 입력하세요" value={answer} onChange={(e) => setAnswer(e.target.value)} required className={inputClassName} />
          </div>
        )}

        {type === 'ESSAY' && (
          <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-2">모범 답안 및 필수 키워드</label>
            <textarea placeholder="채점 기준이 될 내용을 입력하세요" value={answer} onChange={(e) => setAnswer(e.target.value)} required rows="3" className={inputClassName} />
            <div className="mt-4 flex items-center gap-2">
              <input type="checkbox" id="aiGrading" checked={useAIGrading} onChange={(e) => setUseAIGrading(e.target.checked)} className="w-4 h-4 text-primary rounded focus:ring-primary" />
              <label htmlFor="aiGrading" className="text-sm font-bold text-purple-700">✨ AI 서술형 채점 활성화 (일치도 % 계산)</label>
            </div>
          </div>
        )}

        <button type="submit" className="mt-4 w-full py-4 bg-primary hover:bg-primaryHover text-white font-bold rounded-xl shadow-md transition-colors text-lg">
          문제 DB에 저장하기
        </button>
      </form>
    </div>
  );
}