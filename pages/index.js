import Head from "next/head";
import { useState, useEffect, useRef } from "react";

const ALL_PLATS = ["Facebook","Instagram","LinkedIn","YouTube","TikTok","X / Twitter"];
const VIDEO_ONLY = ["YouTube","TikTok"];
const PI = {
  Facebook:"ti-brand-facebook",Instagram:"ti-brand-instagram",LinkedIn:"ti-brand-linkedin",
  YouTube:"ti-brand-youtube",TikTok:"ti-brand-tiktok","X / Twitter":"ti-brand-x"
};

function fmtDate(d) { if(!d)return"—"; const[y,m,day]=d.split("-"); return`${day}/${m}/${y}`; }
function fmtTime(t) { if(!t)return"—"; const[h,mn]=t.split(":"); const hr=parseInt(h); return`${hr>12?hr-12:hr||12}:${mn} ${hr>=12?"PM":"AM"}`; }
function typeLabel(t) { return{post:"Post",carousel:"Carousel",video:"Video / Reel",story:"Story"}[t]||t; }
function getStatus(p) { const d=p.platforms.filter(x=>x.posted).length; return d===0?"pending":d===p.platforms.length?"done":"partial"; }
function getUrgency(p) {
  if(getStatus(p)==="done") return "done";
  const now=new Date(); const todayStr=now.toISOString().slice(0,10);
  const pd=new Date(p.date+"T"+(p.time||"23:59"));
  if(pd<now) return "overdue";
  if(p.date===todayStr) return "today";
  return "upcoming";
}

// ── TOAST ────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState("");
  const [show, setShow] = useState(false);
  const timer = useRef(null);
  const toast = (m) => {
    setMsg(m); setShow(true);
    if(timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(()=>setShow(false), 2500);
  };
  return { msg, show, toast };
}

export default function Home() {
  const [role, setRole] = useState(null); // null | 'pm' | 'posting'
  const [selectedRole, setSelectedRole] = useState(null);
  const [pin, setPin] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [clients, setClients] = useState({});
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const { msg: toastMsg, show: toastShow, toast } = useToast();

  // ── PM filters
  const [pmFilterClient, setPmFilterClient] = useState("");
  const [pmFilterStatus, setPmFilterStatus] = useState("");

  // ── Post filters
  const [postFilterClient, setPostFilterClient] = useState("");
  const [postFilterShow, setPostFilterShow] = useState("pending");

  // ── New post form
  const [fClient, setFClient] = useState(""); const [fType, setFType] = useState("");
  const [fDate, setFDate] = useState(""); const [fTime, setFTime] = useState("");
  const [fTitle, setFTitle] = useState(""); const [fCaption, setFCaption] = useState("");
  const [fAsset, setFAsset] = useState(""); const [fRemarks, setFRemarks] = useState("");
  const [selPlats, setSelPlats] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);

  // ── Clients tab
  const [newClientName, setNewClientName] = useState("");
  const [newClientPlats, setNewClientPlats] = useState([]);
  const [editingClient, setEditingClient] = useState(null);
  const [editClientName, setEditClientName] = useState("");
  const [editClientPlats, setEditClientPlats] = useState([]);
  const [clientSuccess, setClientSuccess] = useState("");

  // ── Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editPost, setEditPost] = useState(null);
  const [editSelPlats, setEditSelPlats] = useState([]);
  const [saveEditLoading, setSaveEditLoading] = useState(false);

  // ── SOW tab
  const [sowRows, setSowRows] = useState([]);
  const [sowLoading, setSowLoading] = useState(false);
  const [sowPin, setSowPin] = useState("");
  const [sowUnlocked, setSowUnlocked] = useState(false);
  const [sowPinErr, setSowPinErr] = useState("");
  const [sowFilterStatus, setSowFilterStatus] = useState("");
  const [sowFilterPriority, setSowFilterPriority] = useState("");
  const [sowDateFrom, setSowDateFrom] = useState("");
  const [sowDateTo, setSowDateTo] = useState("");
  const [sowEditRow, setSowEditRow] = useState(null);
  const [sowSaving, setSowSaving] = useState(false);
  const [sowAddMode, setSowAddMode] = useState(false);

  // ── Global date range filter (applies to Overview + Posting Team)
  const [globalDateFrom, setGlobalDateFrom] = useState("");
  const [globalDateTo, setGlobalDateTo] = useState("");

  // ── LOAD ──────────────────────────────────────────────────
  async function loadAll() {
    setLoading(true);
    try {
      const [cr, pr] = await Promise.all([
        fetch("/api/clients").then(r=>r.json()),
        fetch("/api/posts").then(r=>r.json()),
      ]);
      if(cr.ok) setClients(cr.clients);
      if(pr.ok) setPosts(pr.posts);
    } catch(e) { toast("Failed to load data."); }
    setLoading(false);
  }

  async function loadSOW() {
    setSowLoading(true);
    try {
      const r = await fetch("/api/sow").then(x=>x.json());
      if(r.ok) setSowRows(r.rows);
    } catch { toast("Failed to load SOW."); }
    setSowLoading(false);
  }

  function tryUnlockSOW() {
    if(sowPin === "11111") { setSowUnlocked(true); setSowPinErr(""); setSowPin(""); }
    else { setSowPinErr("Incorrect PIN."); }
  }

  async function saveSowRow(row) {
    setSowSaving(true);
    try {
      const r = await fetch("/api/sow",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sowPin:"11111",row})}).then(x=>x.json());
      if(!r.ok){ toast("Error: "+r.error); setSowSaving(false); return; }
      toast("SOW updated!"); setSowEditRow(null); setSowAddMode(false);
      await loadSOW();
    } catch { toast("Failed to save."); }
    setSowSaving(false);
  }

  async function saveTrackerVal(clientId, month, made) {
    try {
      const r = await fetch("/api/sow",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sowPin:"11111",tracker:{clientId,month,made}})}).then(x=>x.json());
      if(!r.ok){ toast("Error: "+r.error); return; }
      setSowRows(prev=>prev.map(row=>{
        if(row.id!==clientId) return row;
        const newTracker = {...row.tracker};
        if(made===null) { delete newTracker[month]; } // clear override
        else { newTracker[month] = made; }
        return {...row, tracker: newTracker};
      }));
      toast(made===null ? "Override cleared — using auto-count." : "Override saved!");
    } catch { toast("Failed to update tracker."); }
  }

  async function deleteSowRow(id, name) {
    if(!confirm(`Remove "${name}" from SOW? This cannot be undone.`)) return;
    try {
      const r = await fetch("/api/sow",{method:"DELETE",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sowPin:"11111",id})}).then(x=>x.json());
      if(!r.ok){ toast("Error: "+r.error); return; }
      toast(`"${name}" removed from SOW.`); await loadSOW();
    } catch { toast("Failed to delete."); }
  }

  // ── AUTH ──────────────────────────────────────────────────
  async function doLogin() {
    setLoginErr("");
    if(!selectedRole){ setLoginErr("Please select a role first."); return; }
    if(!pin){ setLoginErr("Please enter your PIN."); return; }
    setLoginLoading(true);
    try {
      const r = await fetch("/api/verify-pin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin})}).then(x=>x.json());
      if(!r.ok){ setLoginErr("Incorrect PIN. Please try again."); setLoginLoading(false); return; }
      setRole(r.role); setPin(""); setLoginLoading(false);
      await loadAll();
    } catch { setLoginErr("Connection error. Please try again."); setLoginLoading(false); }
  }

  function logout() { setRole(null); setSelectedRole(null); setPin(""); setPosts([]); setClients({}); }

  // ── PLATFORMS ─────────────────────────────────────────────
  function getActivePlats(client, type) {
    if(!client) return [];
    const all = clients[client] || [];
    return (!type||type==="video") ? all : all.filter(p=>!VIDEO_ONLY.includes(p));
  }

  function togglePlat(p, arr, setArr) {
    setArr(arr.includes(p) ? arr.filter(x=>x!==p) : [...arr, p]);
  }

  // When client/type changes for new post form, reset selPlats to all available
  useEffect(()=>{
    const active = getActivePlats(fClient, fType);
    setSelPlats([...active]);
  }, [fClient, fType, clients]);

  // ── CREATE POST ───────────────────────────────────────────
  async function createPost() {
    if(!fClient||!fType||!fDate||!fTitle.trim()){ toast("Fill in client, type, date and title."); return; }
    if(!selPlats.length){ toast("Select at least one platform."); return; }
    setCreateLoading(true);
    try {
      const r = await fetch("/api/posts",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({client:fClient,type:fType,date:fDate,time:fTime,title:fTitle.trim(),caption:fCaption.trim(),asset:fAsset.trim(),remarks:fRemarks.trim(),platforms:selPlats})
      }).then(x=>x.json());
      if(!r.ok){ toast("Error: "+r.error); setCreateLoading(false); return; }
      toast("Post added to calendar and saved to Google Sheets!");
      setFClient(""); setFType(""); setFDate(""); setFTime(""); setFTitle(""); setFCaption(""); setFAsset(""); setFRemarks(""); setSelPlats([]);
      setCreateLoading(false); await loadAll(); setActiveTab("overview");
    } catch { toast("Failed to save post."); setCreateLoading(false); }
  }

  // ── CLIENTS CRUD ──────────────────────────────────────────
  async function addClient() {
    if(!newClientName.trim()){ toast("Enter a client name."); return; }
    if(clients[newClientName]){ toast("Client already exists."); return; }
    if(!newClientPlats.length){ toast("Select at least one platform."); return; }
    const updated = {...clients, [newClientName.trim()]: newClientPlats};
    try {
      const r = await fetch("/api/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clients:updated})}).then(x=>x.json());
      if(!r.ok){ toast("Error: "+r.error); return; }
      setClients(updated); setNewClientName(""); setNewClientPlats([]);
      showClientSuccess(`Client "${newClientName.trim()}" added successfully.`);
    } catch { toast("Failed to save client."); }
  }

  async function saveEditClient() {
    if(!editClientName.trim()){ toast("Name cannot be empty."); return; }
    if(!editClientPlats.length){ toast("Select at least one platform."); return; }
    const updated = {...clients};
    if(editClientName !== editingClient) {
      if(updated[editClientName]){ toast("A client with this name already exists."); return; }
      delete updated[editingClient];
    }
    updated[editClientName] = editClientPlats;
    try {
      const r = await fetch("/api/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clients:updated})}).then(x=>x.json());
      if(!r.ok){ toast("Error: "+r.error); return; }
      setClients(updated); setEditingClient(null);
      showClientSuccess(`Client "${editClientName}" updated.`);
    } catch { toast("Failed to save."); }
  }

  async function deleteClient(name) {
    if(!confirm(`Remove "${name}"? Their existing posts won't be deleted.`)) return;
    const updated = {...clients}; delete updated[name];
    try {
      const r = await fetch("/api/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clients:updated})}).then(x=>x.json());
      if(!r.ok){ toast("Error: "+r.error); return; }
      setClients(updated); showClientSuccess(`Client "${name}" removed.`);
    } catch { toast("Failed to remove."); }
  }

  function showClientSuccess(m) { setClientSuccess(m); setTimeout(()=>setClientSuccess(""), 3000); }

  // ── MARK POSTED ───────────────────────────────────────────
  async function markPlatform(postId, platName, platIdx, checked, name, clientName, screenshotFile) {
    if(!checked) return;
    const postedBy = name || "Unknown";
    let screenshot = null;
    if(screenshotFile) {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
          const img = new Image();
          img.onload = () => {
            // Try progressively harder compression until under 36000 chars (~50k limit with margin)
            const attempts = [
              { maxW: 480, quality: 0.5 },
              { maxW: 360, quality: 0.4 },
              { maxW: 280, quality: 0.3 },
            ];
            for (const { maxW, quality } of attempts) {
              const scale = img.width > maxW ? maxW / img.width : 1;
              const canvas = document.createElement("canvas");
              canvas.width = Math.round(img.width * scale);
              canvas.height = Math.round(img.height * scale);
              canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
              const b64 = canvas.toDataURL("image/jpeg", quality).split(",")[1];
              if (b64.length < 36000) { resolve(b64); return; }
            }
            reject(new Error("Image too large to compress under Sheets limit. Please crop or resize it first."));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(screenshotFile);
      }).catch(err => { toast("Error: " + err.message); return null; });
      if (!data) return;
      screenshot = { data, name: screenshotFile.name.replace(/\.[^.]+$/, ".jpg"), mimeType: "image/jpeg", clientName };
    }
    try {
      const r = await fetch("/api/mark-posted",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({postId,platformName:platName,postedBy,screenshot})}).then(x=>x.json());
      if(!r.ok){ toast("Error: "+r.error); return; }
      setPosts(posts.map(p=>{
        if(p.id.toString()!==postId.toString()) return p;
        return {...p, platforms: p.platforms.map((pl,i)=> i===platIdx ? {...pl,posted:true,postedBy,screenshotLink:r.screenshotLink} : pl)};
      }));
      toast(`${platName} marked as posted!${r.screenshotLink?" Screenshot saved.":""}`);
    } catch { toast("Failed to save. Try again."); }
  }

  // ── EDIT MODAL ────────────────────────────────────────────
  function openEditModal(postId) {
    const p = posts.find(x=>x.id.toString()===postId.toString());
    if(!p) return;
    setEditPost({...p,
      editClient:p.client, editType:p.type, editDate:p.date, editTime:p.time,
      editTitle:p.title, editCaption:p.caption, editAsset:p.asset, editRemarks:p.remarks
    });
    setEditSelPlats(p.platforms.map(pl=>pl.name));
    setEditModal(true);
  }

  async function saveEditPost() {
    if(!editPost.editClient||!editPost.editType||!editPost.editDate||!editPost.editTitle.trim()){ toast("Fill in client, type, date and title."); return; }
    if(!editSelPlats.length){ toast("Select at least one platform."); return; }
    // Detect if date changed — show confirmation
    const originalPost = posts.find(x=>x.id.toString()===editPost.id.toString());
    const dateChanged = originalPost && originalPost.date !== editPost.editDate;
    const hasPosted = originalPost && originalPost.platforms.some(pl=>pl.posted);
    if(dateChanged && hasPosted) {
      if(!confirm(`Date changed from ${originalPost.date} to ${editPost.editDate}.\n\nThis will reset ALL platforms back to pending — the posting team will need to repost everything.\n\nContinue?`)) return;
    }
    setSaveEditLoading(true);
    try {
      const r = await fetch("/api/posts",{method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id:editPost.id,client:editPost.editClient,type:editPost.editType,date:editPost.editDate,time:editPost.editTime,
          title:editPost.editTitle.trim(),caption:editPost.editCaption.trim(),asset:editPost.editAsset.trim(),remarks:editPost.editRemarks.trim(),
          platforms:editSelPlats, resetPlatforms: dateChanged && hasPosted})
      }).then(x=>x.json());
      if(!r.ok){ toast("Error: "+r.error); setSaveEditLoading(false); return; }
      toast(dateChanged && hasPosted ? "Post rescheduled — all platforms reset to pending!" : "Post updated successfully!");
      setEditModal(false); setSaveEditLoading(false);
      await loadAll();
    } catch { toast("Failed to save."); setSaveEditLoading(false); }
  }

  async function confirmDeletePost(postId) {
    const id = postId || editPost?.id;
    const p = posts.find(x=>x.id.toString()===id.toString());
    if(!confirm(`Delete "${p?.title}"? This cannot be undone.`)) return;
    try {
      const r = await fetch(`/api/posts?id=${id}`,{method:"DELETE"}).then(x=>x.json());
      if(!r.ok){ toast("Error: "+r.error); return; }
      toast("Post deleted."); setEditModal(false); await loadAll();
    } catch { toast("Failed to delete."); }
  }

  // ── RENDER ────────────────────────────────────────────────
  const clientNames = Object.keys(clients).sort();
  const today = new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  // LOGIN
  if(!role) return (
    <>
      <Head>
        <title>Postings</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css"/>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;600&family=Cormorant+Garamond:ital,wght@1,400&display=swap"/>
      </Head>
      <style>{globalCSS}</style>
      <div className="login-wrap">
        <QuoteCard/>
        <div className="login-card">
          <div className="login-logo"><div className="logo-text"><span className="lm">meraki</span><span className="la">ads</span></div></div>
          <p className="login-sub">Posting Dashboard</p>
          <div className="role-grid">
            <div className={`role-btn ${selectedRole==="pm"?"selected":""}`} onClick={()=>setSelectedRole("pm")}>
              <i className="ti ti-layout-dashboard"></i>
              <span>PM</span><small>Manage posts</small>
            </div>
            <div className={`role-btn ${selectedRole==="posting"?"selected":""}`} onClick={()=>setSelectedRole("posting")}>
              <i className="ti ti-send"></i>
              <span>Posting</span><small>Mark posted</small>
            </div>
          </div>
          <div className="form-group">
            <input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Enter your PIN"
              onKeyDown={e=>e.key==="Enter"&&doLogin()} style={{textAlign:"center",letterSpacing:"4px",fontSize:"16px"}}/>
          </div>
          {loginErr && <div className="err-msg" style={{display:"block"}}>{loginErr}</div>}
          <div style={{marginTop:12}}>
            <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={doLogin} disabled={loginLoading}>
              {loginLoading ? <><span className="spinner"></span> Checking...</> : <><i className="ti ti-login"></i> Sign in</>}
            </button>
          </div>
        </div>
      </div>
      <Toast msg={toastMsg} show={toastShow}/>
    </>
  );

  // PM SCREEN
  if(role==="pm") {
    const filteredPosts = posts.filter(p=>
      (!pmFilterClient||p.client===pmFilterClient) &&
      (!pmFilterStatus || (pmFilterStatus==="overdue"?getUrgency(p)==="overdue":pmFilterStatus==="today"?getUrgency(p)==="today":pmFilterStatus==="upcoming"?getUrgency(p)==="upcoming":pmFilterStatus==="done"?getStatus(p)==="done":true)) &&
      (!globalDateFrom || p.date >= globalDateFrom) &&
      (!globalDateTo || p.date <= globalDateTo)
    );
    const groups = [
      {key:"overdue",label:"Overdue",cls:"g-overdue",items:filteredPosts.filter(p=>getUrgency(p)==="overdue")},
      {key:"today",label:"Due today",cls:"g-today",items:filteredPosts.filter(p=>getUrgency(p)==="today")},
      {key:"upcoming",label:"Upcoming",cls:"g-upcoming",items:filteredPosts.filter(p=>getUrgency(p)==="upcoming")},
      {key:"done",label:"Posted",cls:"g-done",items:filteredPosts.filter(p=>getStatus(p)==="done")},
    ];
    const ov=posts.filter(p=>getUrgency(p)==="overdue").length;
    const td=posts.filter(p=>getUrgency(p)==="today").length;
    const up=posts.filter(p=>getUrgency(p)==="upcoming").length;
    const dn=posts.filter(p=>getStatus(p)==="done").length;

    return (
      <>
        <Head><title>PM Dashboard – Postings</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css"/>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;600&family=Cormorant+Garamond:ital,wght@1,400&display=swap"/></Head>
        <style>{globalCSS}</style>

        <div className="topbar">
          <TopbarBotanical/>
          <div className="topbar-logo"><span className="lm">meraki</span><span className="la">ads</span></div>
          <div className="topbar-right">
            <button className="btn btn-sm" onClick={loadAll}><i className="ti ti-refresh"></i> Refresh</button>
            <button className="btn btn-sm" onClick={logout}><i className="ti ti-logout"></i> Sign out</button>
          </div>
        </div>
        <div className="nav-bar">
          {["overview","new","clients","sow"].map((t,i)=>(
            <div key={t} className={`nav-item ${activeTab===t?"active":""}`} onClick={()=>{ setActiveTab(t); if(t==="sow") { loadSOW(); fetch("/api/posts").then(r=>r.json()).then(pr=>{ if(pr.ok) setPosts(pr.posts); }); } }}>
              <i className={`ti ${["ti-chart-bar","ti-plus","ti-users","ti-file-text"][i]}`}></i>
              {["Overview","New post","Clients & Platforms","SOW"][i]}
            </div>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab==="overview" && (
          <div className="content" style={{position:"relative"}}><BodyBotanical/>
            {/* Alerts */}
            {ov>0 && <div className="alert alert-red"><i className="ti ti-alert-circle"></i><span><strong>{ov} post{ov>1?"s are":" is"} overdue</strong> — scheduled time has passed and not fully posted.</span></div>}
            {td>0 && <div className="alert alert-amber"><i className="ti ti-clock"></i><span><strong>{td} post{td>1?"s":""} due today</strong> — keep an eye on these.</span></div>}
            {!ov&&!td && <div className="alert alert-green"><i className="ti ti-circle-check"></i><span>All clear — no overdue or pending posts for today.</span></div>}
            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-num" style={{color:"#DC2626"}}>{ov}</div><div className="stat-label">Overdue</div></div>
              <div className="stat-card"><div className="stat-num" style={{color:"#D97706"}}>{td}</div><div className="stat-label">Due today</div></div>
              <div className="stat-card"><div className="stat-num">{up}</div><div className="stat-label">Upcoming</div></div>
              <div className="stat-card"><div className="stat-num" style={{color:"#16A34A"}}>{dn}</div><div className="stat-label">Posted</div></div>
            </div>
            <div className="filter-row">
              <select value={pmFilterClient} onChange={e=>setPmFilterClient(e.target.value)}>
                <option value="">All clients</option>
                {clientNames.map(n=><option key={n}>{n}</option>)}
              </select>
              <select value={pmFilterStatus} onChange={e=>setPmFilterStatus(e.target.value)}>
                <option value="">All posts</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due today</option>
                <option value="upcoming">Upcoming</option>
                <option value="done">All posted</option>
              </select>
              <input type="date" value={globalDateFrom} onChange={e=>setGlobalDateFrom(e.target.value)}
                style={{padding:"5px 8px",fontSize:12,border:"1px solid #ddd",borderRadius:7,background:"#fff",color:"#1a1a1a"}} title="From date"/>
              <span style={{fontSize:12,color:"#888",alignSelf:"center"}}>→</span>
              <input type="date" value={globalDateTo} onChange={e=>setGlobalDateTo(e.target.value)}
                style={{padding:"5px 8px",fontSize:12,border:"1px solid #ddd",borderRadius:7,background:"#fff",color:"#1a1a1a"}} title="To date"/>
              {(globalDateFrom||globalDateTo) && <button className="btn btn-sm" onClick={()=>{setGlobalDateFrom("");setGlobalDateTo("");}}>Clear</button>}
            </div>
            {loading ? <div className="loading"><span className="spinner"></span>Loading posts...</div> :
              groups.some(g=>g.items.length) ? groups.map(g=> g.items.length ? (
                <div key={g.key} className="group-wrap">
                  <div className={`group-head ${g.cls}`}>
                    <span className="group-pill">{g.label}</span>
                    <span className="group-count">{g.items.length} post{g.items.length>1?"s":""}</span>
                  </div>
                  {g.items.map(p=><PMPostCard key={p.id} p={p} onEdit={openEditModal} onDelete={confirmDeletePost}/>)}
                </div>
              ) : null) :
              <div className="empty"><i className="ti ti-calendar-off"></i>No posts match this filter.</div>
            }
          </div>
        )}

        {/* NEW POST */}
        {activeTab==="new" && (
          <div className="content" style={{position:"relative"}}><BodyBotanical/>
            <div className="section-title">Create new post</div>
            <div className="form-card">
              <div className="form-row">
                <div className="form-group"><label>Client</label>
                  <select value={fClient} onChange={e=>setFClient(e.target.value)}>
                    <option value="">Select client</option>
                    {clientNames.map(n=><option key={n}>{n}</option>)}
                  </select></div>
                <div className="form-group"><label>Content type</label>
                  <select value={fType} onChange={e=>setFType(e.target.value)}>
                    <option value="">Select type</option>
                    <option value="post">Post</option><option value="carousel">Carousel</option>
                    <option value="video">Video / Reel</option><option value="story">Story</option>
                  </select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Scheduled date</label><input type="date" value={fDate} onChange={e=>setFDate(e.target.value)}/></div>
                <div className="form-group"><label>Post time</label><input type="time" value={fTime} onChange={e=>setFTime(e.target.value)}/></div>
              </div>
              <div className="form-group"><label>Post title / reference</label><input type="text" value={fTitle} onChange={e=>setFTitle(e.target.value)} placeholder="e.g. May Week 3 — Product Launch"/></div>
              <div className="form-group"><label>Caption / copy</label><textarea value={fCaption} onChange={e=>setFCaption(e.target.value)} placeholder="Paste the full caption here..."></textarea></div>
              <div className="form-group"><label>Asset / drive link</label><input type="text" value={fAsset} onChange={e=>setFAsset(e.target.value)} placeholder="https://drive.google.com/..."/></div>
              <div className="form-group">
                <label>Platforms <span style={{fontWeight:400,color:"#888"}}>(auto-filled from client · click to toggle)</span></label>
                <div className="plat-grid">
                  {getActivePlats(fClient,fType).length===0
                    ? <span className="plat-hint">Select client and content type first</span>
                    : getActivePlats(fClient,fType).map(p=>(
                      <div key={p} className={`plat-badge ${selPlats.includes(p)?"on":""}`}
                        onClick={()=>togglePlat(p,selPlats,setSelPlats)}>
                        <i className={`ti ${PI[p]||"ti-device-mobile"}`}></i>{p}
                      </div>
                    ))}
                </div>
              </div>
              <div className="form-group"><label>Remarks for posting team</label><input type="text" value={fRemarks} onChange={e=>setFRemarks(e.target.value)} placeholder="e.g. Post at 9am sharp, tag @client"/></div>
              <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
                <button className="btn btn-primary" onClick={createPost} disabled={createLoading}>
                  {createLoading ? <><span className="spinner"></span> Saving...</> : <><i className="ti ti-plus"></i> Add to calendar</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {activeTab==="clients" && (
          <div className="content">
            {clientSuccess && <div className="success-banner" style={{display:"block"}}>{clientSuccess}</div>}
            <div className="section-title">Add new client</div>
            <div className="form-card" style={{marginBottom:"1.5rem"}}>
              <div className="form-group" style={{marginBottom:10}}>
                <label>Client name</label>
                <input type="text" value={newClientName} onChange={e=>setNewClientName(e.target.value)} placeholder="e.g. Meraki Agency"/>
              </div>
              <div className="form-group" style={{marginBottom:12}}>
                <label>Platforms</label>
                <div className="plat-check-grid">
                  {ALL_PLATS.map(p=>(
                    <div key={p} className={`plat-check ${newClientPlats.includes(p)?"on":""}`}
                      onClick={()=>togglePlat(p,newClientPlats,setNewClientPlats)}>
                      <i className={`ti ${PI[p]||"ti-device-mobile"}`}></i> {p}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <button className="btn btn-primary btn-sm" onClick={addClient}><i className="ti ti-plus"></i> Add client</button>
              </div>
            </div>
            <div className="section-title">Existing clients</div>
            {clientNames.length===0 ? <div className="empty"><i className="ti ti-users"></i>No clients yet.</div> :
              clientNames.map(name=>{
                const plats = clients[name]||[];
                if(editingClient===name) return (
                  <div key={name} className="edit-form">
                    <div className="form-group" style={{marginBottom:10}}>
                      <label>Client name</label>
                      <input type="text" value={editClientName} onChange={e=>setEditClientName(e.target.value)} style={{fontSize:14}}/>
                    </div>
                    <div className="form-group" style={{marginBottom:12}}>
                      <label>Platforms</label>
                      <div className="plat-check-grid">
                        {ALL_PLATS.map(p=>(
                          <div key={p} className={`plat-check ${editClientPlats.includes(p)?"on":""}`}
                            onClick={()=>togglePlat(p,editClientPlats,setEditClientPlats)}>
                            <i className={`ti ${PI[p]||"ti-device-mobile"}`}></i> {p}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                      <button className="btn btn-sm" onClick={()=>setEditingClient(null)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={saveEditClient}><i className="ti ti-check"></i> Save</button>
                    </div>
                  </div>
                );
                return (
                  <div key={name} className="client-row">
                    <div className="client-row-name">{name}</div>
                    <div className="client-plats">{plats.map(p=><span key={p} className="client-plat-tag"><i className={`ti ${PI[p]||"ti-device-mobile"}`} style={{fontSize:11}}></i> {p}</span>)}</div>
                    <div className="client-actions">
                      <button className="btn btn-sm" onClick={()=>{setEditingClient(name);setEditClientName(name);setEditClientPlats([...plats]);}}><i className="ti ti-edit"></i> Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={()=>deleteClient(name)}><i className="ti ti-trash"></i></button>
                    </div>
                  </div>
                );
              })
            }
          </div>
        )}

        {/* SOW TAB */}
        {activeTab==="sow" && (
          <div className="content">
            {/* Header row */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem",flexWrap:"wrap",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <i className="ti ti-file-text" style={{fontSize:16,color:"#185FA5"}}></i>
                <span style={{fontWeight:500,fontSize:14}}>Scope of Work</span>
                {sowUnlocked
                  ? <span style={{fontSize:11,background:"#F0FDF4",color:"#166534",border:"0.5px solid #86EFAC",padding:"2px 10px",borderRadius:20,display:"flex",alignItems:"center",gap:4}}><i className="ti ti-lock-open" style={{fontSize:11}}></i>Edit mode</span>
                  : <span style={{fontSize:11,background:"#FFFBEB",color:"#92400E",border:"0.5px solid #FDE68A",padding:"2px 10px",borderRadius:20,display:"flex",alignItems:"center",gap:4}}><i className="ti ti-lock" style={{fontSize:11}}></i>Read only</span>}
              </div>
              {!sowUnlocked
                ? <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <input type="password" value={sowPin} onChange={e=>setSowPin(e.target.value)} placeholder="SOW PIN"
                      onKeyDown={e=>e.key==="Enter"&&tryUnlockSOW()}
                      style={{padding:"5px 9px",fontSize:12,border:"1px solid #ddd",borderRadius:7,width:110}}/>
                    <button className="btn btn-sm btn-primary" onClick={tryUnlockSOW}><i className="ti ti-lock-open"></i> Unlock</button>
                    {sowPinErr && <span style={{fontSize:11,color:"#DC2626"}}>{sowPinErr}</span>}
                  </div>
                : <div style={{display:"flex",gap:6}}>
                    <button className="btn btn-sm btn-primary" onClick={()=>{setSowAddMode(true);setSowEditRow({id:Date.now().toString(),clientName:"",serviceType:"",creativesRequired:"",priority:"B",status:"Active"});}}><i className="ti ti-plus"></i> Add client</button>
                    <button className="btn btn-sm" onClick={()=>setSowUnlocked(false)}><i className="ti ti-lock"></i> Lock</button>
                  </div>}
            </div>

            {/* Filters */}
            <div className="filter-row">
              <select value={sowFilterStatus} onChange={e=>setSowFilterStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <select value={sowFilterPriority} onChange={e=>setSowFilterPriority(e.target.value)}>
                <option value="">All priorities</option>
                {["A","B","C","D"].map(p=><option key={p} value={p}>Priority {p}</option>)}
              </select>
              <div style={{display:"flex",alignItems:"center",gap:6,flex:1,flexWrap:"wrap"}}>
                <span style={{fontSize:12,color:"#888",whiteSpace:"nowrap"}}>View month:</span>
                <input type="month" value={sowDateFrom} onChange={e=>setSowDateFrom(e.target.value)}
                  style={{padding:"5px 8px",fontSize:12,border:"1px solid #ddd",borderRadius:7,flex:1,minWidth:130,background:"#fff",color:"#1a1a1a"}}/>
                {sowDateFrom && <button className="btn btn-sm" onClick={()=>setSowDateFrom("")}>Clear</button>}
              </div>
            </div>

            {/* Summary stats */}
            {sowRows.length>0 && (()=>{
              const active = sowRows.filter(r=>r.status==="Active");
              const totalRequired = active.reduce((s,r)=>{const n=parseInt(r.creativesRequired);return s+(isNaN(n)?0:n);},0);
              const curMonth = sowDateFrom || new Date().toISOString().slice(0,7);
              // Build auto-count map: { clientName: count of fully-posted posts this month }
              const autoCountMap = {};
              posts.forEach(p => {
                const pm = p.date ? p.date.slice(0,7) : "";
                if(pm !== curMonth) return;
                const allPosted = p.platforms.length>0 && p.platforms.every(pl=>pl.posted);
                if(!allPosted) return;
                autoCountMap[p.client] = (autoCountMap[p.client]||0) + 1;
              });
              // Effective made = manual override if set, else auto-count
              const getEffective = (row) => row.tracker[curMonth] != null ? row.tracker[curMonth] : (autoCountMap[row.clientName]||0);
              const totalMade = active.reduce((s,r)=>s+getEffective(r),0);
              const pct = totalRequired>0?Math.round(totalMade/totalRequired*100):0;
              return (
                <div style={{display:"flex",gap:8,marginBottom:"1rem",flexWrap:"wrap",alignItems:"stretch"}}>
                  {[
                    {label:"Active clients",val:active.length,color:"#185FA5"},
                    {label:"Creatives required",val:totalRequired,color:"#1a1a1a"},
                    {label:`Posted (${curMonth})`,val:totalMade,color:totalMade>=totalRequired?"#16A34A":"#D97706"},
                    {label:"Completion",val:`${pct}%`,color:pct>=100?"#16A34A":pct>=50?"#D97706":"#DC2626"},
                  ].map(s=>(
                    <div key={s.label} style={{background:"#fff",border:"1px solid #e5e5e5",borderRadius:8,padding:"8px 14px",textAlign:"center",flex:"1 0 70px"}}>
                      <div style={{fontSize:20,fontWeight:600,color:s.color}}>{s.val}</div>
                      <div style={{fontSize:10,color:"#888",marginTop:1}}>{s.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Add form */}
            {sowAddMode && sowEditRow && (
              <SOWEditForm row={sowEditRow} setRow={setSowEditRow} onSave={saveSowRow} onCancel={()=>{setSowAddMode(false);setSowEditRow(null);}} saving={sowSaving} isNew={true}/>
            )}

            {/* Table */}
            {sowLoading ? <div className="loading"><span className="spinner"></span>Loading SOW...</div> : (()=>{
              const curMonth = sowDateFrom || new Date().toISOString().slice(0,7);
              // Auto-count: fully-posted posts this month per client
              const autoCountMap = {};
              posts.forEach(p => {
                const pm = p.date ? p.date.slice(0,7) : "";
                if(pm !== curMonth) return;
                const allPosted = p.platforms.length>0 && p.platforms.every(pl=>pl.posted);
                if(!allPosted) return;
                autoCountMap[p.client] = (autoCountMap[p.client]||0) + 1;
              });
              const getEffective = (row) => row.tracker[curMonth] != null ? row.tracker[curMonth] : (autoCountMap[row.clientName]||0);
              const filtered = sowRows.filter(r=>{
                if(sowFilterStatus && r.status!==sowFilterStatus) return false;
                if(sowFilterPriority && r.priority!==sowFilterPriority) return false;
                return true;
              });
              if(!filtered.length) return <div className="empty"><i className="ti ti-file-off"></i>No records match this filter.</div>;
              const totalReq = filtered.filter(r=>r.status==="Active").reduce((s,r)=>{const n=parseInt(r.creativesRequired);return s+(isNaN(n)?0:n);},0);
              const totalEff = filtered.filter(r=>r.status==="Active").reduce((s,r)=>s+getEffective(r),0);
              return (
                <div style={{background:"#fff",border:"1px solid #e5e5e5",borderRadius:12,overflow:"hidden"}}>
                  {/* Table header */}
                  <div style={{display:"grid",gridTemplateColumns:"2fr 2.5fr 1fr 1fr 1fr 1.6fr",gap:0,background:"#185FA5",padding:"8px 14px",alignItems:"center"}}>
                    {["Client Name","Service Type","Creatives Req.","Priority","Status",`Posted / Override — ${curMonth}`].map(h=>(
                      <div key={h} style={{fontSize:11,fontWeight:600,color:"#fff",letterSpacing:".02em"}}>{h}</div>
                    ))}
                  </div>
                  {/* Rows */}
                  {filtered.map((row,i)=>{
                    const isEditing = sowUnlocked && sowEditRow?.id===row.id && !sowAddMode;
                    if(isEditing) return (
                      <div key={row.id} style={{padding:"0",borderTop:"1px solid #e5e5e5"}}>
                        <SOWEditForm row={sowEditRow} setRow={setSowEditRow} onSave={saveSowRow} onCancel={()=>setSowEditRow(null)} saving={sowSaving} isNew={false}/>
                      </div>
                    );
                    return <SOWTableRow key={row.id} row={row} i={i} curMonth={curMonth} autoCount={autoCountMap[row.clientName]||0} sowUnlocked={sowUnlocked} onEdit={()=>setSowEditRow({...row})} onDelete={()=>deleteSowRow(row.id,row.clientName)} onSaveTracker={saveTrackerVal}/>;
                  })}
                  {/* Totals row */}
                  <div style={{display:"grid",gridTemplateColumns:"2fr 2.5fr 1fr 1fr 1fr 1.6fr",gap:0,padding:"9px 14px",background:"#FFF9C4",borderTop:"2px solid #D97706",alignItems:"center"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1a1a1a"}}>TOTALS</div>
                    <div></div>
                    <div style={{fontWeight:700,fontSize:13,color:"#1a1a1a"}}>{totalReq}</div>
                    <div></div><div></div>
                    <div style={{fontWeight:700,fontSize:13,color:"#1a1a1a"}}>
                      {totalEff}
                      <span style={{fontSize:10,color:"#888",fontWeight:400,marginLeft:4}}>posted</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* EDIT MODAL */}
        {editModal && editPost && (
          <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setEditModal(false)}>
            <div className="modal">
              <div className="modal-header">
                <h3><i className="ti ti-edit" style={{fontSize:15,verticalAlign:-2,marginRight:6}}></i>Edit post</h3>
                <button className="btn-close" onClick={()=>setEditModal(false)}><i className="ti ti-x"></i></button>
              </div>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>Client</label>
                    <select value={editPost.editClient} onChange={e=>setEditPost({...editPost,editClient:e.target.value})}>
                      <option value="">Select client</option>
                      {clientNames.map(n=><option key={n}>{n}</option>)}
                    </select></div>
                  <div className="form-group"><label>Content type</label>
                    <select value={editPost.editType} onChange={e=>setEditPost({...editPost,editType:e.target.value})}>
                      <option value="">Select type</option>
                      <option value="post">Post</option><option value="carousel">Carousel</option>
                      <option value="video">Video / Reel</option><option value="story">Story</option>
                    </select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Scheduled date</label><input type="date" value={editPost.editDate} onChange={e=>setEditPost({...editPost,editDate:e.target.value})}/></div>
                  <div className="form-group"><label>Post time</label><input type="time" value={editPost.editTime} onChange={e=>setEditPost({...editPost,editTime:e.target.value})}/></div>
                </div>
                <div className="form-group"><label>Post title / reference</label><input type="text" value={editPost.editTitle} onChange={e=>setEditPost({...editPost,editTitle:e.target.value})}/></div>
                <div className="form-group"><label>Caption / copy</label><textarea value={editPost.editCaption} onChange={e=>setEditPost({...editPost,editCaption:e.target.value})} style={{minHeight:100}}></textarea></div>
                <div className="form-group"><label>Asset / drive link</label><input type="text" value={editPost.editAsset} onChange={e=>setEditPost({...editPost,editAsset:e.target.value})}/></div>
                <div className="form-group">
                  <label>Platforms <span style={{fontWeight:400,color:"#888"}}>(click to toggle)</span></label>
                  <div className="plat-grid">
                    {(clients[editPost.editClient]||[]).map(pname=>{
                      const isPosted = editPost.platforms.find(pl=>pl.name===pname)?.posted;
                      const isOn = editSelPlats.includes(pname);
                      return (
                        <div key={pname} className={`plat-badge ${isOn?"on":""}`}
                          onClick={()=>!isPosted&&togglePlat(pname,editSelPlats,setEditSelPlats)}
                          style={isPosted?{opacity:.7,cursor:"default"}:{}}
                          title={isPosted?"Already posted — cannot remove":""}>
                          <i className={`ti ${PI[pname]||"ti-device-mobile"}`}></i>{pname}
                          {isPosted&&<span style={{fontSize:10,opacity:.7}}> (posted)</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{fontSize:12,color:"#888",marginTop:6}}><i className="ti ti-info-circle" style={{fontSize:12,verticalAlign:-1,marginRight:3}}></i>Platforms already marked as posted will stay posted even if removed here.</div>
                </div>
                <div className="form-group"><label>Remarks for posting team</label><input type="text" value={editPost.editRemarks} onChange={e=>setEditPost({...editPost,editRemarks:e.target.value})}/></div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-danger" onClick={()=>confirmDeletePost(editPost.id)}><i className="ti ti-trash"></i> Delete post</button>
                <div style={{display:"flex",gap:8}}>
                  <button className="btn" onClick={()=>setEditModal(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveEditPost} disabled={saveEditLoading}>
                    {saveEditLoading ? <><span className="spinner"></span> Saving...</> : <><i className="ti ti-check"></i> Save changes</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Toast msg={toastMsg} show={toastShow}/>
      </>
    );
  }

  // POSTING TEAM
  if(role==="posting") {
    const total=posts.length, dn=posts.filter(p=>getStatus(p)==="done").length, rem=posts.filter(p=>getStatus(p)!=="done").length;
    const filtered = posts.filter(p=>
      (!postFilterClient||p.client===postFilterClient) &&
      (postFilterShow==="all"||getStatus(p)!=="done") &&
      (!globalDateFrom || p.date >= globalDateFrom) &&
      (!globalDateTo || p.date <= globalDateTo)
    );
    return (
      <>
        <Head><title>Posting Team – Postings</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css"/>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;600&family=Cormorant+Garamond:ital,wght@1,400&display=swap"/></Head>
        <style>{globalCSS}</style>
        <div className="topbar">
          <TopbarBotanical/>
          <div className="topbar-logo"><span className="lm">meraki</span><span className="la">ads</span></div>
          <div className="topbar-right">
            <button className="btn btn-sm" onClick={loadAll}><i className="ti ti-refresh"></i> Refresh</button>
            <button className="btn btn-sm" onClick={logout}><i className="ti ti-logout"></i> Sign out</button>
          </div>
        </div>
        <div className="content">
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-num">{total}</div><div className="stat-label">Total</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:"#16A34A"}}>{dn}</div><div className="stat-label">Posted</div></div>
            <div className="stat-card"><div className="stat-num" style={{color:"#D97706"}}>{rem}</div><div className="stat-label">Pending</div></div>
          </div>
          <div className="filter-row">
            <select value={postFilterClient} onChange={e=>setPostFilterClient(e.target.value)}>
              <option value="">All clients</option>
              {clientNames.map(n=><option key={n}>{n}</option>)}
            </select>
            <select value={postFilterShow} onChange={e=>setPostFilterShow(e.target.value)}>
              <option value="pending">Pending only</option>
              <option value="all">All posts</option>
            </select>
            <input type="date" value={globalDateFrom} onChange={e=>setGlobalDateFrom(e.target.value)}
              style={{padding:"5px 8px",fontSize:12,border:"1px solid #ddd",borderRadius:7,background:"#fff",color:"#1a1a1a"}} title="From date"/>
            <span style={{fontSize:12,color:"#888",alignSelf:"center"}}>→</span>
            <input type="date" value={globalDateTo} onChange={e=>setGlobalDateTo(e.target.value)}
              style={{padding:"5px 8px",fontSize:12,border:"1px solid #ddd",borderRadius:7,background:"#fff",color:"#1a1a1a"}} title="To date"/>
            {(globalDateFrom||globalDateTo) && <button className="btn btn-sm" onClick={()=>{setGlobalDateFrom("");setGlobalDateTo("");}}>Clear</button>}
          </div>
          {loading ? <div className="loading"><span className="spinner"></span>Loading posts...</div> :
            filtered.length ? filtered.map(p=><PostingCard key={p.id} p={p} onMark={markPlatform}/>) :
            <div className="empty"><i className="ti ti-circle-check"></i>All caught up! Nothing pending.</div>
          }
        </div>
        <Toast msg={toastMsg} show={toastShow}/>
      </>
    );
  }
}

// ── SUBCOMPONENTS ─────────────────────────────────────────────
function PMPostCard({p, onEdit, onDelete}) {
  const s=getStatus(p), u=getUrgency(p);
  const isOv=u==="overdue"&&s!=="done", isTd=u==="today"&&s!=="done";
  return (
    <div className={`post-card ${isOv?"overdue":isTd?"today":""}`}>
      <div className="post-card-header">
        <div style={{flex:1,minWidth:0}}>
          <div className="post-card-title">{p.title}</div>
          <div className="post-card-meta">
            <span>{p.client}</span><span>·</span><span>{typeLabel(p.type)}</span><span>·</span>
            <span><i className="ti ti-calendar" style={{fontSize:12,verticalAlign:-1}}></i> {fmtDate(p.date)}</span>
            {p.time&&<><span>·</span><span><i className="ti ti-clock" style={{fontSize:12,verticalAlign:-1}}></i> {fmtTime(p.time)}</span></>}
            {p.createdBy&&<><span>·</span><span style={{color:"#aaa"}}>by {p.createdBy}</span></>}
          </div>
        </div>
        {isOv ? <span className="badge badge-overdue"><i className="ti ti-alert-circle" style={{fontSize:11}}></i>Overdue</span>
          : s==="done" ? <span className="badge badge-done"><i className="ti ti-check" style={{fontSize:11}}></i>All posted</span>
          : s==="partial" ? <span className="badge badge-partial">Partially posted</span>
          : <span className="badge badge-pending">Pending</span>}
      </div>
      <div className="pm-detail-grid">
        {p.caption&&<div className="pm-detail-block pm-detail-full"><div className="pm-detail-label">Caption</div><div className="pm-detail-val pm-caption-val">{p.caption}</div></div>}
        {p.asset&&<div className="pm-detail-block pm-detail-full"><div className="pm-detail-label">Asset link</div><div className="pm-detail-val"><a href={p.asset} target="_blank" rel="noreferrer" style={{color:"#185FA5",wordBreak:"break-all"}}>{p.asset}</a></div></div>}
        {p.remarks&&<div className="pm-detail-block pm-detail-full pm-remarks-block"><i className="ti ti-alert-triangle" style={{fontSize:14,color:"#D97706",flexShrink:0,marginTop:1}}></i><div><div className="pm-detail-label">Remarks</div><div className="pm-detail-val">{p.remarks}</div></div></div>}
      </div>
      <div style={{marginTop:10}}>
        <div className="pm-detail-label" style={{marginBottom:6}}>Platform status</div>
        {p.platforms.map(pl=>{
        const [atTime, ssRef] = pl.postedAt ? pl.postedAt.split(" | ") : ["",""];
        const hasScreenshot = ssRef && ssRef.startsWith("ss:");
        const [,ssPostId,ssPlatform] = hasScreenshot ? ssRef.split(":") : [];
        return (
        <div key={pl.name} className={`pm-plat-row ${pl.posted?"pm-plat-posted":"pm-plat-pending"}`}>
          <div style={{display:"flex",alignItems:"center",gap:7,flex:1}}>
            <i className={`ti ${PI[pl.name]||"ti-device-mobile"}`} style={{fontSize:15}}></i>
            <span style={{fontSize:13,fontWeight:500}}>{pl.name}</span>
          </div>
          {pl.posted
            ? <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span className="pm-posted-tag"><i className="ti ti-check" style={{fontSize:11}}></i> Posted by {pl.postedBy}</span>
                {atTime&&<span style={{fontSize:11,color:"#888"}}>{atTime}</span>}
                {hasScreenshot&&<a href={`/api/screenshot?postId=${ssPostId}&platform=${encodeURIComponent(ssPlatform)}`} target="_blank" rel="noreferrer"
                  style={{fontSize:11,color:"#185FA5",display:"flex",alignItems:"center",gap:3,padding:"2px 8px",border:"1px solid #BFDBFE",borderRadius:6,background:"#EBF4FF"}}>
                  <i className="ti ti-photo" style={{fontSize:12}}></i>Screenshot
                </a>}
              </div>
            : <span className="pm-pending-tag">Not posted yet</span>}
        </div>
        );
      })}
      </div>
      <div className="post-card-actions">
        <button className="btn btn-sm" onClick={()=>onEdit(p.id)}><i className="ti ti-edit"></i> Edit post</button>
        <button className="btn btn-sm btn-danger" onClick={()=>onDelete(p.id)}><i className="ti ti-trash"></i> Delete</button>
      </div>
    </div>
  );
}

function PlatformRow({pl, i, p, names, onMark}) {
  const [ssFile, setSsFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pasting, setPasting] = useState(false);
  const pasteZoneRef = useRef(null);

  function handleFile(file) {
    if(!file || !file.type.startsWith("image/")) return;
    setSsFile(file);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(file);
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if(!items) return;
    for(const item of items) {
      if(item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if(file) { handleFile(file); break; }
      }
    }
  }

  function clearSS() { setSsFile(null); setPreview(null); }

  const [atTime, ssRef] = pl.postedAt ? pl.postedAt.split(" | ") : ["",""];
  const hasScreenshot = ssRef && ssRef.startsWith("ss:");
  const [,ssPostId,ssPlatform] = hasScreenshot ? ssRef.split(":") : [];

  return (
    <div className={`check-row ${pl.posted?"done-row":""}`} style={{flexWrap:"wrap",alignItems:"flex-start",paddingBottom:ssFile&&preview?10:undefined}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0,paddingTop:pl.posted?0:2}}>
        <input type="checkbox" checked={pl.posted} disabled={pl.posted}
          onChange={e=>e.target.checked&&onMark(p.id,pl.name,i,true,names[p.id]||"",p.client,ssFile)}
          style={{width:16,height:16,flexShrink:0,accentColor:"#16A34A"}}/>
        <i className={`ti ${PI[pl.name]||"ti-device-mobile"}`} style={{fontSize:16}}></i>
        <span style={{fontSize:14}}>{pl.name}</span>
      </div>
      {pl.posted
        ? <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
            <span className="posted-by-tag"><i className="ti ti-check" style={{fontSize:12}}></i>{pl.postedBy}</span>
            {hasScreenshot && <a href={`/api/screenshot?postId=${ssPostId}&platform=${encodeURIComponent(ssPlatform)}`} target="_blank" rel="noreferrer"
              style={{fontSize:11,color:"#185FA5",display:"flex",alignItems:"center",gap:3,padding:"2px 8px",border:"1px solid #BFDBFE",borderRadius:6,background:"#EBF4FF"}}>
              <i className="ti ti-photo" style={{fontSize:12}}></i>SS
            </a>}
          </div>
        : <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <label style={{cursor:"pointer",fontSize:11,color:"#185FA5",display:"flex",alignItems:"center",gap:3,padding:"3px 8px",border:"1px solid #BFDBFE",borderRadius:6,background:"#EBF4FF"}}>
                <i className="ti ti-upload" style={{fontSize:12}}></i>Upload
                <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
              </label>
              <div ref={pasteZoneRef} tabIndex={0} onPaste={handlePaste}
                onFocus={()=>setPasting(true)} onBlur={()=>setPasting(false)}
                style={{fontSize:11,padding:"3px 8px",border:`1px solid ${pasting?"#185FA5":"#ddd"}`,borderRadius:6,
                  background:pasting?"#EBF4FF":"#f9f9f9",color:pasting?"#185FA5":"#888",cursor:"pointer",
                  display:"flex",alignItems:"center",gap:3,outline:"none"}}
                title="Click here, then Ctrl+V to paste screenshot">
                <i className="ti ti-clipboard" style={{fontSize:12}}></i>
                {pasting?"Paste now (Ctrl+V)":"Click → Paste"}
              </div>
              {ssFile && <button onClick={clearSS}
                style={{background:"none",border:"none",cursor:"pointer",color:"#DC2626",fontSize:13,padding:0,lineHeight:1}}
                title="Remove screenshot"><i className="ti ti-x"></i></button>}
            </div>
            {preview && (
              <div style={{marginTop:2}}>
                <img src={preview} alt="screenshot preview"
                  style={{height:60,width:"auto",maxWidth:130,borderRadius:6,border:"1px solid #e5e5e5",objectFit:"cover",display:"block"}}/>
                <div style={{fontSize:10,color:"#16A34A",marginTop:2,display:"flex",alignItems:"center",gap:3}}>
                  <i className="ti ti-circle-check" style={{fontSize:11}}></i>Ready to upload
                </div>
              </div>
            )}
          </div>}
    </div>
  );
}

function PostingCard({p, onMark}) {
  const s=getStatus(p);
  const [names, setNames] = useState({});

  return (
    <div className="post-card">
      <div className="post-card-header" style={{marginBottom:10}}>
        <div><div className="post-card-title">{p.title}</div><div className="post-card-meta">{p.client} · {typeLabel(p.type)}</div></div>
        <span className={`badge ${s==="done"?"badge-done":s==="partial"?"badge-partial":"badge-pending"}`}>
          {s==="done"?"All posted":s==="partial"?"Partially posted":"Pending"}
        </span>
      </div>
      <div className="info-grid">
        <div className="info-block"><div className="info-block-label">Date</div><div className="info-block-val">{fmtDate(p.date)}</div></div>
        <div className="info-block"><div className="info-block-label">Post time</div><div className="info-block-val">{p.time?fmtTime(p.time):"—"}</div></div>
      </div>
      {p.caption&&<div className="caption-box"><div className="caption-label">Caption</div><div className="caption-val">{p.caption}</div></div>}
      {p.asset&&<a href={p.asset} className="asset-btn" target="_blank" rel="noreferrer"><i className="ti ti-link" style={{fontSize:15}}></i>View asset / file</a>}
      {p.remarks&&<div className="remarks-box"><i className="ti ti-alert-triangle"></i><div className="remarks-txt">{p.remarks}</div></div>}
      <div className="divider"></div>
      <div className="sub-label">Mark as posted</div>
      {p.platforms.map((pl,i)=>(
        <PlatformRow key={pl.name} pl={pl} i={i} p={p} names={names} onMark={onMark}/>
      ))}
      {s!=="done"&&(
        <div className="name-row">
          <label>Your name:</label>
          <input type="text" value={names[p.id]||""} onChange={e=>setNames({...names,[p.id]:e.target.value})} placeholder="Enter your name before checking off"/>
        </div>
      )}
    </div>
  );
}

const priStyle = {
  A:{background:"#DCFCE7",color:"#166534"},
  B:{background:"#BFDBFE",color:"#1E40AF"},
  C:{background:"#FEF9C3",color:"#854D0E"},
  D:{background:"#FCE7F3",color:"#9D174D"},
};

function SOWTableRow({row, i, curMonth, autoCount, sowUnlocked, onEdit, onDelete, onSaveTracker}) {
  const [trackerEditing, setTrackerEditing] = useState(false);
  // null tracker means "not overridden — use auto"
  const manualOverride = (row.tracker[curMonth] != null) ? row.tracker[curMonth] : null;
  const effective = manualOverride != null ? manualOverride : autoCount;
  const [trackerVal, setTrackerVal] = useState(String(effective));
  const req = parseInt(row.creativesRequired);
  const hasTarget = !isNaN(req) && req>0;
  const over = hasTarget && effective>=req;

  return (
    <div style={{display:"grid",gridTemplateColumns:"2fr 2.5fr 1fr 1fr 1fr 1.6fr",gap:0,padding:"9px 14px",alignItems:"center",borderTop:i===0?"none":"1px solid #f0f0f0",background:i%2===0?"#fff":"#fafafa"}}>
      <div style={{fontWeight:500,fontSize:13,color:"#1a1a1a"}}>{row.clientName}</div>
      <div style={{fontSize:12,color:"#555"}}>{row.serviceType}</div>
      <div style={{fontSize:13,fontWeight:600,color:"#1a1a1a"}}>{row.creativesRequired}</div>
      <div><span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,...(priStyle[row.priority]||priStyle.D)}}>{row.priority}</span></div>
      <div><span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:row.status==="Active"?"#F0FDF4":"#f5f5f5",color:row.status==="Active"?"#166534":"#888"}}>{row.status}</span></div>
      <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
        {trackerEditing
          ? <>
              <input type="number" value={trackerVal} onChange={e=>setTrackerVal(e.target.value)} min="0"
                style={{width:48,padding:"3px 6px",fontSize:12,border:"1px solid #185FA5",borderRadius:6,background:"#EBF4FF",color:"#0C447C"}}
                autoFocus
                onKeyDown={async e=>{if(e.key==="Enter"){await onSaveTracker(row.id,curMonth,parseInt(trackerVal)||0);setTrackerEditing(false);}if(e.key==="Escape")setTrackerEditing(false);}}/>
              <button className="btn btn-sm btn-primary" style={{padding:"3px 7px",fontSize:11}} onClick={async()=>{await onSaveTracker(row.id,curMonth,parseInt(trackerVal)||0);setTrackerEditing(false);}}>✓</button>
              <button className="btn btn-sm" style={{padding:"3px 7px",fontSize:11}} onClick={()=>setTrackerEditing(false)}>✕</button>
            </>
          : <>
              {/* Auto-count pill — blue, always visible */}
              <span title="Auto: fully posted posts this month" style={{display:"inline-flex",alignItems:"center",gap:2,fontSize:11,padding:"2px 7px",borderRadius:20,background:"#EBF4FF",color:"#185FA5",fontWeight:600,border:"1px solid #BFDBFE",whiteSpace:"nowrap"}}>
                <i className="ti ti-refresh" style={{fontSize:10}}></i>{autoCount}
              </span>
              {/* Manual override pill — amber, only if set */}
              {manualOverride != null && (
                <span title="Manual override (overrides auto)" style={{display:"inline-flex",alignItems:"center",gap:2,fontSize:11,padding:"2px 7px",borderRadius:20,background:"#FEF9C3",color:"#92400E",fontWeight:600,border:"1px solid #FDE68A",whiteSpace:"nowrap"}}>
                  <i className="ti ti-pencil" style={{fontSize:10}}></i>{manualOverride}
                  <button onClick={async()=>{await onSaveTracker(row.id,curMonth,null);}} title="Clear override — revert to auto" style={{background:"none",border:"none",cursor:"pointer",color:"#92400E",padding:"0 0 0 2px",lineHeight:1,fontSize:11}}>✕</button>
                </span>
              )}
              {/* Progress bar */}
              {hasTarget && <div style={{flex:1,height:4,background:"#f0f0f0",borderRadius:4,overflow:"hidden",minWidth:20}}>
                <div style={{height:"100%",width:`${Math.min(100,Math.round(effective/req*100))}%`,background:over?"#16A34A":effective>0?"#D97706":"#e5e5e5",borderRadius:4}}></div>
              </div>}
              {hasTarget && <span style={{fontSize:10,color:"#aaa"}}>/{req}</span>}
              {/* Set override button */}
              <button onClick={()=>{setTrackerVal(String(effective));setTrackerEditing(true);}} style={{background:"none",border:"none",cursor:"pointer",color:"#aaa",padding:0,lineHeight:1}} title="Set manual override"><i className="ti ti-edit" style={{fontSize:11}}></i></button>
              {sowUnlocked && <>
                <button className="btn btn-sm" style={{padding:"3px 7px",fontSize:11}} onClick={onEdit}><i className="ti ti-settings" style={{fontSize:10}}></i></button>
                <button className="btn btn-sm btn-danger" style={{padding:"3px 7px",fontSize:11}} onClick={onDelete}><i className="ti ti-trash" style={{fontSize:10}}></i></button>
              </>}
            </>}
      </div>
    </div>
  );
}

function SOWEditForm({row, setRow, onSave, onCancel, saving, isNew}) {
  const f = (field) => ({value:row[field]||"",onChange:e=>setRow({...row,[field]:e.target.value})});
  return (
    <div style={{background:"#EBF4FF",border:"1px solid #185FA5",borderRadius:10,padding:"14px",margin:"4px 0 8px"}}>
      <div style={{fontWeight:500,fontSize:12,marginBottom:10,color:"#185FA5",display:"flex",alignItems:"center",gap:6}}>
        <i className="ti ti-edit" style={{fontSize:12}}></i>{isNew?"Add new SOW entry":"Editing entry"}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        <div className="form-group" style={{marginBottom:0}}><label>Client name</label><input type="text" {...f("clientName")}/></div>
        <div className="form-group" style={{marginBottom:0}}><label>Service type</label><input type="text" {...f("serviceType")}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:8}}>
        <div className="form-group" style={{marginBottom:0}}><label>Creatives req.</label><input type="text" {...f("creativesRequired")}/></div>
        <div className="form-group" style={{marginBottom:0}}><label>Priority</label>
          <select {...f("priority")}>{["A","B","C","D"].map(p=><option key={p}>{p}</option>)}</select></div>
        <div className="form-group" style={{marginBottom:0}}><label>Status</label>
          <select {...f("status")}><option>Active</option><option>Inactive</option></select></div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
        <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-sm btn-primary" onClick={()=>onSave(row)} disabled={saving}>
          {saving?<><span className="spinner"></span> Saving...</>:<><i className="ti ti-check"></i> {isNew?"Add entry":"Save"}</>}
        </button>
      </div>
    </div>
  );
}

function Toast({msg, show}) {
  return <div className="toast" style={{display:show?"block":"none"}}>{msg}</div
// ── BOTANICAL SVG COMPONENTS ────────────────────────────────
function TopbarBotanical() {
  return (
    <svg className="topbar-botanical" viewBox="0 0 800 54" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="0" x2="800" y2="0" stroke="#7DC242" strokeWidth="2.5" opacity="0.7"/>
      <path d="M -2 54 Q 10 36 32 28 Q 30 46 -2 54 Z" fill="#C5E89A" opacity="0.5"/>
      <path d="M -2 54 Q 22 38 32 28" stroke="#7DC242" strokeWidth="0.8" fill="none" opacity="0.45"/>
      <path d="M 14 54 Q 24 36 44 28 Q 38 46 14 54 Z" fill="#97C459" opacity="0.38"/>
      <path d="M -4 46 Q 16 30 40 24 Q 34 42 -4 46 Z" fill="#C0DD97" opacity="0.3"/>
      <path d="M 28 56 Q 28 36 30 22" stroke="#639922" strokeWidth="1" fill="none" opacity="0.38" strokeLinecap="round"/>
      <circle cx="30" cy="18" r="4" fill="#29ABE2" opacity="0.4"/>
      <circle cx="30" cy="18" r="2.5" fill="#7DC242" opacity="0.55"/>
      <ellipse cx="24" cy="13" rx="4" ry="2.5" fill="#A8DCF0" opacity="0.45" transform="rotate(-30 24 13)"/>
      <ellipse cx="36" cy="13" rx="4" ry="2.5" fill="#A8DCF0" opacity="0.45" transform="rotate(30 36 13)"/>
      <path d="M 802 0 Q 790 20 766 28 Q 764 10 802 0 Z" fill="#C5E89A" opacity="0.5"/>
      <path d="M 802 0 Q 778 22 766 28" stroke="#7DC242" strokeWidth="0.8" fill="none" opacity="0.45"/>
      <path d="M 786 0 Q 764 18 754 28 Q 756 10 786 0 Z" fill="#97C459" opacity="0.38"/>
      <path d="M 804 8 Q 782 26 762 30 Q 766 14 804 8 Z" fill="#C0DD97" opacity="0.3"/>
      <path d="M 770 -2 Q 770 20 768 34" stroke="#639922" strokeWidth="1" fill="none" opacity="0.38" strokeLinecap="round"/>
      <circle cx="768" cy="38" r="4" fill="#FAC775" opacity="0.5"/>
      <circle cx="768" cy="38" r="2.5" fill="#EF9F27" opacity="0.55"/>
      <ellipse cx="762" cy="33" rx="4" ry="2.5" fill="#FAC775" opacity="0.45" transform="rotate(-30 762 33)"/>
      <ellipse cx="774" cy="33" rx="4" ry="2.5" fill="#FAC775" opacity="0.45" transform="rotate(30 774 33)"/>
    </svg>
  );
}

function BodyBotanical() {
  return (
    <>
      <svg style={{position:"absolute",top:0,right:0,width:"200px",height:"100%",pointerEvents:"none",zIndex:0}} viewBox="0 0 200 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMid meet">
        <path d="M 160 0 Q 178 38 152 72 Q 134 38 160 0 Z" fill="#C5E89A" opacity="0.32"/>
        <path d="M 160 0 Q 140 38 152 72" stroke="#7DC242" strokeWidth="0.8" fill="none" opacity="0.28"/>
        <path d="M 182 8 Q 196 50 168 82 Q 148 50 182 8 Z" fill="#97C459" opacity="0.22"/>
        <path d="M 142 16 Q 160 58 156 98 Q 136 58 142 16 Z" fill="#C0DD97" opacity="0.26"/>
        <path d="M 156 -2 Q 155 46 153 100" stroke="#639922" strokeWidth="1.2" fill="none" opacity="0.3" strokeLinecap="round"/>
        <circle cx="153" cy="106" r="5.5" fill="#FAC775" opacity="0.48"/>
        <circle cx="153" cy="106" r="3" fill="#EF9F27" opacity="0.52"/>
        <ellipse cx="146" cy="100" rx="5.5" ry="3" fill="#FAC775" opacity="0.42" transform="rotate(-35 146 100)"/>
        <ellipse cx="160" cy="100" rx="5.5" ry="3" fill="#FAC775" opacity="0.42" transform="rotate(35 160 100)"/>
        <path d="M 175 210 Q 194 244 168 274 Q 150 244 175 210 Z" fill="#C5E89A" opacity="0.26"/>
        <path d="M 175 210 Q 155 244 168 274" stroke="#7DC242" strokeWidth="0.8" fill="none" opacity="0.24"/>
        <path d="M 190 220 Q 205 258 182 284 Q 162 258 190 220 Z" fill="#97C459" opacity="0.18"/>
        <path d="M 178 200 Q 176 244 172 282" stroke="#639922" strokeWidth="1" fill="none" opacity="0.26" strokeLinecap="round"/>
        <circle cx="172" cy="288" r="5" fill="#29ABE2" opacity="0.38"/>
        <circle cx="172" cy="288" r="3" fill="#7DC242" opacity="0.48"/>
        <ellipse cx="166" cy="282" rx="5" ry="3" fill="#A8DCF0" opacity="0.36" transform="rotate(-30 166 282)"/>
        <ellipse cx="178" cy="282" rx="5" ry="3" fill="#A8DCF0" opacity="0.36" transform="rotate(30 178 282)"/>
        <path d="M 165 400 Q 186 432 160 462 Q 142 432 165 400 Z" fill="#C5E89A" opacity="0.28"/>
        <path d="M 182 410 Q 198 444 175 470 Q 156 444 182 410 Z" fill="#97C459" opacity="0.2"/>
        <path d="M 148 416 Q 166 450 163 482 Q 144 450 148 416 Z" fill="#C0DD97" opacity="0.24"/>
        <path d="M 164 390 Q 162 430 160 472" stroke="#639922" strokeWidth="1" fill="none" opacity="0.26" strokeLinecap="round"/>
        <circle cx="160" cy="478" r="5" fill="#FAC775" opacity="0.44"/>
        <circle cx="160" cy="478" r="3" fill="#EF9F27" opacity="0.5"/>
        <circle cx="120" cy="155" r="2" fill="#7DC242" opacity="0.18"/>
        <circle cx="188" cy="175" r="1.5" fill="#29ABE2" opacity="0.16"/>
        <circle cx="135" cy="330" r="2" fill="#97C459" opacity="0.18"/>
        <circle cx="192" cy="360" r="1.5" fill="#FAC775" opacity="0.2"/>
        <circle cx="112" cy="460" r="2" fill="#29ABE2" opacity="0.16"/>
      </svg>
      <svg style={{position:"absolute",bottom:0,left:0,width:"80px",height:"160px",pointerEvents:"none",zIndex:0}} viewBox="0 0 80 160" xmlns="http://www.w3.org/2000/svg">
        <path d="M -2 160 Q 8 134 28 122 Q 26 142 -2 160 Z" fill="#C5E89A" opacity="0.3"/>
        <path d="M -2 150 Q 14 128 34 120 Q 28 140 -2 150 Z" fill="#97C459" opacity="0.22"/>
        <path d="M 12 160 Q 22 134 38 124 Q 32 144 12 160 Z" fill="#C0DD97" opacity="0.25"/>
        <path d="M 20 162 Q 22 138 24 118" stroke="#639922" strokeWidth="1" fill="none" opacity="0.28" strokeLinecap="round"/>
        <circle cx="24" cy="114" r="4" fill="#29ABE2" opacity="0.34"/>
        <circle cx="24" cy="114" r="2.5" fill="#7DC242" opacity="0.44"/>
      </svg>
    </>
  );
}

// ── QUOTE CARD ───────────────────────────────────────────────
const QUOTES_365 = ["Make noise until the world can't scroll past you.","Every pixel is a promise to your audience.","Stories that sell. Brands that stay.","Be so good they can't unfollow you.","The feed is your canvas. Paint it boldly.","Great marketing doesn't interrupt — it inspires.","Your brand is what people say when you're not in the room.","Content is the fire. Distribution is the oxygen.","Don't just post. Make people feel something.","Consistency is the new creativity.","Small brands. Big ideas. Infinite impact.","The algorithm rewards those who show up every day.","Build brands people believe in.","A scroll stopped is a story started.","Marketing is no longer about the stuff you make, but the stories you tell.","Make it simple. Make it memorable. Make it matter.","The best campaigns feel like conversations.","Design speaks before words can.","Earn attention. Don't beg for it.","Be the brand that shows up when it counts.","Ideas are currency. Spend them wisely.","One great post can open a thousand doors.","Your audience doesn't want ads. Give them art.","The right message, the right person, the right time — that's magic.","Trust is built one post at a time.","Creativity without strategy is just art. Together, it's magic.","Brands that listen grow faster than those that shout.","Make the logo bigger? Make the idea bigger.","Every campaign is a chance to change someone's mind.","The best ROI is a story worth sharing.","Show up. Stand out. Scale up.","Your next client is already scrolling. Be ready.","Authenticity is the only strategy that never goes out of style.","Good content answers questions. Great content asks better ones.","Data tells you what happened. Creativity shapes what happens next.","A strong brand is the most valuable real estate in business.","Work hard in silence. Let results make the noise.","Every post is a handshake with your future customer.","Trends fade. Voice endures.","The most powerful marketing is a customer who talks about you.","Stop chasing virality. Start building loyalty.","Think big. Target smart. Create boldly.","The brands winning today are the ones that feel human.","Capture attention. Earn trust. Deliver value.","What you post today builds what you become tomorrow.","Be the content your audience looks forward to.","Every brand has a story. Make yours worth reading.","Strategy without creativity is a map without a destination.","The goal isn't more followers. It's deeper connection.","Bold ideas, backed by data — that's the formula.","Less noise. More signal.","Your next breakthrough is one great idea away.","Campaigns come and go. Culture stays forever.","Post with purpose. Measure with precision.","Creativity is intelligence having fun.","The best brands don't sell products. They sell belonging.","Marketing is empathy at scale.","Don't find customers for your products. Find products for your customers.","A great headline is worth a thousand images.","Your audience is the algorithm. Please them first.","The difference between good and great is one more revision.","Make people feel seen. That's your superpower.","Behind every click is a human being. Remember that.","Campaigns are tactics. Brand is character.","Silence your doubts louder than your competition.","Turn browsers into believers.","The reel stops. The feeling stays.","Obsess over the audience, not the algorithm.","A brand without a story is just a logo.","Clarity converts. Complexity confuses.","Make something you'd be proud to show your clients.","Surprise your audience before the competition does.","Move fast, but never lose your voice.","The brief is the beginning. The idea is the breakthrough.","Every comment is a conversation waiting to happen.","Results speak. But stories echo.","Think like a publisher. Act like a marketer.","Great work is its own distribution.","Start with why. End with wow.","There's no traffic jam on the extra mile.","Put your message in places your audience already loves.","Attention is earned, not bought.","One insight can rewrite an entire strategy.","The detail you almost skipped is the one they'll remember.","Be consistent enough that people expect you. Surprising enough that they look.","Your brand voice is your competitive advantage.","Every brand that ever changed the world started with one idea.","If your content disappeared tomorrow, would anyone miss it?","Earn every scroll. Deserve every click.","The best brief is a deep understanding of your audience.","Originality is the rarest currency in marketing.","Community is the new campaign.","Speak to one person. Reach thousands.","Play the long game. Build something that lasts.","Your tone is your brand. Guard it fiercely.","Make the work so good it makes people stop mid-scroll.","Be so consistent they quote you without tagging you.","Market like the person you're talking to matters. Because they do.","Boldness is a strategy.","The best creative teams argue loudly and execute beautifully.","The most dangerous place in marketing is your comfort zone.","Brands don't die from competition. They die from irrelevance.","Design is not decoration. It is communication.","Say something. Mean something. Change something.","Your passion is your most persuasive pitch.","No brief is too small when the idea is big enough.","The team that plays together, wins together.","Measure twice. Post once. Optimize always.","Grow with your clients. Win with your clients.","The inbox is a privilege. Earn it.","Build brands that make people proud to buy.","A good strategy feels inevitable in hindsight.","Your next great idea is already inside the data.","Take risks in the work. Take care of the client.","The best creatives never stop being curious.","Deadlines are just creative speed boosts.","Ideas that scare you a little are usually the best ones.","What gets measured gets improved. What gets improved gets results.","Every brand touchpoint is a chance to delight.","Your audience remembers how you made them feel.","The work is never finished. It's only due.","Think globally. Connect locally.","The agencies that last are the ones that keep learning.","Your greatest case study is the one you're working on right now.","Don't just meet expectations. Exceed them every time.","A fresh perspective is worth a hundred extra hours.","Run campaigns. Build legacies.","Every revision makes it better. Every no makes you stronger.","Make your process as beautiful as your output.","The best clients trust you. Earn that trust daily.","Create content that outlives the campaign.","Pixels, purpose, and persistence — that's the formula.","Be the agency your clients brag about.","Momentum is built one brilliant post at a time.","The market rewards those who take creative risks.","Stay hungry. Stay creative. Stay meraki.","A brand is a promise kept consistently.","Today's effort is tomorrow's result.","Simplicity is the ultimate sophistication in advertising.","Chase excellence. Success will follow.","Don't advertise at people. Connect with them.","The best briefs leave room for magic.","There are no boring brands — only uninspired strategies.","Show your work. Share your thinking. Own your results.","Keep the client happy. Keep the audience happier.","Build something bigger than a campaign.","Great teams don't just deliver. They elevate.","If it doesn't feel bold, make it bolder.","The story you tell today shapes the sale of tomorrow.","Your craft is your calling card.","Work that moves people moves needles.","Speak the language of your audience, not your industry.","Every brand started with someone who believed in it first.","Less selling, more serving.","The ones who change the game are too busy playing to notice the rules.","Excellence is not an act but a habit.","Ideas don't expire. But trends do.","Your team is your most powerful creative asset.","Real engagement is earned, not engineered.","Push the work until it pushes back.","Think like a strategist. Feel like a human.","The click is the beginning. The experience is the campaign.","Do good work for good people.","Every idea is a seed. Water it with execution.","Content without context is just noise.","Make the mundane magnificent.","The creative process is messy. The result should be flawless.","Success in marketing is never final. Keep iterating.","Be the team clients call first and thank last.","Put your whole self into the work.","The best idea in the room hasn't been said yet.","Brands that give value get loyalty in return.","Make it click. Make it stick. Make it convert.","Creativity is the last legal advantage.","The brief is a question. The campaign is the answer.","Stay inspired or stay irrelevant.","One brave decision can unlock an entire strategy.","Your campaign is only as strong as your idea.","Art for attention. Science for results.","Build bridges between brands and people.","Make it resonate before you make it viral.","The most important metric is whether you made someone feel something.","Strong teams make strong campaigns.","Let the work speak louder than the pitch.","Marketing is the art of making people care.","Solve real problems. Win real loyalty.","Your next idea is worth more than your last excuse.","Show up for your brand the way you'd show up for your best client.","Stay curious. Stay sharp. Stay meraki.","Influence is built through value, not volume.","Sometimes the wildest idea is the wisest strategy.","Work with heart. Measure with head.","The audience is always right. The algorithm is sometimes right.","Beautiful work is a business advantage.","When in doubt, make it more human.","Campaigns end. Brands live on.","Every click is a vote of confidence. Earn it.","Think about the thousandth customer, not just the first.","Details are not details. They make the design.","The best marketing makes people feel like they discovered it.","Clients come for the work. They stay for the trust.","Excellence is a culture, not a deadline.","The strongest brands are built on the clearest ideas.","Be the calm in your client's storm.","Pour passion into every post.","One team, one vision, infinite possibilities.","You don't need a big budget. You need a big idea.","The world needs your brand's best voice. Use it.","Make your work impossible to ignore.","Every strategy should start with a single human truth.","Protect the idea. Fight for the vision.","A great campaign is remembered. A great brand is trusted.","Sell the dream. Deliver the reality.","There is no such thing as a small campaign for a big idea.","The best strategies feel obvious once you've seen them.","Turn every touchpoint into a moment worth remembering.","If you're not growing, you're coasting.","The most creative work comes from the most focused briefs.","Be the agency that changes things.","Your brand is alive. Treat it that way.","Great work requires great courage.","Believe in the work before anyone else does.","Stay true to the idea even when the deadline screams.","Make every client feel like your only client.","The best campaigns don't just launch — they land.","Let curiosity lead your best strategies.","A strong voice in a crowded feed is a rare gift. Use it.","Scale creativity, not just spend.","Your team's belief in an idea is the first proof of concept.","Insight turns data into gold.","Create work that makes your team proud.","Never sacrifice the idea for the timeline.","The brands people love are the ones that never stopped caring.","Marketing at its best is service with style.","One brief. One focus. One unforgettable idea.","Where others see a product, we see a story.","Be brave enough to stand out in any feed.","The right words in the right order can change everything.","Let your portfolio do the talking.","Make beauty purposeful and purpose beautiful.","The campaign you're most nervous about is usually the best one.","Every day is a chance to make something worth remembering.","Don't just reach people — move them.","Design thinking leads to market winning.","The brand that listens loudest wins.","Your reputation is built post by post.","Ambition is just imagination with a deadline.","Good marketing makes the company look smart. Great marketing makes the customer feel smart.","Inspire your team. Inspire your clients. Inspire the market.","Every post is a brick in your brand's house.","Chase the idea, not the trend.","The most memorable brands make you feel like family.","Real creativity has no off switch.","A single great idea can outrun a million mediocre ones.","Do the work even when no one is watching.","Put your signature on everything you make.","The best day to do great work is always today.","Meraki: to do something with soul, creativity, and love.","Build it well. Build it beautifully. Build it to last.","Stay humble in the pitch room. Stay bold on the canvas.","The brief is just the beginning of the story.","Make clients feel heard before you make them feel wowed.","Patience builds brands. Urgency builds campaigns.","Never stop asking: what would make this even better?","Art and science together make unstoppable marketing.","Your best work is always the next one.","Think like a startup. Execute like a studio.","The ads that changed culture didn't just sell products — they told truths.","Every brand has a heartbeat. Find it and amplify it.","Pour your whole heart into a half-second scroll stop.","Great design is great communication.","Be the agency that makes clients say yes to bold.","The right strategy at the right moment is worth more than the biggest budget.","Build brands with the care of a craftsman.","Every rejection sharpens the idea.","You are what you consistently create.","Dare to make work that no algorithm can predict.","The world's best brands were built by people who cared deeply.","In a world of content, be a signal.","Make it once. Make it right. Make it memorable.","The story you're afraid to tell is the one worth telling.","Go beyond the brief. Blow past expectations.","Every scroll is a competition. Win it with craft.","The most powerful tool in marketing is sincerity.","Make the work so good that the client becomes a fan.","Creativity isn't a department. It's a mindset.","Turn strategy into storytelling. Storytelling into sales.","Be obsessed with the customer's experience.","The spark of an idea can light an entire market.","Start with empathy. End with impact.","Every campaign deserves your very best.","Think big, start now.","Make it feel effortless — even when it wasn't.","The greatest creative risk is playing it safe.","Your work reflects your values. Make both exceptional.","Every brief is an invitation to create something extraordinary.","Be relentless in the pursuit of great work.","Relevance today. Legacy tomorrow.","Behind every great brand is a team that refuses to settle.","Make work you'd hang on your wall.","Show the world what a digital agency truly looks like.","The best campaigns feel like gifts to the audience.","Courage is the most creative act.","We don't just manage accounts. We build futures.","The idea is everything. Protect it.","Create. Iterate. Inspire. Repeat."];

function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000) - 1;
}

function QuoteCard() {
  const dayIdx = Math.min(getDayOfYear(), QUOTES_365.length - 1);
  const quote = QUOTES_365[dayIdx] || QUOTES_365[0];
  const now = new Date();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dateStr = days[now.getDay()] + ", " + now.getDate() + " " + months[now.getMonth()] + " " + now.getFullYear();

  const words = quote.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (t.length > 36 && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  const fs = lines.length > 3 ? 17 : lines.length > 2 ? 19 : 21;
  const lh = fs + 10;
  const midY = 96;
  const startY = midY - ((lines.length - 1) * lh) / 2;

  const textEls = lines.map((l, i) =>
    `<text x="200" y="${startY + i * lh}" text-anchor="middle" font-family="Dancing Script,cursive" font-size="${fs}" fill="#2C2C2A" font-weight="600">${l.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</text>`
  ).join("");

  const svgContent = `<svg width="100%" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <rect width="400" height="200" fill="#FDFCF8"/>
    <path d="M -2 200 Q 8 164 30 144 Q 44 168 -2 200 Z" fill="#C5E89A" opacity="0.6"/>
    <path d="M -2 200 Q 22 166 30 144" stroke="#7DC242" stroke-width="0.8" fill="none" opacity="0.5"/>
    <path d="M 18 200 Q 28 166 48 154 Q 40 176 18 200 Z" fill="#97C459" opacity="0.4"/>
    <path d="M -4 188 Q 14 158 24 132 Q 34 156 -4 188 Z" fill="#C0DD97" opacity="0.3"/>
    <path d="M 28 202 Q 28 168 28 138" stroke="#639922" stroke-width="1" fill="none" opacity="0.38" stroke-linecap="round"/>
    <circle cx="28" cy="134" r="4.5" fill="#29ABE2" opacity="0.4"/>
    <circle cx="28" cy="134" r="2.5" fill="#7DC242" opacity="0.55"/>
    <ellipse cx="22" cy="128" rx="4.5" ry="2.5" fill="#A8DCF0" opacity="0.45" transform="rotate(-30 22 128)"/>
    <ellipse cx="34" cy="128" rx="4.5" ry="2.5" fill="#A8DCF0" opacity="0.45" transform="rotate(30 34 128)"/>
    <path d="M 402 0 Q 390 34 366 46 Q 362 22 402 0 Z" fill="#C5E89A" opacity="0.6"/>
    <path d="M 402 0 Q 376 26 366 46" stroke="#7DC242" stroke-width="0.8" fill="none" opacity="0.5"/>
    <path d="M 402 16 Q 374 38 356 48 Q 360 24 402 16 Z" fill="#97C459" opacity="0.38"/>
    <path d="M 404 8 Q 386 40 376 68 Q 366 44 404 8 Z" fill="#C0DD97" opacity="0.28"/>
    <path d="M 374 -2 Q 372 28 370 56" stroke="#639922" stroke-width="1" fill="none" opacity="0.38" stroke-linecap="round"/>
    <circle cx="370" cy="60" r="4.5" fill="#FAC775" opacity="0.5"/>
    <circle cx="370" cy="60" r="2.5" fill="#EF9F27" opacity="0.55"/>
    <ellipse cx="364" cy="54" rx="4.5" ry="2.5" fill="#FAC775" opacity="0.45" transform="rotate(-30 364 54)"/>
    <ellipse cx="376" cy="54" rx="4.5" ry="2.5" fill="#FAC775" opacity="0.45" transform="rotate(30 376 54)"/>
    <text x="52" y="${midY+32}" font-family="Cormorant Garamond,Georgia,serif" font-size="82" fill="#7DC242" opacity="0.1" font-style="italic">"</text>
    <text x="298" y="${midY+54}" font-family="Cormorant Garamond,Georgia,serif" font-size="82" fill="#29ABE2" opacity="0.08" font-style="italic">"</text>
    ${textEls}
    <line x1="${200-52}" y1="${midY+44}" x2="${200+52}" y2="${midY+44}" stroke="#C0DD97" stroke-width="0.8"/>
    <circle cx="200" cy="${midY+44}" r="2" fill="#7DC242" opacity="0.6"/>
    <text x="200" y="${midY+58}" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-size="11" fill="#aaa" font-style="italic" letter-spacing="1.5">Meraki Ads</text>
    <rect x="148" y="${midY+66}" width="104" height="18" rx="9" fill="#EAF3DE"/>
    <text x="200" y="${midY+78}" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="10" fill="#3B6D11" letter-spacing="0.3">${dateStr}</text>
  </svg>`;

  return (
    <div style={{width:"100%",maxWidth:"360px",background:"#fff",borderRadius:"18px",overflow:"hidden",border:"0.5px solid #e0e0e0"}}>
      <div style={{height:"3px",background:"#7DC242"}}></div>
      <div dangerouslySetInnerHTML={{__html: svgContent}}/>
      <div style={{height:"3px",background:"#29ABE2"}}></div>
    </div>
  );
}

>;
}

// ── GLOBAL CSS ─────────────────────────────────────────────
const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;600&family=Cormorant+Garamond:ital,wght@1,400&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F7F9F4;color:#1a1a1a;font-size:15px}
.login-wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.25rem;gap:14px;background:#F7F9F4}
.login-card{background:#fff;border-radius:18px;padding:1.75rem;width:100%;max-width:360px;border:0.5px solid #e0e0e0}
.login-logo{text-align:center;margin-bottom:4px}
.logo-text{font-family:'Dancing Script',cursive;font-size:28px;font-weight:600;line-height:1}
.logo-text .lm{color:#7DC242}.logo-text .la{color:#29ABE2}
.login-sub{text-align:center;font-size:10px;color:#bbb;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:20px}
.role-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1.25rem}
.role-btn{padding:14px 10px;border:1.5px solid #e8e8e8;border-radius:12px;cursor:pointer;background:#fafafa;text-align:center;transition:all .15s}
.role-btn:hover{border-color:#7DC242}
.role-btn.selected{border-color:#7DC242;background:#F3FBE8}
.role-btn i{font-size:24px;display:block;margin-bottom:6px;color:#ccc}
.role-btn.selected i{color:#7DC242}
.role-btn span{font-size:13px;font-weight:600;display:block;color:#1a1a1a}
.role-btn small{font-size:11px;color:#aaa}
.topbar{background:#fff;border-bottom:1px solid #eee;padding:0 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;height:54px;overflow:hidden}
.topbar-logo{font-family:'Dancing Script',cursive;font-size:22px;font-weight:600;position:relative;z-index:2;line-height:1}
.topbar-logo .lm{color:#7DC242}.topbar-logo .la{color:#29ABE2}
.topbar-right{display:flex;gap:8px;align-items:center;position:relative;z-index:2}
.topbar-botanical{position:absolute;top:0;left:0;width:100%;height:54px;pointer-events:none;z-index:1}
.nav-bar{background:#fff;border-bottom:1px solid #eee;display:flex;padding:0 20px;overflow-x:auto}
.nav-item{padding:11px 16px;font-size:13px;cursor:pointer;color:#aaa;border-bottom:2px solid transparent;white-space:nowrap;display:flex;align-items:center;gap:6px;transition:all .15s;font-weight:500}
.nav-item.active{color:#7DC242;border-bottom-color:#7DC242}
.nav-item i{font-size:15px}
.content{padding:20px;max-width:800px;margin:0 auto;position:relative}
.body-botanical{position:absolute;top:0;right:0;width:220px;height:100%;pointer-events:none;z-index:0}
.body-botanical-left{position:absolute;bottom:0;left:0;width:90px;height:180px;pointer-events:none;z-index:0}
.content-inner{position:relative;z-index:1}
.alert{padding:10px 14px;border-radius:10px;margin-bottom:12px;display:flex;align-items:flex-start;gap:10px;font-size:13px}
.alert i{font-size:16px;flex-shrink:0;margin-top:1px}
.alert-red{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B}
.alert-red i{color:#DC2626}
.alert-amber{background:#FFFBEB;border:1px solid #FDE68A;color:#92400E}
.alert-amber i{color:#D97706}
.alert-green{background:#F3FBE8;border:1px solid #C0DD97;color:#3B6D11}
.alert-green i{color:#7DC242}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1.25rem}
.stat-card{background:#fff;border:0.5px solid #e8e8e8;border-radius:12px;padding:12px;text-align:center}
.stat-num{font-size:22px;font-weight:700}
.stat-label{font-size:11px;color:#aaa;margin-top:2px}
.form-card{background:#fff;border:0.5px solid #e8e8e8;border-radius:14px;padding:1.25rem;margin-bottom:1rem}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.form-group{margin-bottom:12px}
.form-group label{font-size:12px;color:#555;font-weight:500;display:block;margin-bottom:4px}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:8px 10px;font-size:14px;border:1px solid #e0e0e0;border-radius:8px;background:#fff;color:#1a1a1a;font-family:inherit;outline:none;transition:border .15s}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:#7DC242}
.form-group textarea{resize:vertical;min-height:80px}
.section-title{font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:12px}
.plat-grid{display:flex;flex-wrap:wrap;gap:7px;margin-top:6px}
.plat-badge{display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:8px;border:1px solid #e0e0e0;font-size:13px;cursor:pointer;background:#f5f5f5;color:#555;user-select:none;transition:all .15s}
.plat-badge.on{background:#F3FBE8;border-color:#7DC242;color:#3B6D11;font-weight:500}
.plat-hint{font-size:12px;color:#aaa;margin-top:6px}
.btn{padding:8px 18px;border-radius:8px;border:0.5px solid #ddd;font-size:13px;cursor:pointer;font-family:inherit;background:#f5f5f5;color:#1a1a1a;transition:all .15s;display:inline-flex;align-items:center;gap:6px}
.btn:hover{background:#e8e8e8}
.btn:active{transform:scale(.98)}
.btn-primary{background:#7DC242;color:#fff;border-color:#7DC242}
.btn-primary:hover{background:#639922}
.btn-danger{background:#FEF2F2;color:#DC2626;border-color:#FECACA}
.btn-danger:hover{background:#FEE2E2}
.btn-sm{padding:5px 12px;font-size:12px}
.post-card{background:#fff;border:0.5px solid #e8e8e8;border-radius:14px;padding:1rem 1.25rem;margin-bottom:10px;position:relative;overflow:hidden}
.post-card.overdue{border-left:3px solid #DC2626;border-radius:0 14px 14px 0}
.post-card.today{border-left:3px solid #F59E0B;border-radius:0 14px 14px 0}
.post-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}
.post-card-title{font-weight:600;font-size:14px}
.post-card-meta{font-size:12px;color:#aaa;margin-top:3px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
.badge-pending{background:#FFFBEB;color:#92400E}
.badge-partial{background:#EFF6FF;color:#1D4ED8}
.badge-done{background:#F3FBE8;color:#3B6D11}
.badge-overdue{background:#FEF2F2;color:#991B1B}
.group-wrap{margin-bottom:1.5rem}
.group-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.group-pill{padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600}
.g-overdue .group-pill{background:#FEF2F2;color:#991B1B}
.g-today .group-pill{background:#FFFBEB;color:#92400E}
.g-upcoming .group-pill{background:#f0f0f0;color:#555}
.g-done .group-pill{background:#F3FBE8;color:#3B6D11}
.group-count{font-size:12px;color:#aaa}
.filter-row{display:flex;gap:8px;margin-bottom:1rem;flex-wrap:wrap}
.filter-row select{padding:7px 10px;font-size:13px;border:0.5px solid #e0e0e0;border-radius:8px;background:#fff;color:#1a1a1a;font-family:inherit;cursor:pointer;flex:1;min-width:120px}
.client-row{background:#fff;border:0.5px solid #e8e8e8;border-radius:10px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px}
.client-row-name{font-weight:600;font-size:14px;flex:1;min-width:80px}
.client-plats{display:flex;flex-wrap:wrap;gap:4px;flex:2}
.client-plat-tag{font-size:11px;padding:2px 8px;border-radius:6px;background:#E8F6FD;color:#0B7AB5;border:0.5px solid #A8DCF0;display:inline-flex;align-items:center;gap:3px}
.client-actions{display:flex;gap:6px;flex-shrink:0}
.edit-form{background:#FAFDF7;border:0.5px solid #e0e0e0;border-radius:10px;padding:14px;margin-bottom:8px}
.plat-check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px}
.plat-check{display:flex;align-items:center;gap:6px;padding:7px 10px;border-radius:8px;border:0.5px solid #e0e0e0;cursor:pointer;font-size:13px;background:#f5f5f5;color:#555;user-select:none;transition:all .15s}
.plat-check.on{background:#F3FBE8;border-color:#7DC242;color:#3B6D11}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.info-block{background:#FAFDF7;border-radius:8px;padding:8px 12px}
.info-block-label{font-size:11px;color:#aaa;margin-bottom:2px;text-transform:uppercase;letter-spacing:.04em}
.info-block-val{font-size:13px;font-weight:600;color:#1a1a1a}
.caption-box{background:#FAFDF7;border-radius:8px;padding:10px 12px;margin-bottom:10px}
.caption-label{font-size:11px;color:#aaa;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}
.caption-val{font-size:13px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.remarks-box{background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:8px 12px;margin-bottom:10px;display:flex;gap:8px}
.remarks-box i{color:#D97706;font-size:15px;flex-shrink:0;margin-top:1px}
.remarks-txt{font-size:13px;color:#92400E;line-height:1.5}
.asset-btn{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#0B7AB5;text-decoration:none;padding:6px 12px;border:0.5px solid #A8DCF0;border-radius:8px;background:#E8F6FD;margin-bottom:10px}
.check-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;border:0.5px solid #e8e8e8;margin-bottom:6px}
.check-row.done-row{background:#F3FBE8;border-color:#C0DD97}
.check-row input[type=checkbox]{width:16px;height:16px;cursor:pointer;flex-shrink:0;accent-color:#7DC242}
.posted-by-tag{font-size:11px;color:#3B6D11;margin-left:auto;white-space:nowrap;display:flex;align-items:center;gap:3px}
.name-row{display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;background:#FAFDF7;border-radius:8px}
.name-row label{font-size:13px;white-space:nowrap;color:#555}
.name-row input{flex:1;font-size:13px;padding:6px 8px;border:0.5px solid #ddd;border-radius:6px}
.divider{height:1px;background:#eee;margin:12px 0}
.sub-label{font-size:12px;color:#aaa;font-weight:500;margin-bottom:8px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:999;white-space:nowrap}
.loading{text-align:center;padding:3rem;color:#aaa;font-size:14px}
.spinner{display:inline-block;width:20px;height:20px;border:2px solid #e0e0e0;border-top-color:#7DC242;border-radius:50%;animation:spin .7s linear infinite;margin-right:8px;vertical-align:-4px}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{text-align:center;padding:2.5rem;color:#aaa;font-size:14px}
.empty i{font-size:2.5rem;display:block;margin-bottom:10px;opacity:.3}
.err-msg{background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:8px 12px;font-size:13px;color:#991B1B;margin-top:8px}
.success-banner{background:#F3FBE8;border:1px solid #C0DD97;border-radius:8px;padding:8px 12px;font-size:13px;color:#3B6D11;margin-bottom:12px}
.pm-detail-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}
.pm-detail-block{background:#FAFDF7;border-radius:8px;padding:8px 12px}
.pm-detail-full{grid-column:1/-1}
.pm-detail-label{font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
.pm-detail-val{font-size:13px;color:#1a1a1a;line-height:1.5;word-break:break-word}
.pm-caption-val{white-space:pre-wrap}
.pm-remarks-block{background:#FFFBEB;border:1px solid #FDE68A;display:flex;gap:10px;align-items:flex-start}
.pm-remarks-block .pm-detail-label{color:#92400E}
.pm-remarks-block .pm-detail-val{color:#92400E}
.pm-plat-row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;margin-bottom:5px;border:0.5px solid #e8e8e8}
.pm-plat-posted{background:#F3FBE8;border-color:#C0DD97}
.pm-plat-pending{background:#FAFDF7}
.pm-posted-tag{font-size:11px;font-weight:600;color:#3B6D11;background:#DCFCE7;padding:2px 8px;border-radius:20px;display:inline-flex;align-items:center;gap:3px}
.pm-pending-tag{font-size:11px;color:#aaa;background:#f0f0f0;padding:2px 8px;border-radius:20px}
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:100;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto}
.modal-overlay.open{display:flex}
.modal{background:#fff;border-radius:16px;width:100%;max-width:640px;margin:auto}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #eee}
.modal-header h3{font-size:15px;font-weight:600}
.modal-body{padding:20px;max-height:70vh;overflow-y:auto}
.modal-footer{padding:14px 20px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;gap:8px}
`;
