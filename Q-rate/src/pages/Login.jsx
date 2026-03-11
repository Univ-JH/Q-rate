import { useState } from 'react';
import { auth, db } from '../firebase'; 
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore'; // 추가됨
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // 신규 추가: 별명과 관심분야 상태
  const [nickname, setNickname] = useState('');
  const [interests, setInterests] = useState(''); 
  
  const [isRegister, setIsRegister] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      if (isRegister) {
        // 1. Firebase Auth 계정 생성
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Auth 프로필에 별명 업데이트
        await updateProfile(user, { displayName: nickname });

        // 3. Firestore 'users' 컬렉션에 추가 프로필 데이터 저장
        const interestsArray = interests.split(',').map(item => item.trim()).filter(item => item !== '');
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          nickname: nickname,
          interests: interestsArray,
          createdAt: new Date()
        });

        alert('회원가입이 완료되었습니다!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') setErrorMsg('이미 사용 중인 이메일입니다.');
      else setErrorMsg('인증 처리 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2>{isRegister ? '회원가입' : '로그인'}</h2>
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: '10px' }} />
        <input type="password" placeholder="비밀번호 (6자리 이상)" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: '10px' }} />
        
        {/* 회원가입 시에만 보이는 추가 입력란 */}
        {isRegister && (
          <>
            <input type="text" placeholder="별명 (필수)" value={nickname} onChange={(e) => setNickname(e.target.value)} required style={{ padding: '10px' }} />
            <input type="text" placeholder="관심 분야 (쉼표로 구분. 예: 수학, 프로그래밍)" value={interests} onChange={(e) => setInterests(e.target.value)} style={{ padding: '10px' }} />
          </>
        )}
        
        {errorMsg && <p style={{ color: 'red', fontSize: '14px', margin: '0' }}>{errorMsg}</p>}
        <button type="submit" style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}>
          {isRegister ? '가입하기' : '로그인'}
        </button>
      </form>
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button onClick={() => setIsRegister(!isRegister)} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}>
          {isRegister ? '로그인하러 가기' : '회원가입하기'}
        </button>
      </div>
    </div>
  );
}