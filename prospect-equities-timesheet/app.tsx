import React from "react";
import { createRoot } from "react-dom/client";

import { useEffect, useMemo, useState } from "react";

type Entry = { selected: boolean; start: string; end: string };
type Entries = Record<string, Entry>;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const prettyDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return `${pad(m)}/${pad(d)}/${y}`;
};
const displayDate = (key: string) => {
  const d = new Date(`${key}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};
const hoursBetween = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
};
const hoursLabel = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
const timeLabel = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${pad(m)} ${suffix}`;
};

function datesForPeriod(monthValue: string, period: "first" | "second") {
  const [year, month] = monthValue.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  const start = period === "first" ? 1 : 16;
  const end = period === "first" ? 15 : last;
  return Array.from({ length: end - start + 1 }, (_, i) => new Date(year, month - 1, start + i));
}

function startOfWeek(key: string) {
  const d = new Date(`${key}T12:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return iso(d);
}

export default function Home() {
  const now = new Date();
  const [employee, setEmployee] = useState("");
  const [recipient, setRecipient] = useState("");
  const completedPeriodDate = now.getDate() <= 15
    ? new Date(now.getFullYear(), now.getMonth() - 1, 16)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const [month, setMonth] = useState(`${completedPeriodDate.getFullYear()}-${pad(completedPeriodDate.getMonth() + 1)}`);
  const [period, setPeriod] = useState<"first" | "second">(now.getDate() <= 15 ? "second" : "first");
  const periodChoices = [
    { label: "Previous period", date: completedPeriodDate, half: (now.getDate() <= 15 ? "second" : "first") as "first" | "second" },
    { label: "Current period", date: now, half: (now.getDate() <= 15 ? "first" : "second") as "first" | "second" },
  ];
  const [defaultStart, setDefaultStart] = useState("10:00");
  const [defaultEnd, setDefaultEnd] = useState("17:00");
  const [entries, setEntries] = useState<Entries>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("prospect-equities-timesheet-settings-v1") || "null");
      if (saved) {
        setEmployee(typeof saved.employee === "string" ? saved.employee : "");
        setRecipient(typeof saved.recipient === "string" ? saved.recipient : "");
        setDefaultStart(saved.defaultStart || "10:00");
        setDefaultEnd(saved.defaultEnd || "17:00");
      }
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("prospect-equities-timesheet-settings-v1", JSON.stringify({ employee, recipient, defaultStart, defaultEnd })); } catch {}
  }, [employee, recipient, defaultStart, defaultEnd, loaded]);

  const days = useMemo(() => datesForPeriod(month, period), [month, period]);
  const selected = useMemo(() => days.map(iso).filter((key) => entries[key]?.selected), [days, entries]);
  const totalHours = selected.reduce((sum, key) => sum + hoursBetween(entries[key].start, entries[key].end), 0);
  const weeklyTotals = selected.reduce<Record<string, number>>((acc, key) => {
    const week = startOfWeek(key);
    acc[week] = (acc[week] || 0) + hoursBetween(entries[key].start, entries[key].end);
    return acc;
  }, {});

  const monthName = new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const periodText = `${monthName} ${period === "first" ? "1–15" : `16–${days.at(-1)?.getDate()}`}`;

  const toggleDay = (key: string) => {
    setEntries((current) => ({
      ...current,
      [key]: current[key]?.selected
        ? { ...current[key], selected: false }
        : { selected: true, start: current[key]?.start || defaultStart, end: current[key]?.end || defaultEnd },
    }));
  };

  const updateEntry = (key: string, patch: Partial<Entry>) => {
    setEntries((current) => ({ ...current, [key]: { selected: true, start: defaultStart, end: defaultEnd, ...current[key], ...patch } }));
  };

  const selectWeekdays = () => {
    const next = { ...entries };
    days.forEach((d) => {
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        const key = iso(d);
        next[key] = { selected: true, start: next[key]?.start || defaultStart, end: next[key]?.end || defaultEnd };
      }
    });
    setEntries(next);
  };

  const clearPeriod = () => {
    const next = { ...entries };
    days.forEach((d) => { delete next[iso(d)]; });
    setEntries(next);
  };

  const csvContent = () => {
    const rows: string[][] = [
      ["Prospect Equities Timesheet-Absence Report"],
      ["Employee Name", employee],
      ["Pay Period", periodText],
      ["Total Hours Worked", hoursLabel(totalHours)],
      [],
      ["Date", "Start Time", "End Time", "Total Hours", "Week of"],
      ...selected.map((key) => [prettyDate(key), timeLabel(entries[key].start), timeLabel(entries[key].end), hoursLabel(hoursBetween(entries[key].start, entries[key].end)), prettyDate(startOfWeek(key))]),
      [],
      ...Object.entries(weeklyTotals).map(([week, hours]) => [`Weekly Total (${prettyDate(week)})`, "", "", hoursLabel(hours)]),
      [],
      ["Employee Signature", employee],
      ["Date", new Date().toLocaleDateString("en-US")],
    ];
    return rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  };

  const downloadCsv = () => {
    const blob = new Blob(["\ufeff" + csvContent()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${employee.replace(/\s+/g, "_")}_Timesheet_${month}_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    const safeEmployee = employee.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]!));
    const rows = selected.map((key) => `<tr><td>${prettyDate(key)}</td><td>${timeLabel(entries[key].start)}</td><td>${timeLabel(entries[key].end)}</td><td>${hoursLabel(hoursBetween(entries[key].start, entries[key].end))}</td></tr>`).join("");
    const weeks = Object.entries(weeklyTotals).map(([week, hours]) => `<div class="total"><span>Weekly Total — week of ${prettyDate(week)}</span><strong>${hoursLabel(hours)}</strong></div>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.opener = null;
    w.document.write(`<!doctype html><html><head><title>${safeEmployee} Timesheet</title><style>body{font-family:Arial,sans-serif;color:#111;margin:42px}h1{font-size:22px;margin:0 0 4px}.sub{color:#555;margin-bottom:26px}.meta{display:grid;grid-template-columns:180px 1fr;gap:8px;margin-bottom:24px}.meta strong{font-weight:700}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #aaa;padding:10px;text-align:left}th{background:#eee}.total{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #ddd}.grand{font-size:18px;margin-top:18px;padding-top:12px;border-top:2px solid #111;display:flex;justify-content:space-between}.sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px}.line{border-top:1px solid #222;padding-top:7px}@media print{button{display:none}}</style></head><body><h1>Prospect Equities</h1><div class="sub">Timesheet-Absence Report</div><div class="meta"><strong>Employee Name</strong><span>${safeEmployee}</span><strong>Pay Period</strong><span>${periodText}</span></div><table><thead><tr><th>Date</th><th>Start Time</th><th>End Time</th><th>Total Hours</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No work days selected</td></tr>'}</tbody></table>${weeks}<div class="grand"><strong>Total Hours Worked</strong><strong>${hoursLabel(totalHours)}</strong></div><div class="sign"><div class="line">Employee Signature: ${safeEmployee}</div><div class="line">Date: ${new Date().toLocaleDateString("en-US")}</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  const [emailPrepared, setEmailPrepared] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const emailSubject = `${employee} Timesheet – ${periodText}`;
  const emailBody = `Hello,\n\nPlease find attached my completed timesheet for ${periodText}.\n\nTotal hours: ${hoursLabel(totalHours)}\n\nThank you,\n${employee}`;
  const copyEmail = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopyStatus("Copied."); }
    catch { setCopyStatus("Please select the text below and copy it manually."); }
  };
  const prepareEmail = () => {
    setEmailPrepared(true);
    window.open("https://webmail.emailsrvr.com/", "_blank", "noopener,noreferrer");
  };

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">PROSPECT EQUITIES</p>
          <h1>Timesheet, without the spreadsheet.</h1>
          <p className="lede">Select the days you worked. Your totals, report, and email are prepared automatically.</p>
        </div>
        <div className="totalCard"><span>Period total</span><strong>{hoursLabel(totalHours)}</strong><small>hours</small></div>
      </header>

      <nav className="periodChoices" aria-label="Quick pay period selection">
        {periodChoices.map(({ label, date, half }) => {
          const value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
          const end = half === "first" ? 15 : new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
          const dateLabel = `${date.toLocaleDateString("en-US", { month: "short" })} ${half === "first" ? 1 : 16}–${end}, ${date.getFullYear()}`;
          const active = month === value && period === half;
          return <button key={label} type="button" aria-pressed={active} className={active ? "periodChoice selected" : "periodChoice"} onClick={() => { setMonth(value); setPeriod(half); }}><strong>{label}</strong><span>{dateLabel}</span></button>;
        })}
      </nav>
      <section className="settings card" aria-label="Timesheet settings">
        <label>Employee name<input autoComplete="name" placeholder="Your name" value={employee} onChange={(e) => setEmployee(e.target.value)} /></label>
        <label>Month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <label>Pay period<select value={period} onChange={(e) => setPeriod(e.target.value as "first" | "second")}><option value="first">1st–15th</option><option value="second">16th–month end</option></select></label>
        <label>Default start<input type="time" value={defaultStart} onChange={(e) => setDefaultStart(e.target.value)} /></label>
        <label>Default end<input type="time" value={defaultEnd} onChange={(e) => setDefaultEnd(e.target.value)} /></label>
        <label>Email to<input type="email" placeholder="Recipient email" value={recipient} onChange={(e) => setRecipient(e.target.value)} /></label>
      </section>

      <section className="workspace">
        <div className="calendarPanel card">
          <div className="sectionHead"><div><p className="eyebrow">PAY PERIOD</p><h2>{periodText}</h2></div><div className="quick"><button className="ghost" onClick={selectWeekdays}>Select weekdays</button><button className="textButton" onClick={clearPeriod}>Clear</button></div></div>
          <div className="weekLabels"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
          <div className={`calendarGrid ${days[0]?.getDay() === 0 ? "noOffset" : ""}`} style={{ "--offset": days[0]?.getDay() ?? 0 } as React.CSSProperties}>
            {days.map((day) => {
              const key = iso(day); const active = entries[key]?.selected; const weekend = day.getDay() === 0 || day.getDay() === 6;
              return <button key={key} className={`day ${active ? "active" : ""} ${weekend ? "weekend" : ""}`} onClick={() => toggleDay(key)} aria-pressed={active}><span>{day.getDate()}</span>{active && <small>{hoursLabel(hoursBetween(entries[key].start, entries[key].end))}h</small>}</button>;
            })}
          </div>
          <p className="privacy">Your name, recipient email, and default times are remembered in this browser only. Work records are not uploaded. Selected days reset when you reload.</p>
        </div>

        <div className="entriesPanel card">
          <div className="sectionHead"><div><p className="eyebrow">SELECTED DAYS</p><h2>{selected.length} work {selected.length === 1 ? "day" : "days"}</h2></div></div>
          <div className="entryList">
            {selected.length === 0 ? <div className="empty"><span>01</span><p>Choose days on the calendar to begin.</p></div> : selected.map((key) => <div className="entry" key={key}><div><strong>{displayDate(key)}</strong><small>{hoursLabel(hoursBetween(entries[key].start, entries[key].end))} hours</small></div><label>Start<input type="time" value={entries[key].start} onChange={(e) => updateEntry(key, { start: e.target.value })} /></label><label>End<input type="time" value={entries[key].end} onChange={(e) => updateEntry(key, { end: e.target.value })} /></label><button className="remove" aria-label={`Remove ${displayDate(key)}`} onClick={() => toggleDay(key)}>×</button></div>)}
          </div>
          {Object.keys(weeklyTotals).length > 0 && <div className="weekTotals">{Object.entries(weeklyTotals).map(([week, value]) => <div key={week}><span>Week of {displayDate(week).replace(/^\w+, /, "")}</span><strong>{hoursLabel(value)}h</strong></div>)}</div>}
        </div>
      </section>

      <section className="actions card">
        <div><p className="eyebrow">READY TO SUBMIT</p><h2>Review once. Send when you’re ready.</h2><p>Download your report, then open company Webmail. Copy the recipient, subject, and message below into a new email and attach your report. Nothing is sent automatically.</p></div>
        <div className="actionButtons"><button className="secondary" onClick={downloadCsv} disabled={!selected.length || !employee.trim()}>Download spreadsheet</button><button className="secondary" onClick={printPdf} disabled={!selected.length || !employee.trim()}>Print / Save PDF</button><button className="primary" onClick={prepareEmail} disabled={!selected.length || !employee.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)}>Open company Webmail →</button></div>
      </section>
      {emailPrepared && <section className="card emailDraft" aria-label="Email draft">
        <h2>Your email draft</h2>
        <p>Compose a new message in company Webmail. If it did not open, <a href="https://webmail.emailsrvr.com/" target="_blank" rel="noopener noreferrer">open Webmail here</a>.</p>
        <label>To<input readOnly value={recipient} /></label><button className="secondary" onClick={() => copyEmail(recipient)}>Copy recipient</button>
        <label>Subject<input readOnly value={emailSubject} /></label><button className="secondary" onClick={() => copyEmail(emailSubject)}>Copy subject</button>
        <label>Message<textarea readOnly rows={9} value={emailBody} /></label><button className="secondary" onClick={() => copyEmail(emailBody)}>Copy message</button>
        <p role="status">{copyStatus}</p><p>Remember to attach your downloaded timesheet before sending.</p>
      </section>}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Home />);
