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
type BetEditDraft = {
  placed_at: string;
  market: string;
  sport: string;
  odds: string;
  stake: string;
  status: BetStatus;
};

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

function formatBetDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function formatDateInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayDateInputValue();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const start = startOfDay(date);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  return start;
}

function summarizeBets(bets: Bet[], from: Date) {
  return bets.reduce(
    (summary, bet) => {
      const placedAt = new Date(bet.placed_at);
      if (Number.isNaN(placedAt.getTime()) || placedAt < from) return summary;
      return {
        count: summary.count + 1,
        stake: summary.stake + Number(bet.stake || 0),
        profit: summary.profit + Number(bet.profit || 0)
      };
    },
    { count: 0, stake: 0, profit: 0 }
  );
}

function summarizeWinRate(bets: Bet[]) {
  return bets.reduce(
    (summary, bet) => {
      if (bet.status === "won" || bet.status === "half_won") return { ...summary, wins: summary.wins + 1 };
      if (bet.status === "lost" || bet.status === "half_lost") return { ...summary, losses: summary.losses + 1 };
      return summary;
    },
    { wins: 0, losses: 0 }
  );
}

function currency(value: number) {
  return `￥${value.toFixed(2)}`;
}

function selectInputText(event: React.FocusEvent<HTMLInputElement>) {
  event.currentTarget.select();
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

const resultLabels: Record<Exclude<BetStatus, "pending" | "pushed" | "void">, string> = {
  won: "赢",
  lost: "输",
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
      const authError = error.message.toLowerCase();
      if (authError.includes("token") || authError.includes("inactive")) {
        localStorage.removeItem("token");
        setToken(null);
      }
    });
  }, [token]);

  if (!token) {
    return <Login onLogin={(nextToken) => {
      localStorage.setItem("token", nextToken);
      setMessage("");
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
        {activeTab === "stats" && <StatsPanel stats={stats} bets={bets} />}
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
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [editingBetId, setEditingBetId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<BetEditDraft | null>(null);
  const draftProfit = calculateDraftProfit(draft.stake, draft.odds, draft.status);
  const totalPages = Math.max(1, Math.ceil(bets.length / pageSize));
  const visibleBets = bets.slice((page - 1) * pageSize, page * pageSize);
  const totalProfit = bets.reduce((sum, bet) => sum + Number(bet.profit || 0), 0);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  async function createBet(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.status) return;
    if (Number(draft.odds) <= 0 || Number(draft.stake) <= 0) return;
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

  function beginEdit(bet: Bet) {
    setEditingBetId(bet.id);
    setEditDraft({
      placed_at: formatDateInput(bet.placed_at),
      market: bet.market,
      sport: bet.sport,
      odds: bet.odds,
      stake: bet.stake,
      status: bet.status
    });
  }

  async function saveEdit(bet: Bet) {
    if (!editDraft) return;
    if (Number(editDraft.odds) <= 0 || Number(editDraft.stake) <= 0) return;
    await request(`/bets/${bet.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...editDraft,
        placed_at: new Date(`${editDraft.placed_at}T00:00:00`).toISOString()
      })
    });
    setEditingBetId(null);
    setEditDraft(null);
    await reload();
  }

  async function deleteBet(bet: Bet) {
    if (!window.confirm("确定删除这条记录吗？")) return;
    await request(`/bets/${bet.id}`, { method: "DELETE" });
    setEditingBetId(null);
    setEditDraft(null);
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
          <label>赔率<input required min="0.001" type="number" step="0.001" value={draft.odds} onFocus={selectInputText} onChange={(event) => setDraft({ ...draft, odds: event.target.value })} /></label>
          <label>金额<input required min="0.01" type="number" step="0.01" value={draft.stake} onFocus={selectInputText} onChange={(event) => setDraft({ ...draft, stake: event.target.value })} /></label>
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
        <div className="table-header">
          <h2><Activity size={18} /> 记录</h2>
          <label>每页<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
        </div>
        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>投注类型</th>
                <th>比赛类型</th>
                <th>赔率</th>
                <th>金额</th>
                <th>赛果</th>
                <th>盈亏</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleBets.map((bet) => {
                const isEditing = editingBetId === bet.id && editDraft;
                return (
                  <tr key={bet.id}>
                    <td>{isEditing ? <input required type="date" value={editDraft.placed_at} onChange={(event) => setEditDraft({ ...editDraft, placed_at: event.target.value })} /> : formatBetDate(bet.placed_at)}</td>
                    <td>{isEditing ? <select value={editDraft.market} onChange={(event) => setEditDraft({ ...editDraft, market: event.target.value })}><option value="欧盘">欧盘</option><option value="亚盘">亚盘</option><option value="大小">大小</option><option value="角球">角球</option><option value="其他">其他</option></select> : bet.market}</td>
                    <td>{isEditing ? <select value={editDraft.sport} onChange={(event) => setEditDraft({ ...editDraft, sport: event.target.value })}><option value="足球">足球</option><option value="篮球">篮球</option><option value="其他">其他</option></select> : bet.sport}</td>
                    <td>{isEditing ? <input required min="0.001" type="number" step="0.001" value={editDraft.odds} onFocus={selectInputText} onChange={(event) => setEditDraft({ ...editDraft, odds: event.target.value })} /> : bet.odds}</td>
                    <td>{isEditing ? <input required min="0.01" type="number" step="0.01" value={editDraft.stake} onFocus={selectInputText} onChange={(event) => setEditDraft({ ...editDraft, stake: event.target.value })} /> : `￥${bet.stake}`}</td>
                    <td>{isEditing ? <select value={editDraft.status} onChange={(event) => setEditDraft({ ...editDraft, status: event.target.value as BetStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : statusLabels[bet.status]}</td>
                    <td className={Number(bet.profit || 0) >= 0 ? "positive" : "negative"}>{bet.profit ?? "-"}</td>
                    <td>
                      {isEditing ? (
                        <div className="row-actions">
                          <button className="secondary" type="button" onClick={() => saveEdit(bet)}>保存</button>
                          <button className="secondary" type="button" onClick={() => { setEditingBetId(null); setEditDraft(null); }}>取消</button>
                          <button className="danger" type="button" onClick={() => deleteBet(bet)}>删除</button>
                        </div>
                      ) : (
                        <button className="secondary" type="button" onClick={() => beginEdit(bet)}>编辑</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleBets.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-cell">暂无记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <div>
            <strong>总投注手数：{bets.length}</strong>
            <strong className={totalProfit >= 0 ? "positive" : "negative"}>总盈亏：￥{totalProfit.toFixed(2)}</strong>
          </div>
          <div className="pager">
            <button className="secondary" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
            <span>{page} / {totalPages}</span>
            <button className="secondary" type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatsPanel({ stats, bets }: { stats: Stats | null; bets: Bet[] }) {
  if (!stats) return null;
  const now = new Date();
  const winRateItems = [
    { label: "总胜率", value: summarizeWinRate(bets) },
    { label: "足球", value: summarizeWinRate(bets.filter((bet) => bet.sport === "足球")) },
    { label: "篮球", value: summarizeWinRate(bets.filter((bet) => bet.sport === "篮球")) }
  ];
  const periods = [
    { label: "当日", summary: summarizeBets(bets, startOfDay(now)) },
    { label: "本周", summary: summarizeBets(bets, startOfWeek(now)) },
    { label: "本月", summary: summarizeBets(bets, new Date(now.getFullYear(), now.getMonth(), 1)) }
  ];
  return (
    <section className="stats-layout">
      <div className="stats-overview">
        <div className="period-cards">
          {periods.map((period) => (
            <div className="period-card" key={period.label}>
              <h2>{period.label}</h2>
              <div className="period-metrics">
                <Metric label="总投注手数" value={period.summary.count} />
                <Metric label="总投入" value={currency(period.summary.stake)} />
                <Metric label="总盈亏" value={currency(period.summary.profit)} tone={period.summary.profit >= 0 ? "positive" : "negative"} />
              </div>
            </div>
          ))}
        </div>
        <div className="win-rate-card">
          <h2>胜率</h2>
          <div className="win-rate-pies">
            {winRateItems.map((item) => {
              const settledCount = item.value.wins + item.value.losses;
              const winPercent = settledCount ? Math.round((item.value.wins / settledCount) * 100) : 0;
              return (
                <div className="win-rate-item" key={item.label}>
                  <strong>{item.label}</strong>
                  <div className="pie" style={{ "--win": `${winPercent}%` } as React.CSSProperties}>
                    <span>{winPercent}%</span>
                  </div>
                  <div className="win-rate-legend">
                    <span><i className="win-dot" />赢 {item.value.wins}</span>
                    <span><i className="loss-dot" />输 {item.value.losses}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({});

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

  async function resetPassword(user: User) {
    const nextPassword = resetPasswords[user.id]?.trim();
    if (!nextPassword) return;
    await request(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ password: nextPassword }) });
    setResetPasswords({ ...resetPasswords, [user.id]: "" });
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
            <input
              minLength={8}
              placeholder="新密码"
              type="password"
              value={resetPasswords[user.id] ?? ""}
              onChange={(event) => setResetPasswords({ ...resetPasswords, [user.id]: event.target.value })}
            />
            <button className="secondary" type="button" disabled={(resetPasswords[user.id] ?? "").trim().length < 8} onClick={() => resetPassword(user)}>重置密码</button>
            <button className="secondary" type="button" onClick={() => toggleUser(user)}>{user.is_active ? "禁用" : "启用"}</button>
          </div>
        ))}
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
