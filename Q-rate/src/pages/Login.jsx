import { useState } from 'react';
import { auth } from '../firebase'; // 이전 단계에서 만든 firebase.js 연동
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false); // true면 회원가입, false면 로그인 모드
  const [errorMsg, setErrorMsg] = useState('');
  
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg(''); // 에러 메시지 초기화

    try {
      if (isRegister) {
        // 회원가입 로직
        await createUserWithEmailAndPassword(auth, email, password);
        alert('회원가입이 완료되었습니다!');
      } else {
        // 로그인 로직
        await signInWithEmailAndPassword(auth, email, password);
        alert('로그인 성공!');
      }
      navigate('/'); // 성공 시 메인 화면으로 이동
    } catch (error) {
      // 에러 처리 (Firebase 에러 코드를 한글로 변경할 수도 있습니다)
      console.error(error);
      if (error.code === 'auth/email-already-in-use') setErrorMsg('이미 사용 중인 이메일입니다.');
      else if (error.code === 'auth/wrong-password') setErrorMsg('비밀번호가 틀렸습니다.');
      else if (error.code === 'auth/user-not-found') setErrorMsg('가입되지 않은 이메일입니다.');
      else setErrorMsg('인증 처리 중 오류가 발생했습니다.');
    }
  };

  const toggleMode = () => setIsRegister(!isRegister);

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2>{isRegister ? '회원가입' : '로그인'}</h2>
      
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="email" 
          placeholder="이메일" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required 
          style={{ padding: '10px' }}
        />
        <input 
          type="password" 
          placeholder="비밀번호 (6자리 이상)" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required 
          style={{ padding: '10px' }}
        />
        
        {errorMsg && <p style={{ color: 'red', fontSize: '14px', margin: '0' }}>{errorMsg}</p>}
        
        <button type="submit" style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}>
          {isRegister ? '가입하기' : '로그인'}
        </button>
      </form>

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>
          {isRegister ? '이미 계정이 있으신가요? ' : '아직 계정이 없으신가요? '}
        </span>
        <button onClick={toggleMode} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}>
          {isRegister ? '로그인하러 가기' : '회원가입하기'}
        </button>
      </div>
    </div>
  );
}