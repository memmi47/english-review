import './App.css'

function App() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5ff',
      fontFamily: 'sans-serif',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1.5rem',
        padding: '3rem 2rem',
        boxShadow: '0 4px 24px rgba(79,70,229,0.1)',
        maxWidth: '400px',
        width: '100%',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
        <h1 style={{ color: '#4f46e5', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
          영어 학습 복습
        </h1>
        <p style={{ color: '#555', marginBottom: '1.5rem' }}>
          앱이 정상적으로 실행되고 있어요!
        </p>
        <p style={{ color: '#aaa', fontSize: '0.85rem' }}>
          곧 단어 복습 기능이 추가될 예정입니다.
        </p>
      </div>
    </div>
  )
}

export default App
