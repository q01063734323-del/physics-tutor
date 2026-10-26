"use client";
export default function OfflinePage() {
  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"#f5f7fb",fontFamily:"Arial, sans-serif",color:"#16233d"}}>
      <section style={{maxWidth:440,textAlign:"center",background:"#fff",border:"1px solid #e5eaf3",borderRadius:20,padding:32,boxShadow:"0 14px 35px rgba(35,55,100,.07)"}}>
        <div style={{fontSize:42,marginBottom:12}}>◌</div>
        <h1 style={{margin:"0 0 10px"}}>Нет соединения</h1>
        <p style={{color:"#71809a",lineHeight:1.5}}>Проверь интернет и обнови страницу. После восстановления сети задания и прогресс снова будут доступны.</p>
        <button onClick={() => window.location.reload()} style={{border:0,borderRadius:10,padding:"11px 16px",background:"#526df5",color:"#fff",fontWeight:700,cursor:"pointer"}}>Повторить</button>
      </section>
    </main>
  );
}
