import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  CircleDollarSign,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  Users
} from "lucide-react";
import "./styles.css";

type Role = "admin" | "user";
type BetKind = "single" | "parlay";
type BetStatus = "pending" | "won" | "lost" | "pushed" | "void" | "half_won" | "half_lost";

type User = {
  id: number;
  username: string;
  role: Role;
  is_active: boolean;
  created_at: string;
};

type Bet = {
  id: number;
  user_id: number;
  kind: BetKind;
  sport: string;
  league?: string | null;
  event_name: string;
  market: string;
  selection: string;
  odds: string;
  stake: string;
  platform?: string | null;
  placed_at: string;
  status: BetStatus;
  payout?: string | null;
  profit?: string | null;
  pre_match_thoughts?: string | null;
  post_match_review?: string | null;
  mistake_category?: string | null;
  confidence?: number | null;
  tag_names: string[];
  legs: Array<{
    id: number;
    sport: string;
    event_name: string;
    market: string;
    selection: string;
    odds: string;
    status: BetStatus;
  }>;
};

type Stats = {
  bets: number;
  settled_bets: number;
  stake: string;
  profit: string;
  roi: string;
  win_rate: string;
  by_sport: Bucket[];
  by_platform: Bucket[];
  by_kind: Bucket[];
  by_user: Bucket[];
};

type Bucket = {
  key: string;
  bets: number;
  stake: string;
  profit: string;
  roi: string;
};

type BetDraft = {
  kind: BetKind;
  sport: string;
  placed_at: string;
  event_name: string;
  market: string;
  selection: string;
  odds: string;
  stake: string;
  platform: string;
  status: BetDraftStatus;
  pre_match_thoughts: string;
  tag_names: string;
  legs: string;
};

type BetDraftStatus = BetStatus | "";

function todayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateDraftProfit(stakeValue: string, oddsValue: string, status: BetDraftStatus) {
  const stake = Number(stakeValue);
  const odds = Number(oddsValue);
  if (!stakeValue || !oddsValue || !status || Number.isNaN(stake) || Number.isNaN(odds)) return "";

  let profit = 0;
  if (status === "won") profit = stake * (odds - 1);
  if (status === "lost") profit = -stake;
  if (status === "pushed" || status === "void") profit = 0;
  if (status === "half_won") profit = (stake * (odds - 1)) / 2;
  if (status === "half_lost") profit = -stake / 2;
  return profit.toFixed(2);
}

const statusLabels: Record<BetStatus, string> = {
  pending: "待结算",
  won: "赢",
  lost: "输",
  pushed: "走水",
  void: "取消",
  half_won: "赢半",
  half_lost: "输半"
};

const resultLabels: Record<Exclude<BetStatus, "pending">, string> = {
  won: "赢",
  lost: "输",
  pushed: "走水",
  void: "取消",
  half_won: "赢半",
  half_lost: "输半"
};

function createEmptyDraft(): BetDraft {
  return {
    kind: "single",
    sport: "足球",
    placed_at: todayDateInputValue(),
    event_name: "",
    market: "欧盘",
    selection: "",
    odds: "1.900",
    stake: "100",
    platform: "",
    status: "",
    pre_match_thoughts: "",
    tag_names: "",
    legs: ""
  };
}

function api(token: string | null) {
  return async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers
      }
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || response.statusText);
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  };
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const request = useMemo(() => api(token), [token]);
  const [me, setMe] = useState<User | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState("ledger");
  const [message, setMessage] = useState("");

  async function loadAll() {
    if (!token) return;
    const current = await request<User>("/auth/me");
    setMe(current);
    const [betRows, statRows] = await Promise.all([request<Bet[]>("/bets"), request<Stats>("/stats")]);
    setBets(betRows);
    setStats(statRows);
    if (current.role === "admin") {
      setUsers(await request<User[]>("/users"));
    }
  }

  useEffect(() => {
    loadAll().catch((error) => {
      setMessage(error.message);
      if (error.message.includes("token") || error.message.includes("Inactive")) {
        localStorage.removeItem("token");
        setToken(null);
      }
    });
  }, [token]);

  if (!token) {
    return <Login onLogin={(nextToken) => {
      localStorage.setItem("token", nextToken);
      setToken(nextToken);
    }} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <CircleDollarSign size={24} />
          <span>Bet Manage</span>
        </div>
        <button className={activeTab === "ledger" ? "nav active" : "nav"} onClick={() => setActiveTab("ledger")}>
          <BookOpenCheck size={18} /> 台账
        </button>
        <button className={activeTab === "stats" ? "nav active" : "nav"} onClick={() => setActiveTab("stats")}>
          <BarChart3 size={18} /> 统计
        </button>
        {me?.role === "admin" && (
          <button className={activeTab === "admin" ? "nav active" : "nav"} onClick={() => setActiveTab("admin")}>
            <Users size={18} /> 用户
          </button>
        )}
        <button
          className="nav bottom"
          onClick={() => {
            localStorage.removeItem("token");
            setToken(null);
          }}
        >
          <LogOut size={18} /> 退出
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{me?.role === "admin" ? "管理员视图" : "个人视图"}</p>
            <h1>{activeTab === "ledger" ? "投注台账" : activeTab === "stats" ? "统计面板" : "账号管理"}</h1>
          </div>
          <button className="icon-button" title="刷新" onClick={() => loadAll()}>
            <RefreshCw size={18} />
          </button>
        </header>

        {message && <div className="notice">{message}</div>}
        {activeTab === "ledger" && <Ledger bets={bets} request={request} reload={loadAll} />}
        {activeTab === "stats" && <StatsPanel stats={stats} />}
        {activeTab === "admin" && me?.role === "admin" && <AdminPanel users={users} request={request} reload={loadAll} />}
      </main>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123456");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await api(null)<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      onLogin(response.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    }
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={submit}>
        <div className="brand large"><Shield size={28} /><span>Bet Manage</span></div>
        <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <div className="notice">{error}</div>}
        <button className="primary" type="submit">登录</button>
      </form>
    </main>
  );
}

function Ledger({ bets, request, reload }: { bets: Bet[]; request: ReturnType<typeof api>; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<BetDraft>(() => createEmptyDraft());
  const [review, setReview] = useState<Record<number, string>>({});
  const draftProfit = calculateDraftProfit(draft.stake, draft.odds, draft.status);

  async function createBet(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.status) return;
    const legs = draft.kind === "parlay"
      ? draft.legs.split("\n").filter(Boolean).map((line) => {
          const [sport, event_name, market, selection, odds] = line.split("|").map((item) => item.trim());
          return { sport, event_name, market, selection, odds, status: "pending" as BetStatus };
        })
      : [];
    await request("/bets", {
      method: "POST",
      body: JSON.stringify({
        ...draft,
        selection: draft.selection || "-",
        status: draft.status,
        placed_at: draft.placed_at ? new Date(`${draft.placed_at}T00:00:00`).toISOString() : new Date().toISOString(),
        tag_names: [],
        legs
      })
    });
    setDraft(createEmptyDraft());
    await reload();
  }

  async function settle(bet: Bet, status: BetStatus) {
    await request(`/bets/${bet.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await reload();
  }

  async function saveReview(bet: Bet) {
    await request(`/bets/${bet.id}`, {
      method: "PATCH",
      body: JSON.stringify({ post_match_review: review[bet.id] ?? bet.post_match_review ?? "" })
    });
    await reload();
  }

  return (
    <div className="ledger-grid">
      <form className="panel bet-form" onSubmit={createBet}>
        <h2><Plus size={18} /> 新增投注</h2>
        <label>投注日期<input required type="date" value={draft.placed_at} onChange={(event) => setDraft({ ...draft, placed_at: event.target.value })} /></label>
        <div className="form-row">
          <label>投注类型<select value={draft.market} onChange={(event) => setDraft({ ...draft, market: event.target.value })}><option value="欧盘">欧盘</option><option value="亚盘">亚盘</option><option value="大小">大小</option><option value="角球">角球</option><option value="其他">其他</option></select></label>
          <label>比赛类型<select value={draft.sport} onChange={(event) => setDraft({ ...draft, sport: event.target.value })}><option value="足球">足球</option><option value="篮球">篮球</option><option value="其他">其他</option></select></label>
        </div>
        <div className="form-row">
          <label>赔率<input required type="number" step="0.001" value={draft.odds} onChange={(event) => setDraft({ ...draft, odds: event.target.value })} /></label>
          <label>金额<input required type="number" step="0.01" value={draft.stake} onChange={(event) => setDraft({ ...draft, stake: event.target.value })} /></label>
        </div>
        <div className="form-row">
          <label>信息来源<input value={draft.event_name} onChange={(event) => setDraft({ ...draft, event_name: event.target.value })} /></label>
          <label>赛果<select required value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as BetDraftStatus })}><option value="">请选择</option>{Object.entries(resultLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <label>盈亏<input readOnly value={draftProfit} placeholder="自动计算" /></label>
        <label>备注<textarea value={draft.pre_match_thoughts} onChange={(event) => setDraft({ ...draft, pre_match_thoughts: event.target.value })} /></label>
        {draft.kind === "parlay" && <label>串关明细<textarea placeholder="运动|赛事|盘口|选择|赔率，每行一个" value={draft.legs} onChange={(event) => setDraft({ ...draft, legs: event.target.value })} /></label>}
        <button className="primary" type="submit">保存投注</button>
      </form>

      <section className="panel table-panel">
        <h2><Activity size={18} /> 记录</h2>
        <div className="table">
          {bets.map((bet) => (
            <article className="bet-row" key={bet.id}>
              <div>
                <strong>{bet.event_name}</strong>
                <span>{bet.sport} · {bet.market} · {bet.selection}</span>
                <div className="chips">{bet.tag_names.map((tag) => <small key={tag}>{tag}</small>)}</div>
              </div>
              <div className="numbers">
                <span>@ {bet.odds}</span>
                <span>￥{bet.stake}</span>
                <b className={Number(bet.profit || 0) >= 0 ? "positive" : "negative"}>{bet.profit ?? "-"}</b>
              </div>
              <div className="actions">
                <select value={bet.status} onChange={(event) => settle(bet, event.target.value as BetStatus)}>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              {bet.legs.length > 0 && <p className="legs">{bet.legs.map((leg) => `${leg.event_name} ${leg.selection}@${leg.odds}`).join(" / ")}</p>}
              <textarea
                placeholder="赛后复盘"
                value={review[bet.id] ?? bet.post_match_review ?? ""}
                onChange={(event) => setReview({ ...review, [bet.id]: event.target.value })}
              />
              <button className="secondary" type="button" onClick={() => saveReview(bet)}>保存复盘</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatsPanel({ stats }: { stats: Stats | null }) {
  if (!stats) return null;
  return (
    <section className="stats-layout">
      <Metric label="投注数" value={stats.bets} />
      <Metric label="总投入" value={`￥${stats.stake}`} />
      <Metric label="总盈亏" value={`￥${stats.profit}`} tone={Number(stats.profit) >= 0 ? "positive" : "negative"} />
      <Metric label="ROI" value={`${(Number(stats.roi) * 100).toFixed(2)}%`} />
      <BucketTable title="按运动" rows={stats.by_sport} />
      <BucketTable title="按平台" rows={stats.by_platform} />
      <BucketTable title="按类型" rows={stats.by_kind} />
      {stats.by_user.length > 0 && <BucketTable title="按用户" rows={stats.by_user} />}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return <div className="metric"><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

function BucketTable({ title, rows }: { title: string; rows: Bucket[] }) {
  return (
    <div className="panel bucket">
      <h2>{title}</h2>
      {rows.map((row) => (
        <div className="bucket-row" key={row.key}>
          <span>{row.key}</span>
          <span>{row.bets} 注</span>
          <b className={Number(row.profit) >= 0 ? "positive" : "negative"}>￥{row.profit}</b>
        </div>
      ))}
    </div>
  );
}

function AdminPanel({ users, request, reload }: { users: User[]; request: ReturnType<typeof api>; reload: () => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    await request("/users", { method: "POST", body: JSON.stringify({ username, password, role: "user" }) });
    setUsername("");
    setPassword("");
    await reload();
  }

  async function toggleUser(user: User) {
    await request(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !user.is_active }) });
    await reload();
  }

  return (
    <section className="admin-grid">
      <form className="panel" onSubmit={createUser}>
        <h2>创建用户</h2>
        <label>用户名<input required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>初始密码<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="primary" type="submit">创建</button>
      </form>
      <div className="panel">
        <h2>用户列表</h2>
        {users.map((user) => (
          <div className="user-row" key={user.id}>
            <span>{user.username}</span>
            <small>{user.role}</small>
            <button className="secondary" type="button" onClick={() => toggleUser(user)}>{user.is_active ? "禁用" : "启用"}</button>
          </div>
        ))}
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
