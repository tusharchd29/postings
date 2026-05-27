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
      const data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result.split(",")[1]);
        reader.readAsDataURL(screenshotFile);
      });
      screenshot = { data, name: screenshotFile.name, mimeType: screenshotFile.type, clientName };
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
      </Head>
      <style>{globalCSS}</style>
      <div className="login-wrap">
        <div className="login-card">
          <h1>Postings</h1>
          <p>Select your role and enter your PIN to continue.</p>
          <div className="role-grid">
            <div className={`role-btn ${selectedRole==="pm"?"selected":""}`} onClick={()=>setSelectedRole("pm")}>
              <i className="ti ti-layout-dashboard"></i>
              <span>Project Manager</span><small>Create &amp; track posts</small>
            </div>
            <div className={`role-btn ${selectedRole==="posting"?"selected":""}`} onClick={()=>setSelectedRole("posting")}>
              <i className="ti ti-send"></i>
              <span>Posting Team</span><small>Mark posts as done</small>
            </div>
          </div>
          <div className="form-group">
            <label>PIN</label>
            <input type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Enter your PIN"
              onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
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
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css"/></Head>
        <style>{globalCSS}</style>

        <div className="topbar">
          <div className="topbar-left">
            <h2><i className="ti ti-layout-dashboard" style={{fontSize:15,verticalAlign:-2,marginRight:6}}></i>PM Dashboard</h2>
            <p>{today}</p>
          </div>
          <div className="topbar-right">
            <button className="btn btn-sm" onClick={loadAll}><i className="ti ti-refresh"></i> Refresh</button>
            <button className="btn btn-sm" onClick={logout}><i className="ti ti-logout"></i> Sign out</button>
          </div>
        </div>
        <div className="nav-bar">
          {["overview","new","clients","sow"].map((t,i)=>(
            <div key={t} className={`nav-item ${activeTab===t?"active":""}`} onClick={()=>{ setActiveTab(t); if(t==="sow"&&sowRows.length===0) loadSOW(); }}>
              <i className={`ti ${["ti-chart-bar","ti-plus","ti-users","ti-file-text"][i]}`}></i>
              {["Overview","New post","Clients & Platforms","SOW"][i]}
            </div>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab==="overview" && (
          <div className="content">
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
          <div className="content">
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
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css"/></Head>
        <style>{globalCSS}</style>
        <div className="topbar">
          <div className="topbar-left">
            <h2><i className="ti ti-send" style={{fontSize:15,verticalAlign:-2,marginRight:6}}></i>Posting Team</h2>
            <p>Your posts to action</p>
          </div>
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
  return <div className="toast" style={{display:show?"block":"none"}}>{msg}</div>;
}

// ── GLOBAL CSS ─────────────────────────────────────────────
const globalCSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;color:#1a1a1a;font-size:15px}
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
.login-card{background:#fff;border-radius:16px;padding:2rem;width:100%;max-width:360px;border:1px solid #e5e5e5}
.login-card h1{font-size:20px;font-weight:600;margin-bottom:4px}
.login-card p{font-size:13px;color:#666;margin-bottom:1.5rem}
.role-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1.25rem}
.role-btn{padding:14px 10px;border:1.5px solid #e5e5e5;border-radius:12px;cursor:pointer;background:#fafafa;text-align:center;transition:all .15s}
.role-btn:hover{border-color:#185FA5}
.role-btn.selected{border-color:#185FA5;background:#EBF4FF}
.role-btn i{font-size:26px;display:block;margin-bottom:6px;color:#888}
.role-btn.selected i{color:#185FA5}
.role-btn span{font-size:13px;font-weight:600;display:block;color:#1a1a1a}
.role-btn small{font-size:11px;color:#888}
.topbar{background:#fff;border-bottom:1px solid #e5e5e5;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.topbar-left h2{font-size:15px;font-weight:600}
.topbar-left p{font-size:12px;color:#888;margin-top:1px}
.topbar-right{display:flex;gap:8px;align-items:center}
.nav-bar{background:#fff;border-bottom:1px solid #e5e5e5;display:flex;padding:0 20px;overflow-x:auto}
.nav-item{padding:12px 16px;font-size:13px;cursor:pointer;color:#666;border-bottom:2px solid transparent;white-space:nowrap;display:flex;align-items:center;gap:6px;transition:all .15s}
.nav-item.active{color:#185FA5;border-bottom-color:#185FA5;font-weight:500}
.nav-item i{font-size:15px}
.content{padding:20px;max-width:800px;margin:0 auto}
.alert{padding:10px 14px;border-radius:8px;margin-bottom:10px;display:flex;align-items:flex-start;gap:10px;font-size:13px}
.alert i{font-size:16px;flex-shrink:0;margin-top:1px}
.alert-red{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B}
.alert-red i{color:#DC2626}
.alert-amber{background:#FFFBEB;border:1px solid #FDE68A;color:#92400E}
.alert-amber i{color:#D97706}
.alert-green{background:#F0FDF4;border:1px solid #BBF7D0;color:#166534}
.alert-green i{color:#16A34A}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1.25rem}
.stat-card{background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:12px;text-align:center}
.stat-num{font-size:22px;font-weight:700}
.stat-label{font-size:11px;color:#888;margin-top:2px}
.form-card{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:1.25rem;margin-bottom:1rem}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.form-group{margin-bottom:12px}
.form-group label{font-size:12px;color:#555;font-weight:500;display:block;margin-bottom:4px}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:8px 10px;font-size:14px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#1a1a1a;font-family:inherit;outline:none;transition:border .15s}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:#185FA5}
.form-group textarea{resize:vertical;min-height:80px}
.section-title{font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:12px}
.plat-grid{display:flex;flex-wrap:wrap;gap:7px;margin-top:6px}
.plat-badge{display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:8px;border:1px solid #ddd;font-size:13px;cursor:pointer;background:#f5f5f5;color:#555;user-select:none;transition:all .15s}
.plat-badge.on{background:#EBF4FF;border-color:#185FA5;color:#185FA5;font-weight:500}
.plat-hint{font-size:12px;color:#888;margin-top:6px}
.btn{padding:8px 18px;border-radius:8px;border:1px solid #ddd;font-size:13px;cursor:pointer;font-family:inherit;background:#f5f5f5;color:#1a1a1a;transition:all .15s;display:inline-flex;align-items:center;gap:6px}
.btn:hover{background:#e8e8e8}
.btn:active{transform:scale(.98)}
.btn-primary{background:#185FA5;color:#fff;border-color:#185FA5}
.btn-primary:hover{background:#0C447C}
.btn-danger{background:#FEF2F2;color:#DC2626;border-color:#FECACA}
.btn-danger:hover{background:#FEE2E2}
.btn-sm{padding:5px 12px;font-size:12px}
.post-card{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:1rem 1.25rem;margin-bottom:10px}
.post-card.overdue{border-left:3px solid #DC2626;border-radius:0 12px 12px 0}
.post-card.today{border-left:3px solid #D97706;border-radius:0 12px 12px 0}
.post-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}
.post-card-title{font-weight:600;font-size:14px}
.post-card-meta{font-size:12px;color:#888;margin-top:3px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
.badge-pending{background:#FFFBEB;color:#92400E}
.badge-partial{background:#EFF6FF;color:#1D4ED8}
.badge-done{background:#F0FDF4;color:#166534}
.badge-overdue{background:#FEF2F2;color:#991B1B}
.group-wrap{margin-bottom:1.5rem}
.group-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.group-pill{padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600}
.g-overdue .group-pill{background:#FEF2F2;color:#991B1B}
.g-today .group-pill{background:#FFFBEB;color:#92400E}
.g-upcoming .group-pill{background:#f5f5f5;color:#555}
.g-done .group-pill{background:#F0FDF4;color:#166534}
.group-count{font-size:12px;color:#888}
.filter-row{display:flex;gap:8px;margin-bottom:1rem;flex-wrap:wrap}
.filter-row select{padding:7px 10px;font-size:13px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#1a1a1a;font-family:inherit;cursor:pointer;flex:1;min-width:120px}
.client-row{background:#fff;border:1px solid #e5e5e5;border-radius:10px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px}
.client-row-name{font-weight:600;font-size:14px;flex:1;min-width:80px}
.client-plats{display:flex;flex-wrap:wrap;gap:4px;flex:2}
.client-plat-tag{font-size:11px;padding:2px 8px;border-radius:6px;background:#EBF4FF;color:#1D4ED8;border:1px solid #BFDBFE;display:inline-flex;align-items:center;gap:3px}
.client-actions{display:flex;gap:6px;flex-shrink:0}
.edit-form{background:#f9f9f9;border:1px solid #e5e5e5;border-radius:10px;padding:14px;margin-bottom:8px}
.plat-check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px}
.plat-check{display:flex;align-items:center;gap:6px;padding:7px 10px;border-radius:8px;border:1px solid #ddd;cursor:pointer;font-size:13px;background:#f5f5f5;color:#555;user-select:none;transition:all .15s}
.plat-check.on{background:#EBF4FF;border-color:#185FA5;color:#185FA5}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.info-block{background:#f9f9f9;border-radius:8px;padding:8px 12px}
.info-block-label{font-size:11px;color:#888;margin-bottom:2px;text-transform:uppercase;letter-spacing:.04em}
.info-block-val{font-size:13px;font-weight:600;color:#1a1a1a}
.caption-box{background:#f9f9f9;border-radius:8px;padding:10px 12px;margin-bottom:10px}
.caption-label{font-size:11px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}
.caption-val{font-size:13px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.remarks-box{background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:8px 12px;margin-bottom:10px;display:flex;gap:8px}
.remarks-box i{color:#D97706;font-size:15px;flex-shrink:0;margin-top:1px}
.remarks-txt{font-size:13px;color:#92400E;line-height:1.5}
.asset-btn{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#185FA5;text-decoration:none;padding:6px 12px;border:1px solid #BFDBFE;border-radius:8px;background:#EBF4FF;margin-bottom:10px}
.check-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;border:1px solid #e5e5e5;margin-bottom:6px}
.check-row.done-row{background:#F0FDF4;border-color:#86EFAC}
.check-row input[type=checkbox]{width:16px;height:16px;cursor:pointer;flex-shrink:0;accent-color:#16A34A}
.posted-by-tag{font-size:11px;color:#166534;margin-left:auto;white-space:nowrap;display:flex;align-items:center;gap:3px}
.name-row{display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 10px;background:#f5f5f5;border-radius:8px}
.name-row label{font-size:13px;white-space:nowrap;color:#555}
.name-row input{flex:1;font-size:13px;padding:6px 8px;border:1px solid #ddd;border-radius:6px}
.divider{height:1px;background:#e5e5e5;margin:12px 0}
.sub-label{font-size:12px;color:#888;font-weight:500;margin-bottom:8px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;z-index:999;white-space:nowrap}
.loading{text-align:center;padding:3rem;color:#888;font-size:14px}
.spinner{display:inline-block;width:20px;height:20px;border:2px solid #e5e5e5;border-top-color:#185FA5;border-radius:50%;animation:spin .7s linear infinite;margin-right:8px;vertical-align:-4px}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{text-align:center;padding:2.5rem;color:#888;font-size:14px}
.empty i{font-size:2.5rem;display:block;margin-bottom:10px;opacity:.3}
.err-msg{background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:8px 12px;font-size:13px;color:#991B1B;margin-top:8px}
.success-banner{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:8px 12px;font-size:13px;color:#166534;margin-bottom:12px}
.pm-detail-grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}
.pm-detail-block{background:#f9f9f9;border-radius:8px;padding:8px 12px}
.pm-detail-full{grid-column:1/-1}
.pm-detail-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
.pm-detail-val{font-size:13px;color:#1a1a1a;line-height:1.5;word-break:break-word}
.pm-caption-val{white-space:pre-wrap}
.pm-remarks-block{background:#FFFBEB;border:1px solid #FDE68A;display:flex;gap:10px;align-items:flex-start}
.pm-remarks-block .pm-detail-label{color:#92400E}
.pm-remarks-block .pm-detail-val{color:#92400E}
.pm-plat-row{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;margin-bottom:5px;border:1px solid #e5e5e5}
.pm-plat-posted{background:#F0FDF4;border-color:#86EFAC}
.pm-plat-pending{background:#f9f9f9}
.pm-posted-tag{font-size:11px;font-weight:600;color:#166534;background:#DCFCE7;padding:2px 8px;border-radius:20px;display:inline-flex;align-items:center;gap:3px}
.pm-pending-tag{font-size:11px;color:#888;background:#f0f0f0;padding:2px 8px;border-radius:20px}
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:100;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto}
.modal-overlay.open{display:flex}
.modal{background:#fff;border-radius:16px;width:100%;max-width:640px;margin:auto}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e5e5e5}
.modal-header h3{font-size:15px;font-weight:600}
.modal-body{padding:20px;max-height:70vh;overflow-y:auto}
.modal-footer{padding:14px 20px;border-top:1px solid #e5e5e5;display:flex;justify-content:space-between;align-items:center;gap:8px}
.btn-close{background:none;border:none;cursor:pointer;font-size:20px;color:#888;padding:0;line-height:1;display:flex;align-items:center}
.btn-close:hover{color:#1a1a1a}
.post-card-actions{display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid #e5e5e5}
@media(max-width:500px){
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .form-row{grid-template-columns:1fr}
  .plat-check-grid{grid-template-columns:repeat(2,1fr)}
  .client-row{flex-wrap:wrap}
}
`;
